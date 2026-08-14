-- Funções de crediário e validações de cadastro.
-- Fonte: pg_get_functiondef via Supabase Management API em 2026-07-28.

set check_function_bodies = off;
set search_path = pg_catalog, public, extensions;

CREATE OR REPLACE FUNCTION public.normalizar_chave_crediario(p_nome text, p_telefone text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  nome_normalizado text;
  telefone_normalizado text;
begin
  nome_normalizado := lower(
    regexp_replace(
      translate(
        coalesce(nullif(trim(p_nome), ''), 'cliente'),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      ),
      '[^a-z0-9]+',
      '_',
      'g'
    )
  );

  nome_normalizado := trim(both '_' from nome_normalizado);
  telefone_normalizado := public.normalizar_telefone_cliente(p_telefone);

  if telefone_normalizado is not null then
    return nome_normalizado || ':' || telefone_normalizado;
  end if;

  return nome_normalizado;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_crediario_conta(p_conta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_saldo numeric(12,2);
begin
  select coalesce(sum(
    case
      when tipo = 'consumo' and status = 'ativo' then valor
      when tipo in ('pagamento', 'estorno') and status = 'ativo' then -valor
      when tipo = 'ajuste' and status = 'ativo' then valor
      else 0
    end
  ), 0)::numeric(12,2)
  into v_saldo
  from public.crediario_movimentos
  where conta_id = p_conta_id;

  update public.crediario_contas
  set
    saldo_atual = v_saldo,
    status = case
      when status in ('bloqueado', 'arquivado') then status
      when v_saldo <= 0 then 'quitado'
      else 'aberto'
    end,
    quitado_em = case
      when v_saldo <= 0 then coalesce(quitado_em, timezone('utc'::text, now()))
      else null
    end,
    atualizado_em = timezone('utc'::text, now())
  where id = p_conta_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_saldo_crediario_movimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_crediario_conta(old.conta_id);
    return old;
  end if;

  perform public.recalcular_crediario_conta(new.conta_id);

  if tg_op = 'UPDATE' and old.conta_id is distinct from new.conta_id then
    perform public.recalcular_crediario_conta(old.conta_id);
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_crediario_conta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.atualizado_em := timezone('utc'::text, now());
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pedido_usa_crediario(p_forma_pagamento text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select lower(coalesce(p_forma_pagamento, '')) like any(array['%credi%', '%fiado%', '%conta%']);
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_pedido_crediario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conta_id uuid;
  v_chave text;
  v_nome text;
  v_telefone text;
  v_movimento_id uuid;
begin
  if not public.pedido_usa_crediario(new.forma_pagamento) or lower(coalesce(new.status, '')) = 'cancelado' then
    update public.crediario_movimentos m
    set status = 'cancelado',
        metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object('status_pedido', new.status)
    where m.pedido_id = new.id
      and m.origem = 'pedido'
      and m.tipo = 'consumo'
      and m.status <> 'cancelado'
      -- Consumo já liquidado não pode ser cancelado: o pagamento da quitação
      -- ficaria sozinho na conta e o saldo iria para negativo.
      and not exists (
        select 1
        from public.crediario_contas c
        where c.id = m.conta_id
          and c.status = 'quitado'
      );
    return new;
  end if;

  v_nome := coalesce(nullif(trim(new.nome_cliente), ''), 'Cliente');
  v_telefone := public.normalizar_telefone_cliente(new.telefone);
  v_chave := nullif(public.normalizar_chave_crediario(v_nome, v_telefone), '');

  if v_chave is null then
    v_chave := 'pedido:' || new.id::text;
  end if;

  if new.cliente_id is not null then
    select id
    into v_conta_id
    from public.crediario_contas
    where cliente_id = new.cliente_id
    order by criado_em asc
    limit 1;
  end if;

  if v_conta_id is null then
    select id
    into v_conta_id
    from public.crediario_contas
    where cliente_chave = v_chave
      and nullif(trim(coalesce(cliente_chave, '')), '') is not null
    limit 1;
  end if;

  if v_conta_id is null then
    insert into public.crediario_contas (
      cliente_id,
      cliente_nome,
      cliente_chave,
      telefone,
      status,
      origem,
      criado_em,
      atualizado_em
    ) values (
      new.cliente_id,
      v_nome,
      v_chave,
      v_telefone,
      'aberto',
      'pedido',
      coalesce(new.created_at, timezone('utc'::text, now())),
      timezone('utc'::text, now())
    )
    returning id into v_conta_id;
  else
    update public.crediario_contas
    set
      cliente_id = coalesce(public.crediario_contas.cliente_id, new.cliente_id),
      cliente_nome = v_nome,
      cliente_chave = coalesce(nullif(trim(public.crediario_contas.cliente_chave), ''), v_chave),
      telefone = coalesce(v_telefone, public.crediario_contas.telefone),
      status = case when public.crediario_contas.status in ('arquivado', 'quitado') then 'aberto' else public.crediario_contas.status end
    where id = v_conta_id;
  end if;

  select id
  into v_movimento_id
  from public.crediario_movimentos
  where pedido_id = new.id
    and origem = 'pedido'
    and tipo = 'consumo'
  limit 1;

  if v_movimento_id is null then
    insert into public.crediario_movimentos (
      conta_id,
      pedido_id,
      tipo,
      status,
      valor,
      descricao,
      itens,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      v_conta_id,
      new.id,
      'consumo',
      'ativo',
      greatest(coalesce(new.total, 0), 0),
      'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)),
      public.snapshot_itens_pedido_crediario(new.id),
      'pedido',
      coalesce(new.created_at, timezone('utc'::text, now())),
      coalesce(new.created_at, timezone('utc'::text, now())),
      jsonb_build_object('status_pedido', new.status, 'forma_pagamento', new.forma_pagamento)
    );
  else
    update public.crediario_movimentos
    set
      conta_id = v_conta_id,
      status = 'ativo',
      valor = greatest(coalesce(new.total, 0), 0),
      descricao = 'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)),
      itens = public.snapshot_itens_pedido_crediario(new.id),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('status_pedido', new.status, 'forma_pagamento', new.forma_pagamento)
    where id = v_movimento_id;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_crediario(p_conta_id uuid, p_valor numeric, p_descricao text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.registrar_pagamento_crediario(p_conta_id, p_valor, p_descricao, '{}'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.quitar_crediario(p_conta_id uuid, p_descricao text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_saldo numeric(12,2);
  v_movimento_id uuid;
begin
  select saldo_atual
  into v_saldo
  from public.crediario_contas
  where id = p_conta_id
  for update;

  if v_saldo is null then
    raise exception 'Conta de crediario nao encontrada';
  end if;

  if v_saldo > 0 then
    insert into public.crediario_movimentos (
      conta_id,
      tipo,
      status,
      valor,
      descricao,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      p_conta_id,
      'pagamento',
      'ativo',
      v_saldo,
      coalesce(nullif(trim(p_descricao), ''), 'Quitacao do crediario'),
      'manual',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      jsonb_build_object('tipo_pagamento', 'quitacao')
    )
    returning id into v_movimento_id;
  end if;

  update public.crediario_contas
  set status = 'quitado',
      quitado_em = coalesce(quitado_em, timezone('utc'::text, now()))
  where id = p_conta_id;

  -- Conclui os pedidos que estavam no fiado desta conta.
  -- Statement único: locks adquiridos de uma vez; por último na transação.
  update public.pedidos p
  set forma_pagamento = 'Concluído',
      updated_at = timezone('utc'::text, now())
  from public.crediario_movimentos m
  where m.conta_id = p_conta_id
    and m.pedido_id = p.id
    and m.origem = 'pedido'
    and m.tipo = 'consumo'
    and m.status = 'ativo'
    and public.pedido_usa_crediario(p.forma_pagamento);

  return v_movimento_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.snapshot_itens_pedido_crediario(p_pedido_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'nome', coalesce(i.nome_item, i.nome_produto, 'Item'),
        'quantidade', coalesce(i.quantidade, 1),
        'preco_unitario', coalesce(i.preco_unitario, 0),
        'subtotal', coalesce(i.subtotal, i.preco_total, 0),
        'observacoes', i.observacoes,
        'created_at', i.created_at
      )
      order by i.created_at asc, i.id asc
    ),
    '[]'::jsonb
  )
  from public.itens_pedido i
  where i.pedido_id = p_pedido_id;
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_itens_pedido_crediario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);

  update public.crediario_movimentos
  set itens = public.snapshot_itens_pedido_crediario(v_pedido_id)
  where pedido_id = v_pedido_id
    and origem = 'pedido'
    and tipo = 'consumo';

  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enviar_pedido_crediario(p_pedido_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conta_id uuid;
begin
  update public.pedidos
  set forma_pagamento = 'Crediário',
      updated_at = timezone('utc'::text, now())
  where id = p_pedido_id
  returning id into p_pedido_id;

  if p_pedido_id is null then
    raise exception 'Pedido nao encontrado';
  end if;

  select conta_id
  into v_conta_id
  from public.crediario_movimentos
  where pedido_id = p_pedido_id
    and origem = 'pedido'
    and tipo = 'consumo'
    and status = 'ativo'
  limit 1;

  return v_conta_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_crediario(p_conta_id uuid, p_valor numeric, p_descricao text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_movimento_id uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;

  insert into public.crediario_movimentos (
    conta_id,
    tipo,
    status,
    valor,
    descricao,
    origem,
    realizado_em,
    criado_em,
    metadata
  ) values (
    p_conta_id,
    'pagamento',
    'ativo',
    p_valor,
    coalesce(nullif(trim(p_descricao), ''), 'Pagamento recebido'),
    'manual',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_movimento_id;

  return v_movimento_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_movimento_crediario(p_movimento_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conta_id uuid;
begin
  update public.crediario_movimentos
  set
    status = 'cancelado',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'cancelado_em', timezone('utc'::text, now()),
      'motivo_cancelamento', coalesce(nullif(trim(p_motivo), ''), 'Cancelado pelo painel')
    )
  where id = p_movimento_id
  returning conta_id into v_conta_id;

  if v_conta_id is null then
    raise exception 'Movimento do crediario nao encontrado';
  end if;

  perform public.recalcular_crediario_conta(v_conta_id);
  return v_conta_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apagar_item_movimento_crediario(p_movimento_id uuid, p_item_indice integer, p_motivo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_movimento public.crediario_movimentos%rowtype;
  v_item jsonb;
  v_item_valor numeric(12,2);
  v_itens_restantes jsonb;
  v_total_itens integer;
begin
  select *
  into v_movimento
  from public.crediario_movimentos
  where id = p_movimento_id
  for update;

  if v_movimento.id is null then
    raise exception 'Movimento do crediario nao encontrado';
  end if;

  if jsonb_typeof(coalesce(v_movimento.itens, '[]'::jsonb)) <> 'array' then
    return public.cancelar_movimento_crediario(p_movimento_id, p_motivo);
  end if;

  v_total_itens := jsonb_array_length(coalesce(v_movimento.itens, '[]'::jsonb));

  if p_item_indice is null or p_item_indice < 0 or p_item_indice >= v_total_itens then
    raise exception 'Item do crediario nao encontrado';
  end if;

  select item
  into v_item
  from jsonb_array_elements(v_movimento.itens) with ordinality as itens(item, ord)
  where ord = p_item_indice + 1;

  v_item_valor := coalesce(
    nullif(v_item->>'subtotal', '')::numeric,
    nullif(v_item->>'total_item_price', '')::numeric,
    nullif(v_item->>'totalItemPrice', '')::numeric,
    nullif(v_item->>'totalPrice', '')::numeric,
    (coalesce(nullif(v_item->>'preco', '')::numeric, nullif(v_item->>'basePrice', '')::numeric, 0)
      * greatest(coalesce(nullif(v_item->>'quantidade', '')::numeric, nullif(v_item->>'quantity', '')::numeric, 1), 1))
  );

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into v_itens_restantes
  from jsonb_array_elements(v_movimento.itens) with ordinality as itens(item, ord)
  where ord <> p_item_indice + 1;

  if jsonb_array_length(v_itens_restantes) = 0 then
    return public.cancelar_movimento_crediario(p_movimento_id, p_motivo);
  end if;

  update public.crediario_movimentos
  set
    itens = v_itens_restantes,
    valor = greatest(coalesce(valor, 0) - coalesce(v_item_valor, 0), 0),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'item_removido_em', timezone('utc'::text, now()),
      'item_removido', v_item,
      'motivo_remocao_item', coalesce(nullif(trim(p_motivo), ''), 'Item removido pelo painel')
    )
  where id = p_movimento_id;

  perform public.recalcular_crediario_conta(v_movimento.conta_id);
  return v_movimento.conta_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_nome_cliente_cadastro(p_nome text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  nome text;
begin
  nome := lower(trim(coalesce(p_nome, '')));
  nome := translate(nome, 'áàãâäéèêëíìîïóòõôöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  nome := regexp_replace(nome, '[[:space:]]+', ' ', 'g');
  return nome;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.nome_cliente_cadastro_valido(p_nome text, p_tipo_entrega text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  nome text;
  tipo text;
begin
  nome := public.normalizar_nome_cliente_cadastro(p_nome);
  tipo := lower(trim(coalesce(p_tipo_entrega, '')));

  if nome = '' then
    return false;
  end if;

  if nome !~ '[a-z]' then
    return false;
  end if;

  if nome ~ '^(mesa|comanda|local|parceiro|cliente|consumidor pdv)([[:space:]]+[0-9]+)?$' then
    return false;
  end if;

  if nome ~ '(^|[[:space:]])(no|na)[[:space:]]+marcelo($|[[:space:]])' then
    return false;
  end if;

  if tipo = 'local' and nome = 'marcelo' then
    return false;
  end if;

  return true;
end;
$function$
;


