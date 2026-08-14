-- Funções de fila de impressão, estatísticas, pagamentos e produtividade.
-- Fonte: pg_get_functiondef via Supabase Management API em 2026-07-28.

set check_function_bodies = off;
set search_path = pg_catalog, public, extensions;

CREATE OR REPLACE FUNCTION public.fila_impressao_automatica_permitida(p_escopo text, p_instante timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fila_ativa boolean := true;
  v_itens_editados_ativos boolean := true;
  v_inicio_texto text := '00:00';
  v_fim_texto text := '00:00';
  v_inicio time := time '00:00';
  v_fim time := time '00:00';
  v_hora_local time;
begin
  select
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'fila_impressao_automatica_ativa'),
      true
    ),
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'impressao_itens_editados_ativa'),
      true
    ),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_inicio'), '00:00'),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_fim'), '00:00')
  into v_fila_ativa, v_itens_editados_ativos, v_inicio_texto, v_fim_texto
  from public.configuracoes_loja
  where chave in (
    'fila_impressao_automatica_ativa',
    'impressao_itens_editados_ativa',
    'fila_impressao_horario_inicio',
    'fila_impressao_horario_fim'
  );

  if not v_fila_ativa then
    return false;
  end if;

  if coalesce(p_escopo, 'pedido_completo') = 'itens_novos'
     and not v_itens_editados_ativos then
    return false;
  end if;

  if v_inicio_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_inicio := v_inicio_texto::time;
  end if;

  if v_fim_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_fim := v_fim_texto::time;
  end if;

  if v_inicio = v_fim then
    return true;
  end if;

  v_hora_local := (coalesce(p_instante, now()) at time zone 'America/Fortaleza')::time;

  if v_inicio < v_fim then
    return v_hora_local >= v_inicio and v_hora_local < v_fim;
  end if;

  return v_hora_local >= v_inicio or v_hora_local < v_fim;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aplicar_configuracao_automatica_fila_impressao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.origem in ('electron_manual', 'electron_reimpressao') then
    new.automatico := false;
  end if;

  if coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(
       new.escopo,
       coalesce(new.criado_em, new.created_at, now())
     ) then
    return null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.proteger_retorno_fila_impressao_automatica()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'pendente'
     and old.status is distinct from 'pendente'
     and coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(new.escopo, now()) then
    new.status := 'cancelado';
    new.processado_em := now();
    new.erro_mensagem := 'Cancelado pela configuração da fila automática.';
    new.erro := null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.configurar_fila_impressao(p_fila_ativa boolean, p_horario_inicio text, p_horario_fim text, p_imprimir_itens_editados boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cancelados integer := 0;
begin
  if p_horario_inicio !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário inicial inválido.' using errcode = '22007';
  end if;

  if p_horario_fim !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário final inválido.' using errcode = '22007';
  end if;

  insert into public.configuracoes_loja (chave, valor, tipo, descricao, updated_at)
  values
    ('fila_impressao_automatica_ativa', p_fila_ativa::text, 'boolean', 'Permite criar eventos automáticos na fila de impressão.', now()),
    ('fila_impressao_horario_inicio', p_horario_inicio, 'time', 'Início da janela diária de impressão automática em America/Fortaleza.', now()),
    ('fila_impressao_horario_fim', p_horario_fim, 'time', 'Fim da janela diária de impressão automática; igual ao início significa 24 horas.', now()),
    ('impressao_itens_editados_ativa', p_imprimir_itens_editados::text, 'boolean', 'Imprime automaticamente itens adicionados durante a edição de um pedido.', now())
  on conflict (chave) do update
  set valor = excluded.valor,
      tipo = excluded.tipo,
      descricao = excluded.descricao,
      updated_at = excluded.updated_at;

  update public.fila_impressao
  set status = 'cancelado',
      processado_em = now(),
      erro_mensagem = 'Cancelado pela configuração da fila automática.',
      erro = null,
      updated_at = now()
  where status = 'pendente'
    and automatico = true
    and not public.fila_impressao_automatica_permitida(
      escopo,
      coalesce(criado_em, created_at, now())
    );

  get diagnostics v_cancelados = row_count;

  return jsonb_build_object('cancelados', v_cancelados);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.estatisticas_pedidos_periodo(p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(total_pedidos bigint, receita numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    count(*)::bigint AS total_pedidos,
    coalesce(sum(total), 0)::numeric AS receita
  FROM pedidos
  WHERE created_at >= p_inicio
    AND created_at <= p_fim
    AND status NOT IN ('cancelado', 'aguardando_pagamento');
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_item_crediario(p_movimento_id uuid, p_itens_pagos jsonb, p_forma_pagamento text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_movimento public.crediario_movimentos%rowtype;
  v_forma text := lower(trim(coalesce(p_forma_pagamento, '')));
  v_solicitados jsonb;
  v_pendentes jsonb;
  v_item jsonb;
  v_item_id text;
  v_quantidade_original integer;
  v_quantidade_pagar integer;
  v_quantidade_restante integer;
  v_subtotal_original numeric(12,2);
  v_subtotal_pago numeric(12,2);
  v_subtotal_restante numeric(12,2);
  v_itens_restantes jsonb := '[]'::jsonb;
  v_itens_confirmados jsonb := '[]'::jsonb;
  v_valor_pago numeric(12,2) := 0;
  v_pagamento_id uuid;
begin
  if v_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'Forma de pagamento invalida';
  end if;

  if jsonb_typeof(p_itens_pagos) <> 'array' or jsonb_array_length(p_itens_pagos) = 0 then
    raise exception 'Selecione ao menos uma unidade para pagamento';
  end if;

  select coalesce(jsonb_object_agg(item_id, quantidade), '{}'::jsonb)
  into v_solicitados
  from (
    select
      nullif(trim(item->>'id'), '') as item_id,
      sum(floor(coalesce(nullif(item->>'quantidade', '')::numeric, 0)))::integer as quantidade
    from jsonb_array_elements(p_itens_pagos) item
    group by nullif(trim(item->>'id'), '')
  ) solicitacoes;

  if exists (
    select 1
    from jsonb_each_text(v_solicitados) solicitacao(item_id, quantidade)
    where solicitacao.item_id is null or solicitacao.quantidade::integer <= 0
  ) then
    raise exception 'Itens de pagamento invalidos';
  end if;

  select *
  into v_movimento
  from public.crediario_movimentos
  where id = p_movimento_id
  for update;

  if v_movimento.id is null
    or v_movimento.tipo <> 'consumo'
    or v_movimento.origem <> 'pedido'
    or v_movimento.status <> 'ativo'
    or v_movimento.pedido_id is null then
    raise exception 'Item do crediario nao esta disponivel para pagamento';
  end if;

  if jsonb_typeof(v_movimento.itens) <> 'array' then
    raise exception 'Itens do crediario invalidos';
  end if;

  v_pendentes := v_solicitados;

  for v_item in select value from jsonb_array_elements(v_movimento.itens)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    v_quantidade_original := floor(coalesce(nullif(v_item->>'quantidade', '')::numeric, 0))::integer;
    v_quantidade_pagar := coalesce(nullif(v_pendentes->>v_item_id, '')::integer, 0);

    if v_item_id is null or v_quantidade_original <= 0 then
      raise exception 'Snapshot do crediario invalido';
    end if;

    if v_quantidade_pagar <= 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(v_item);
      continue;
    end if;

    v_quantidade_pagar := least(v_quantidade_pagar, v_quantidade_original);
    v_quantidade_restante := v_quantidade_original - v_quantidade_pagar;
    v_subtotal_original := coalesce(nullif(v_item->>'subtotal', '')::numeric, 0);
    v_subtotal_pago := round(v_subtotal_original * v_quantidade_pagar / v_quantidade_original, 2);
    v_subtotal_restante := v_subtotal_original - v_subtotal_pago;
    v_valor_pago := v_valor_pago + v_subtotal_pago;

    v_itens_confirmados := v_itens_confirmados || jsonb_build_array(
      jsonb_set(
        jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_pagar)),
        '{subtotal}', to_jsonb(v_subtotal_pago)
      )
    );

    if v_quantidade_restante > 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(
        jsonb_set(
          jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_restante)),
          '{subtotal}', to_jsonb(v_subtotal_restante)
        )
      );
    end if;

    v_pendentes := jsonb_set(v_pendentes, array[v_item_id], to_jsonb(greatest((v_pendentes->>v_item_id)::integer - v_quantidade_pagar, 0)));
  end loop;

  if exists (
    select 1 from jsonb_each_text(v_pendentes) pendente(item_id, quantidade)
    where pendente.quantidade::integer > 0
  ) then
    raise exception 'Quantidade solicitada nao esta mais no crediario';
  end if;

  if v_valor_pago <= 0 or v_valor_pago > v_movimento.valor then
    raise exception 'Valor de pagamento invalido para este consumo';
  end if;

  update public.crediario_movimentos
  set itens = v_itens_restantes,
      valor = v_movimento.valor - v_valor_pago,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ultimo_pagamento_item_em', timezone('utc'::text, now()))
  where id = v_movimento.id;

  insert into public.pagamentos_pedido (pedido_id, forma_pagamento, valor, itens_pagos)
  values (v_movimento.pedido_id, v_forma, v_valor_pago, v_itens_confirmados)
  returning id into v_pagamento_id;

  return v_pagamento_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_produtividade_nome_generico(p_nome text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  -- Expressão ÚNICA, sem CTE e sem `SET search_path` — as duas coisas impedem o
  -- planner de fazer inline da função. Medido em 3.000 pedidos: 88 ms com a
  -- cláusula SET contra 10 ms inline. A proteção contra search_path hijack é
  -- mantida qualificando cada função e o operador em pg_catalog.
  -- O `.{0,2}` cobre nome vazio ou de até duas letras; o resto do alternador
  -- cobre "só dígitos", "mesa 7", "casal da esquina…" e os rótulos soltos.
  select pg_catalog.lower(
    pg_catalog.translate(
      coalesce(pg_catalog.btrim(p_nome), ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )
  ) OPERATOR(pg_catalog.~) ('^([[:space:]]*.{0,2}'
    || '|[0-9]+'
    || '|(mesa|comanda|balcao|local|pdv|caixa|cliente|consumidor)[[:space:]]*[0-9]*'
    || '|(casal|mesa|comanda|balcao|cliente|consumidor|turista|visitante|pessoa)[[:space:]].*'
    || '|clientes|consumidor pdv|consumidor final|turistas?|visitantes?|sem nome'
    || '|nao inform(ado|ou)|teste|avulso|fregues|moc[ao]|rapaz|senhor(a)?|menin[ao]|nome|x+'
    || ')$')
$function$
;

CREATE OR REPLACE FUNCTION public.fn_produtividade_pesos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'pontos_pedido_criado', 10,
    'pontos_pedido_fechado', 15,
    'pontos_item_adicionado', 2,
    'pontos_pedido_editado', 3,
    'bonus_cadastro_completo', 5,
    'penalidade_nome_generico', 8,
    'penalidade_contato_ausente', 5,
    'penalidade_pedido_cancelado', 0,
    'meta_pontos_dia', 150,
    'meta_pontos_semana', 900,
    'meta_pontos_mes', 3600
  ) || coalesce((select jsonb_object_agg(chave, valor) from produtividade_config), '{}'::jsonb)
$function$
;

CREATE OR REPLACE FUNCTION public.fn_produtividade_pedidos_classificados(p_inicio timestamp with time zone, p_fim timestamp with time zone, p_garcom_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(pedido_id uuid, numero_pedido integer, garcom_id uuid, nome_cliente text, tipo_entrega text, status text, total numeric, criado_em timestamp with time zone, cancelado boolean, fechado boolean, nome_generico boolean, contato_ausente boolean, cadastro_completo boolean)
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
  select
    ped.id,
    ped.numero_pedido,
    ped.garcom_id,
    ped.nome_cliente::text,
    lower(coalesce(ped.tipo_entrega, ''))::text as tipo_entrega,
    lower(coalesce(ped.status, ''))::text as status,
    coalesce(ped.total, 0) as total,
    ped.created_at,
    lower(coalesce(ped.status, '')) = 'cancelado' as cancelado,
    lower(coalesce(ped.status, '')) = 'entregue' as fechado,
    aval.nome_generico,
    (
      aval.entrega_ou_retirada
      and (
        aval.digitos_telefone < 8
        or (
          lower(coalesce(ped.tipo_entrega, '')) = 'entrega'
          and nullif(trim(coalesce(ped.endereco, ped.endereco_entrega, '')), '') is null
        )
      )
    ) as contato_ausente,
    (not aval.nome_generico and aval.digitos_telefone >= 8) as cadastro_completo
  from pedidos ped
  -- LATERAL para avaliar nome e telefone uma única vez por linha (custam regex).
  cross join lateral (
    select
      fn_produtividade_nome_generico(ped.nome_cliente) as nome_generico,
      length(regexp_replace(coalesce(ped.telefone, '')::text, '\D', '', 'g')) as digitos_telefone,
      lower(coalesce(ped.tipo_entrega, '')) in ('retirada', 'entrega') as entrega_ou_retirada
  ) as aval
  where ped.garcom_id is not null
    and ped.created_at >= p_inicio
    and ped.created_at < p_fim
    and (p_garcom_id is null or ped.garcom_id = p_garcom_id)
$function$
;

CREATE OR REPLACE FUNCTION public.produtividade_garcons(p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(garcom_id uuid, nome text, nome_usuario text, avatar_url text, cor_avatar text, ativo boolean, ultimo_acesso timestamp with time zone, pedidos_criados integer, pedidos_fechados integer, pedidos_cancelados integer, pedidos_abertos integer, itens_adicionados integer, edicoes integer, vendas numeric, ticket_medio numeric, ocorrencias_nome integer, ocorrencias_contato integer, cadastros_completos integer, pontos_positivos numeric, pontos_negativos numeric, pontos numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select * from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null)
  ),
  por_pedido as (
    select
      c.garcom_id,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as pedidos_cancelados,
      count(*) filter (where not c.fechado and not c.cancelado)::integer as pedidos_abertos,
      coalesce(sum(c.total) filter (where not c.cancelado), 0) as vendas,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.garcom_id
  ),
  por_atividade as (
    select
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      -- Distinto por (dia operacional, pedido) — a mesma regra da série diária.
      -- Contar distinct só por pedido faria o total divergir da soma da série
      -- quando um pedido é editado em dois dias (mesa que atravessa as 03h).
      -- `pedido_id is not null` é obrigatório: em `count(distinct (dia, pedido_id))`
      -- o par não é nulo quando só o pedido é, e o evento órfão entraria na conta.
      count(distinct (
        ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date,
        a.pedido_id
      )) filter (
        where a.tipo_acao = 'pedido_modificado' and a.pedido_id is not null
      )::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by a.garcom_id
  ),
  consolidado as (
    select
      u.id as garcom_id,
      u.nome::text,
      u.nome_usuario::text,
      u.avatar_url,
      coalesce(u.cor_avatar, '#0296F9')::text as cor_avatar,
      coalesce(u.ativo, true) as ativo,
      u.ultimo_acesso,
      coalesce(pp.pedidos_criados, 0) as pedidos_criados,
      coalesce(pp.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(pp.pedidos_cancelados, 0) as pedidos_cancelados,
      coalesce(pp.pedidos_abertos, 0) as pedidos_abertos,
      coalesce(pa.itens_adicionados, 0) as itens_adicionados,
      coalesce(pa.edicoes, 0) as edicoes,
      coalesce(pp.vendas, 0) as vendas,
      coalesce(pp.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(pp.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(pp.cadastros_completos, 0) as cadastros_completos
    from usuarios_sistema u
    left join por_pedido pp on pp.garcom_id = u.id
    left join por_atividade pa on pa.garcom_id = u.id
    where u.papel = 'garcom'
  )
  select
    c.garcom_id,
    c.nome,
    c.nome_usuario,
    c.avatar_url,
    c.cor_avatar,
    c.ativo,
    c.ultimo_acesso,
    c.pedidos_criados,
    c.pedidos_fechados,
    c.pedidos_cancelados,
    c.pedidos_abertos,
    c.itens_adicionados,
    c.edicoes,
    c.vendas,
    case
      when c.pedidos_criados - c.pedidos_cancelados > 0
        then round(c.vendas / (c.pedidos_criados - c.pedidos_cancelados), 2)
      else 0
    end as ticket_medio,
    c.ocorrencias_nome,
    c.ocorrencias_contato,
    c.cadastros_completos,
    positivos.valor as pontos_positivos,
    negativos.valor as pontos_negativos,
    positivos.valor - negativos.valor as pontos
  from consolidado c
  cross join pesos
  cross join lateral (
    select round(
      (c.pedidos_criados - c.pedidos_cancelados) * (pesos.p ->> 'pontos_pedido_criado')::numeric
      + c.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + c.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + c.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + c.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
    , 2) as valor
  ) as positivos
  cross join lateral (
    select round(
      c.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      + c.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      + c.pedidos_cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as valor
  ) as negativos
$function$
;

CREATE OR REPLACE FUNCTION public.produtividade_serie_diaria(p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(dia date, garcom_id uuid, pontos numeric, pedidos_criados integer, pedidos_fechados integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select
      ((c.criado_em at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      c.*
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null) c
  ),
  por_dia as (
    select
      c.dia,
      c.garcom_id,
      count(*) filter (where not c.cancelado)::integer as criados_validos,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as cancelados,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.dia, c.garcom_id
  ),
  atividade_por_dia as (
    select
      ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      count(distinct a.pedido_id) filter (where a.tipo_acao = 'pedido_modificado')::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by 1, 2
  ),
  combinado as (
    select
      coalesce(d.dia, ad.dia) as dia,
      coalesce(d.garcom_id, ad.garcom_id) as garcom_id,
      coalesce(d.criados_validos, 0) as criados_validos,
      coalesce(d.pedidos_criados, 0) as pedidos_criados,
      coalesce(d.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(d.cancelados, 0) as cancelados,
      coalesce(d.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(d.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(d.cadastros_completos, 0) as cadastros_completos,
      coalesce(ad.itens_adicionados, 0) as itens_adicionados,
      coalesce(ad.edicoes, 0) as edicoes
    from por_dia d
    full outer join atividade_por_dia ad
      on ad.dia = d.dia and ad.garcom_id = d.garcom_id
  )
  select
    k.dia,
    k.garcom_id,
    round(
      k.criados_validos * (pesos.p ->> 'pontos_pedido_criado')::numeric

      + k.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + k.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + k.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + k.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
      - k.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      - k.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      - k.cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as pontos,
    k.pedidos_criados,
    k.pedidos_fechados
  from combinado k
  cross join pesos
  -- Mesmo recorte do ranking: só quem é garçom hoje, senão a série mostra um
  -- traço sem nome para usuários que mudaram de papel.
  join usuarios_sistema u on u.id = k.garcom_id and u.papel = 'garcom'
  order by k.dia, k.garcom_id
$function$
;

CREATE OR REPLACE FUNCTION public.produtividade_ocorrencias(p_inicio timestamp with time zone, p_fim timestamp with time zone, p_garcom_id uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(pedido_id uuid, numero_pedido integer, garcom_id uuid, garcom_nome text, nome_cliente text, tipo_entrega text, status text, total numeric, criado_em timestamp with time zone, motivos text[], pontos_perdidos numeric, total_registros bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  problemas as (
    select
      c.*,
      array_remove(array[
        case when c.nome_generico then 'nome_generico' end,
        case when c.contato_ausente then 'contato_ausente' end
      ], null) as motivos
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, p_garcom_id) c
    where not c.cancelado
      and (c.nome_generico or c.contato_ausente)
      -- Mesmo recorte do ranking e da série: filtrar aqui (e não no join final)
      -- para o count(*) over () não contar quem está fora da lista.
      and exists (
        select 1 from usuarios_sistema u
        where u.id = c.garcom_id and u.papel = 'garcom'
      )
  ),
  contado as (
    select pr.*, count(*) over () as total_registros
    from problemas pr
  )
  select
    ct.pedido_id,
    ct.numero_pedido,
    ct.garcom_id,
    u.nome::text as garcom_nome,
    ct.nome_cliente,
    ct.tipo_entrega,
    ct.status,
    ct.total,
    ct.criado_em,
    ct.motivos,
    round(
      case when ct.nome_generico then (pesos.p ->> 'penalidade_nome_generico')::numeric else 0 end
      + case when ct.contato_ausente then (pesos.p ->> 'penalidade_contato_ausente')::numeric else 0 end
    , 2) as pontos_perdidos,
    ct.total_registros
  from contado ct
  cross join pesos
  left join usuarios_sistema u on u.id = ct.garcom_id
  order by ct.criado_em desc
  limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$function$
;

CREATE OR REPLACE FUNCTION public.produtividade_ler_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select fn_produtividade_pesos()
$function$
;

CREATE OR REPLACE FUNCTION public.produtividade_salvar_config(p_config jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_chave text;
  v_valor numeric;
  v_chaves_validas text[] := array[
    'pontos_pedido_criado', 'pontos_pedido_fechado', 'pontos_item_adicionado',
    'pontos_pedido_editado', 'bonus_cadastro_completo', 'penalidade_nome_generico',
    'penalidade_contato_ausente', 'penalidade_pedido_cancelado',
    'meta_pontos_dia', 'meta_pontos_semana', 'meta_pontos_mes'
  ];
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida';
  end if;

  for v_chave in select jsonb_object_keys(p_config) loop
    if not (v_chave = any (v_chaves_validas)) then
      raise exception 'Chave desconhecida: %', v_chave;
    end if;

    begin
      v_valor := (p_config ->> v_chave)::numeric;
    exception when others then
      raise exception 'Valor inválido para %', v_chave;
    end;

    if v_valor is null or v_valor < 0 or v_valor > 100000 then
      raise exception 'Valor fora do intervalo permitido para %', v_chave;
    end if;

    insert into produtividade_config (chave, valor, atualizado_em)
    values (v_chave, v_valor, now())
    on conflict (chave) do update
      set valor = excluded.valor,
          atualizado_em = excluded.atualizado_em;
  end loop;

  return fn_produtividade_pesos();
end;
$function$
;


