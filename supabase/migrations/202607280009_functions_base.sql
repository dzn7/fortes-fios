-- Funções-base de catálogo, pedidos, usuários, clientes, mesas e caixa.
-- Fonte: pg_get_functiondef via Supabase Management API em 2026-07-28.

set check_function_bodies = off;
set search_path = pg_catalog, public, extensions;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_bairros()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_combos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = timezone('utc'::text, now()); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE proximo_numero INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero_pedido), 0) + 1 INTO proximo_numero FROM pedidos;
  NEW.numero_pedido := proximo_numero;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_total_pedidos()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT count(*)::integer FROM pedidos;
$function$
;

CREATE OR REPLACE FUNCTION public.liberar_mesas_expiradas()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.mesas SET status = 'livre', nome_cliente = NULL, ocupada_em = NULL, liberar_em = NULL, pedido_id = NULL, observacoes = NULL, updated_at = now()
  WHERE status = 'ocupada' AND liberar_em IS NOT NULL AND liberar_em <= now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_mesas_expiradas()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update public.mesas
  set status = 'livre',
      nome_cliente = null,
      ocupada_em = null,
      liberar_em = null,
      pedido_id = null,
      observacoes = null,
      updated_at = now()
  where status = 'ocupada'
    and (
      (liberar_em is not null and liberar_em <= now())
      or (liberar_em is null and ocupada_em is not null and ocupada_em < now() - interval '180 minutes')
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.limpar_dados_pedido_excluido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.crediario_movimentos
  set status = 'cancelado',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelado_em', timezone('utc'::text, now()),
        'motivo_cancelamento', 'Pedido excluido',
        'pedido_excluido_id', old.id
      )
  where pedido_id = old.id
    and origem = 'pedido'
    and tipo = 'consumo'
    and status = 'ativo';

  delete from public.item_adicionais where item_pedido_id in (select id from public.itens_pedido where pedido_id = old.id);
  delete from public.itens_pedido where pedido_id = old.id;
  delete from public.movimentacoes_caixa where pedido_id = old.id;
  delete from public.entregas where pedido_id = old.id;
  delete from public.pagamentos_pedido where pedido_id = old.id;
  delete from public.fila_impressao where pedido_id = old.id;
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_mesas_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_item_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.nome_item IS NOT NULL AND NEW.nome_produto IS NULL THEN NEW.nome_produto := NEW.nome_item; END IF;
  IF NEW.nome_produto IS NOT NULL AND NEW.nome_item IS NULL THEN NEW.nome_item := NEW.nome_produto; END IF;
  IF NEW.subtotal IS NOT NULL AND NEW.preco_total IS NULL THEN NEW.preco_total := NEW.subtotal; END IF;
  IF NEW.preco_total IS NOT NULL AND NEW.subtotal IS NULL THEN NEW.subtotal := NEW.preco_total; END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preparar_cupom_para_persistencia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.codigo IS NOT NULL THEN NEW.codigo := UPPER(TRIM(NEW.codigo)); END IF;
  NEW.updated_at := timezone('utc'::text, now());
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN NEW.created_at := timezone('utc'::text, now()); END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_total_usos_cupom()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.cupons SET total_usos = COALESCE(total_usos, 0) + 1, updated_at = timezone('utc'::text, now()) WHERE id = NEW.cupom_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.cupons SET total_usos = GREATEST(COALESCE(total_usos, 0) - 1, 0), updated_at = timezone('utc'::text, now()) WHERE id = OLD.cupom_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.cupom_id IS DISTINCT FROM OLD.cupom_id THEN
      UPDATE public.cupons SET total_usos = GREATEST(COALESCE(total_usos, 0) - 1, 0), updated_at = timezone('utc'::text, now()) WHERE id = OLD.cupom_id;
      UPDATE public.cupons SET total_usos = COALESCE(total_usos, 0) + 1, updated_at = timezone('utc'::text, now()) WHERE id = NEW.cupom_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verificar_senha_usuario(p_nome_usuario character varying, p_senha text)
 RETURNS TABLE(id uuid, nome character varying, nome_usuario character varying, papel character varying, avatar_url text, cor_avatar character varying, funcionario_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nome,
    u.nome_usuario,
    u.papel,
    u.avatar_url,
    u.cor_avatar,
    u.funcionario_id
  FROM public.usuarios_sistema u
  WHERE u.nome_usuario = LOWER(TRIM(p_nome_usuario))
    AND u.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    AND u.ativo = true;
    
  UPDATE public.usuarios_sistema
  SET ultimo_acesso = NOW()
  WHERE usuarios_sistema.nome_usuario = LOWER(TRIM(p_nome_usuario))
    AND usuarios_sistema.senha_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
    AND usuarios_sistema.ativo = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_usuario_sistema(p_nome character varying, p_nome_usuario character varying, p_senha text, p_papel character varying, p_avatar_url text DEFAULT NULL::text, p_cor_avatar character varying DEFAULT '#f97316'::character varying, p_funcionario_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  novo_id UUID;
BEGIN
  INSERT INTO public.usuarios_sistema (nome, nome_usuario, senha_hash, papel, avatar_url, cor_avatar, funcionario_id)
  VALUES (
    TRIM(p_nome),
    LOWER(TRIM(p_nome_usuario)),
    encode(extensions.digest(p_senha, 'sha256'), 'hex'),
    p_papel,
    p_avatar_url,
    p_cor_avatar,
    p_funcionario_id
  )
  RETURNING usuarios_sistema.id INTO novo_id;
  
  RETURN novo_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_senha_usuario(p_usuario_id uuid, p_nova_senha text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.usuarios_sistema
  SET senha_hash = encode(extensions.digest(p_nova_senha, 'sha256'), 'hex')
  WHERE id = p_usuario_id;
  
  RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_automacao_caixa()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg public.caixa_automacao_config%rowtype;
  caixa_aberto public.caixas%rowtype;
  timezone_name text;
  responsavel text;
  agora_local timestamp without time zone;
  dia_chave text;
  minuto_atual int;
  minuto_abertura int;
  minuto_fechamento int;
  dentro_janela boolean;
  janela_fechamento boolean;
  deve_abrir boolean;
  deve_fechar boolean;
  total_entradas numeric := 0;
  total_saidas numeric := 0;
  saldo_atual numeric := 0;
  valor_abertura numeric := 0;
  data_local_referencia_abertura timestamp without time zone;
  dia_referencia_abertura text;
  dia_ativo_abertura boolean;
  data_abertura_automatica timestamptz;
begin
  select *
  into cfg
  from public.caixa_automacao_config
  where singleton = true
  limit 1;

  if not found or not coalesce(cfg.ativo, false) then
    return;
  end if;

  timezone_name := coalesce(cfg.timezone, 'America/Sao_Paulo');
  responsavel := coalesce(nullif(trim(cfg.responsavel_padrao), ''), 'Sistema Automatico');
  valor_abertura := greatest(coalesce(cfg.valor_abertura_padrao, 0), 0);

  agora_local := timezone(timezone_name, now());
  dia_chave := to_char(agora_local, 'YYYY-MM-DD');

  minuto_atual := extract(hour from agora_local)::int * 60 + extract(minute from agora_local)::int;
  minuto_abertura := extract(hour from cfg.horario_abertura)::int * 60 + extract(minute from cfg.horario_abertura)::int;
  minuto_fechamento := extract(hour from cfg.horario_fechamento)::int * 60 + extract(minute from cfg.horario_fechamento)::int;

  if minuto_abertura = minuto_fechamento then
    dentro_janela := true;
  elsif minuto_abertura < minuto_fechamento then
    dentro_janela := minuto_atual >= minuto_abertura and minuto_atual < minuto_fechamento;
  else
    dentro_janela := minuto_atual >= minuto_abertura or minuto_atual < minuto_fechamento;
  end if;

  if minuto_abertura < minuto_fechamento then
    janela_fechamento := minuto_atual >= minuto_fechamento;
  else
    janela_fechamento := minuto_atual >= minuto_fechamento and minuto_atual < minuto_abertura;
  end if;

  data_local_referencia_abertura := date_trunc('day', agora_local);
  if minuto_abertura > minuto_fechamento and minuto_atual < minuto_fechamento then
    data_local_referencia_abertura := data_local_referencia_abertura - interval '1 day';
  end if;

  dia_referencia_abertura := to_char(data_local_referencia_abertura, 'YYYY-MM-DD');
  dia_ativo_abertura := extract(dow from data_local_referencia_abertura)::int = any(cfg.dias_ativos);

  select *
  into caixa_aberto
  from public.caixas
  where status = 'aberto'
  order by data_abertura desc, created_at desc, id desc
  limit 1;

  deve_abrir :=
    caixa_aberto.id is null
    and dia_ativo_abertura
    and dentro_janela
    and coalesce(cfg.ultimo_dia_abertura, '') <> dia_referencia_abertura;

  deve_fechar :=
    caixa_aberto.id is not null
    and janela_fechamento
    and coalesce(cfg.ultimo_dia_fechamento, '') <> dia_chave;

  if deve_abrir then
    data_abertura_automatica := (data_local_referencia_abertura + cfg.horario_abertura) at time zone timezone_name;

    insert into public.caixas (
      data_abertura,
      valor_abertura,
      responsavel_abertura,
      status,
      total_entradas,
      total_saidas,
      saldo_esperado
    )
    values (
      data_abertura_automatica,
      valor_abertura,
      responsavel,
      'aberto',
      0,
      0,
      valor_abertura
    )
    on conflict (status) where (status = 'aberto') do nothing;

    update public.caixa_automacao_config
    set
      ultimo_dia_abertura = dia_referencia_abertura,
      updated_at = timezone('utc'::text, now())
    where id = cfg.id;

    return;
  end if;

  if deve_fechar and caixa_aberto.id is not null then
    select
      coalesce(sum(case when tipo = 'entrada' then valor else 0 end), 0),
      coalesce(sum(case when tipo = 'saida' then valor else 0 end), 0)
    into total_entradas, total_saidas
    from public.movimentacoes_caixa
    where caixa_id = caixa_aberto.id;

    saldo_atual := coalesce(caixa_aberto.valor_abertura, 0) + total_entradas - total_saidas;

    update public.caixas
    set
      data_fechamento = now(),
      valor_fechamento = saldo_atual,
      total_entradas = total_entradas,
      total_saidas = total_saidas,
      saldo_esperado = saldo_atual,
      diferenca = 0,
      responsavel_fechamento = responsavel,
      observacoes = concat('Fechamento automatico (', timezone_name, ')'),
      status = 'fechado'
    where id = caixa_aberto.id
      and status = 'aberto';

    update public.caixa_automacao_config
    set
      ultimo_dia_fechamento = dia_chave,
      updated_at = timezone('utc'::text, now())
    where id = cfg.id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pedido_caixa_em_tempo_real()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caixa_aberto public.caixas%rowtype;
  categoria_nome text;
  categoria_id uuid;
  status_pedido text;
  forma_pagamento_pedido text;
  nome_cliente_pedido text;
begin
  status_pedido := lower(coalesce(new.status, ''));

  if status_pedido = 'cancelado' then
    delete from public.movimentacoes_caixa
    where pedido_id = new.id;
    return new;
  end if;

  select *
  into caixa_aberto
  from public.caixas
  where status = 'aberto'
  order by data_abertura desc, created_at desc, id desc
  limit 1;

  if caixa_aberto.id is null then
    return new;
  end if;

  if new.created_at < caixa_aberto.data_abertura then
    return new;
  end if;

  forma_pagamento_pedido := coalesce(new.forma_pagamento, 'Nao informado');
  nome_cliente_pedido := coalesce(nullif(trim(new.nome_cliente), ''), 'Cliente');

  categoria_nome := case forma_pagamento_pedido
    when 'Dinheiro' then 'Pedido - Dinheiro'
    when 'Espécie' then 'Pedido - Dinheiro'
    when 'PIX' then 'Pedido - PIX'
    when 'Cartão de Débito' then 'Pedido - Cartão Débito'
    when 'Cartão Débito' then 'Pedido - Cartão Débito'
    when 'Cartão de Crédito' then 'Pedido - Cartão Crédito'
    when 'Cartão Crédito' then 'Pedido - Cartão Crédito'
    else 'Vendas do Dia'
  end;

  select id
  into categoria_id
  from public.categorias_caixa
  where nome = categoria_nome
    and coalesce(ativo, true)
  order by ordem asc nulls last, created_at asc
  limit 1;

  if categoria_id is null then
    select id
    into categoria_id
    from public.categorias_caixa
    where nome = 'Vendas do Dia'
      and coalesce(ativo, true)
    order by ordem asc nulls last, created_at asc
    limit 1;
  end if;

  insert into public.movimentacoes_caixa (
    caixa_id,
    categoria_id,
    tipo,
    valor,
    descricao,
    forma_pagamento,
    pedido_id
  )
  values (
    caixa_aberto.id,
    categoria_id,
    'entrada',
    coalesce(new.total, 0),
    concat('Pedido de ', nome_cliente_pedido, ' - ', forma_pagamento_pedido),
    forma_pagamento_pedido,
    new.id
  )
  on conflict (pedido_id)
  do update set
    caixa_id = excluded.caixa_id,
    categoria_id = excluded.categoria_id,
    tipo = excluded.tipo,
    valor = excluded.valor,
    descricao = excluded.descricao,
    forma_pagamento = excluded.forma_pagamento;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_usuarios_cliente_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_telefone_cliente(p_telefone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  digitos text;
begin
  digitos := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');

  if digitos = '' then
    return null;
  end if;

  if digitos like '55%' and length(digitos) in (12, 13) then
    digitos := substr(digitos, 3);
  end if;

  if length(digitos) < 10 then
    return null;
  end if;

  if length(digitos) > 11 then
    digitos := right(digitos, 11);
  end if;

  return digitos;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vincular_pedido_usuario_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  telefone_normalizado text;
  nome_limpo text;
  nome_para_cadastro text;
  cliente_uuid uuid;
  data_pedido timestamptz;
begin
  telefone_normalizado := public.normalizar_telefone_cliente(new.telefone);

  if telefone_normalizado is null then
    new.cliente_id := null;
    return new;
  end if;

  nome_limpo := nullif(trim(coalesce(new.nome_cliente, '')), '');
  data_pedido := coalesce(new.created_at, timezone('utc'::text, now()));
  nome_para_cadastro := case
    when public.nome_cliente_cadastro_valido(nome_limpo, new.tipo_entrega) then nome_limpo
    else null
  end;

  insert into public.usuarios_cliente (
    telefone,
    nome,
    primeiro_pedido_em,
    ultimo_pedido_em
  ) values (
    telefone_normalizado,
    nome_para_cadastro,
    data_pedido,
    data_pedido
  )
  on conflict (telefone)
  do update set
    nome = case
      when nome_para_cadastro is not null then nome_para_cadastro
      else public.usuarios_cliente.nome
    end,
    primeiro_pedido_em = least(
      coalesce(public.usuarios_cliente.primeiro_pedido_em, excluded.primeiro_pedido_em),
      excluded.primeiro_pedido_em
    ),
    ultimo_pedido_em = greatest(
      coalesce(public.usuarios_cliente.ultimo_pedido_em, excluded.ultimo_pedido_em),
      excluded.ultimo_pedido_em
    ),
    updated_at = timezone('utc'::text, now())
  returning id into cliente_uuid;

  new.cliente_id := cliente_uuid;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_pedidos_cliente_por_telefone(p_telefone text, p_limite integer DEFAULT 20)
 RETURNS TABLE(id uuid, numero_pedido integer, nome_cliente text, telefone text, status text, tipo_entrega text, forma_pagamento text, total numeric, created_at timestamp with time zone, observacoes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  telefone_normalizado text;
  limite_final integer;
begin
  telefone_normalizado := public.normalizar_telefone_cliente(p_telefone);

  if telefone_normalizado is null then
    return;
  end if;

  limite_final := greatest(1, least(coalesce(p_limite, 20), 100));

  return query
  select
    p.id,
    p.numero_pedido,
    p.nome_cliente::text,
    p.telefone::text,
    p.status::text,
    p.tipo_entrega::text,
    p.forma_pagamento::text,
    p.total,
    p.created_at,
    p.observacoes::text
  from public.pedidos p
  inner join public.usuarios_cliente uc on uc.id = p.cliente_id
  where uc.telefone = telefone_normalizado
  order by p.created_at desc
  limit limite_final;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_popular_snapshot_fila_impressao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_pedido RECORD;
  v_itens JSONB;
BEGIN
  -- Só popula se os snapshots não foram fornecidos
  IF NEW.pedido_snapshot IS NOT NULL AND NEW.itens_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do pedido
  SELECT
    p.id,
    p.numero_pedido,
    p.nome_cliente,
    p.tipo_entrega,
    p.telefone,
    p.mesa,
    p.comanda,
    p.endereco,
    p.bairro,
    p.referencia,
    p.observacoes,
    p.subtotal,
    p.taxa_entrega,
    p.taxa_servico,
    p.total,
    p.forma_pagamento,
    p.troco_para,
    p.pagamento_online,
    p.pagamento_online_status,
    p.created_at
  INTO v_pedido
  FROM pedidos p
  WHERE p.id = NEW.pedido_id;

  -- Se não encontrou o pedido, retorna sem popular
  IF v_pedido.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Popular pedido_snapshot se não foi fornecido
  IF NEW.pedido_snapshot IS NULL THEN
    NEW.pedido_snapshot := jsonb_build_object(
      'id', v_pedido.id,
      'numero_pedido', v_pedido.numero_pedido,
      'nome_cliente', v_pedido.nome_cliente,
      'tipo_entrega', v_pedido.tipo_entrega,
      'telefone', v_pedido.telefone,
      'mesa', v_pedido.mesa,
      'comanda', v_pedido.comanda,
      'endereco', COALESCE(v_pedido.endereco, v_pedido.referencia),
      'bairro', v_pedido.bairro,
      'observacoes', v_pedido.observacoes,
      'subtotal', v_pedido.subtotal,
      'taxa_entrega', v_pedido.taxa_entrega,
      'taxa_servico', v_pedido.taxa_servico,
      'total', v_pedido.total,
      'forma_pagamento', v_pedido.forma_pagamento,
      'troco_para', v_pedido.troco_para,
      'pagamento_online', v_pedido.pagamento_online,
      'pagamento_online_status', v_pedido.pagamento_online_status,
      'created_at', v_pedido.created_at
    );
  END IF;

  -- Popular itens_snapshot se não foi fornecido
  IF NEW.itens_snapshot IS NULL THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'nome_item', ip.nome_item,
        'quantidade', ip.quantidade,
        'preco_unitario', ip.preco_unitario,
        'subtotal', ip.subtotal,
        'observacoes', ip.observacoes,
        'item_adicionais', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'nome', ia.nome,
                'preco', ia.preco,
                'quantidade', COALESCE(ia.quantidade, 1)
              )
            )
            FROM item_adicionais ia
            WHERE ia.item_pedido_id = ip.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY ip.created_at
    ), '[]'::jsonb)
    INTO v_itens
    FROM itens_pedido ip
    WHERE ip.pedido_id = NEW.pedido_id;

    NEW.itens_snapshot := v_itens;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_clientes(p_termo text, p_limite integer DEFAULT 10)
 RETURNS TABLE(id uuid, telefone text, nome text, endereco text, bairro text, total_pedidos bigint, ultimo_pedido_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    uc.id,
    uc.telefone,
    uc.nome,
    uc.endereco,
    uc.bairro,
    count(p.id) AS total_pedidos,
    uc.ultimo_pedido_em
  FROM public.usuarios_cliente uc
  LEFT JOIN public.pedidos p ON p.cliente_id = uc.id
    AND lower(coalesce(p.status, '')) <> 'cancelado'
  WHERE
    uc.nome ILIKE '%' || p_termo || '%'
    OR (
      regexp_replace(p_termo, '[^0-9]', '', 'g') <> ''
      AND uc.telefone ILIKE '%' || regexp_replace(p_termo, '[^0-9]', '', 'g') || '%'
    )
  GROUP BY uc.id, uc.telefone, uc.nome, uc.endereco, uc.bairro, uc.ultimo_pedido_em
  ORDER BY count(p.id) DESC, uc.ultimo_pedido_em DESC NULLS LAST
  LIMIT p_limite;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_atualizar_snapshot_itens_fila()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN UPDATE fila_impressao SET itens_snapshot = ( SELECT COALESCE(jsonb_agg( jsonb_build_object( 'nome_item', ip.nome_item, 'quantidade', ip.quantidade, 'preco_unitario', ip.preco_unitario, 'subtotal', ip.subtotal, 'observacoes', ip.observacoes, 'item_adicionais', COALESCE( ( SELECT jsonb_agg( jsonb_build_object( 'nome', ia.nome, 'preco', ia.preco, 'quantidade', COALESCE(ia.quantidade, 1) ) ) FROM item_adicionais ia WHERE ia.item_pedido_id = ip.id ), '[]'::jsonb ) ) ORDER BY ip.created_at ), '[]'::jsonb) FROM itens_pedido ip WHERE ip.pedido_id = NEW.pedido_id ) WHERE pedido_id = NEW.pedido_id AND status IN ('pendente', 'processando'); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.fn_electron_manter_preparando()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF NEW.origem = 'electron' AND OLD.status = 'preparando' AND NEW.status = 'confirmado' THEN NEW.status := 'preparando'; END IF; RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.fn_electron_status_preparando()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF NEW.status IS NULL OR NEW.status = 'pendente' THEN NEW.status := 'confirmado'; END IF; RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.fn_fila_impressao_auto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.fn_fila_impressao_electron_confirmado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF NEW.origem = 'electron' THEN IF NOT EXISTS (SELECT 1 FROM fila_impressao WHERE pedido_id = NEW.id AND tipo = 'cozinha' AND escopo = 'pedido_completo' AND origem = 'electron') THEN INSERT INTO fila_impressao (pedido_id, tipo, status, escopo, origem, hash_evento) VALUES (NEW.id, 'cozinha', 'pendente', 'pedido_completo', 'electron', NEW.id || ':cozinha:pedido_completo:electron'); END IF; END IF; RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_categorias_cardapio()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    begin
      new.updated_at = timezone('utc'::text, now());
      return new;
    end;
    $function$
;


