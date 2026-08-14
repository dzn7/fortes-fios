-- Crediario: concluir um pedido passa a quitar somente o consumo desse pedido.
-- A regra vive no banco para cobrir admin, garcom, entregador e demais clientes.

-- Impede que a troca de forma de pagamento cancele um consumo ja liquidado
-- pela conclusao do proprio pedido. O par consumo + pagamento permanece ativo
-- para preservar a trilha financeira e soma zero no saldo da conta.
create or replace function public.sincronizar_pedido_crediario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      and m.valor > 0
      and not exists (
        select 1
        from public.crediario_contas c
        where c.id = m.conta_id
          and c.status = 'quitado'
      )
      and not exists (
        select 1
        from public.crediario_movimentos pagamento
        where pagamento.conta_id = m.conta_id
          and pagamento.pedido_id = m.pedido_id
          and pagamento.tipo = 'pagamento'
          and pagamento.status = 'ativo'
          and pagamento.metadata->>'tipo_pagamento' = 'quitacao_pedido'
          and pagamento.metadata->>'movimento_consumo_id' = m.id::text
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
$function$;

-- Executa antes da mudanca para entregue. A linha do pedido ja esta bloqueada
-- pelo UPDATE; o movimento e bloqueado em seguida, sempre na mesma ordem.
create or replace function public.quitar_crediario_ao_concluir_pedido()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_movimento public.crediario_movimentos%rowtype;
begin
  if lower(trim(coalesce(old.status, ''))) = 'entregue'
    or lower(trim(coalesce(new.status, ''))) <> 'entregue'
    or not public.pedido_usa_crediario(new.forma_pagamento) then
    return new;
  end if;

  select movimento.*
  into v_movimento
  from public.crediario_movimentos movimento
  where movimento.pedido_id = new.id
    and movimento.origem = 'pedido'
    and movimento.tipo = 'consumo'
    and movimento.status = 'ativo'
  for update;

  if v_movimento.id is null then
    raise exception 'Pedido em crediario sem consumo ativo vinculado';
  end if;

  if v_movimento.valor > 0 and not exists (
    select 1
    from public.crediario_movimentos pagamento
    where pagamento.conta_id = v_movimento.conta_id
      and pagamento.pedido_id = new.id
      and pagamento.tipo = 'pagamento'
      and pagamento.status = 'ativo'
      and pagamento.metadata->>'tipo_pagamento' = 'quitacao_pedido'
      and pagamento.metadata->>'movimento_consumo_id' = v_movimento.id::text
  ) then
    insert into public.crediario_movimentos (
      conta_id,
      pedido_id,
      tipo,
      status,
      valor,
      descricao,
      origem,
      realizado_em,
      criado_em,
      metadata
    ) values (
      v_movimento.conta_id,
      new.id,
      'pagamento',
      'ativo',
      v_movimento.valor,
      'Pedido #' || coalesce(new.numero_pedido::text, left(new.id::text, 8)) || ' quitado ao concluir',
      'pedido',
      timezone('utc'::text, now()),
      timezone('utc'::text, now()),
      jsonb_build_object(
        'tipo_pagamento', 'quitacao_pedido',
        'movimento_consumo_id', v_movimento.id::text
      )
    );
  end if;

  new.forma_pagamento := 'Concluído';
  return new;
end;
$function$;

drop trigger if exists trigger_quitar_crediario_ao_concluir on public.pedidos;
create trigger trigger_quitar_crediario_ao_concluir
before update of status on public.pedidos
for each row
execute function public.quitar_crediario_ao_concluir_pedido();

-- Pagamento livre nao pode ultrapassar a divida atual. Ao zerar a conta pelo
-- fluxo Receber, conclui tambem os pedidos ligados, como quitar_crediario faz.
create or replace function public.registrar_pagamento_crediario(
  p_conta_id uuid,
  p_valor numeric,
  p_descricao text default null::text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_saldo numeric(12,2);
  v_movimento_id uuid;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;

  select conta.saldo_atual
  into v_saldo
  from public.crediario_contas conta
  where conta.id = p_conta_id
  for update;

  if v_saldo is null then
    raise exception 'Conta de crediario nao encontrada';
  end if;

  if v_saldo <= 0 then
    raise exception 'Conta de crediario nao possui saldo em aberto';
  end if;

  if p_valor > v_saldo then
    raise exception 'Pagamento maior que o saldo em aberto';
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

  if p_valor = v_saldo then
    update public.pedidos pedido
    set forma_pagamento = 'Concluído',
        updated_at = timezone('utc'::text, now())
    from public.crediario_movimentos movimento
    where movimento.conta_id = p_conta_id
      and movimento.pedido_id = pedido.id
      and movimento.origem = 'pedido'
      and movimento.tipo = 'consumo'
      and movimento.status = 'ativo'
      and public.pedido_usa_crediario(pedido.forma_pagamento);
  end if;

  return v_movimento_id;
end;
$function$;

-- Se o pagamento por itens zerar o consumo do pedido, o card deixa de manter
-- a forma Crediario. Pagamentos parciais preservam a divida e o selo.
create or replace function public.registrar_pagamento_item_crediario(
  p_movimento_id uuid,
  p_itens_pagos jsonb,
  p_forma_pagamento text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_valor_restante numeric(12,2);
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

  v_valor_restante := v_movimento.valor - v_valor_pago;

  update public.crediario_movimentos
  set itens = v_itens_restantes,
      valor = v_valor_restante,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ultimo_pagamento_item_em', timezone('utc'::text, now()))
  where id = v_movimento.id;

  insert into public.pagamentos_pedido (pedido_id, forma_pagamento, valor, itens_pagos)
  values (v_movimento.pedido_id, v_forma, v_valor_pago, v_itens_confirmados)
  returning id into v_pagamento_id;

  if v_valor_restante <= 0 then
    update public.pedidos
    set forma_pagamento = 'Concluído',
        updated_at = timezone('utc'::text, now())
    where id = v_movimento.pedido_id
      and public.pedido_usa_crediario(forma_pagamento);
  end if;

  return v_pagamento_id;
end;
$function$;
