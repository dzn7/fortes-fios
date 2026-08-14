-- ============================================================================
-- Crediário: ao quitar a conta, concluir os pedidos que estavam no fiado.
--
-- Problema
--   `quitar_crediario` só inseria o pagamento e zerava a conta — nunca escrevia
--   em `pedidos`. Como o card deriva o selo de `forma_pagamento` + status da
--   conta, o pedido continuava marcado como "Crediário" para sempre.
--
-- Armadilha tratada
--   `trigger_sincronizar_pedido_crediario` dispara em UPDATE OF forma_pagamento
--   e, quando a forma deixa de casar com %credi%/%fiado%/%conta%, CANCELA o
--   movimento de consumo. Se isso acontecesse ao concluir o pedido, sobraria
--   apenas o pagamento da quitação e o saldo da conta ficaria NEGATIVO.
--   Por isso a função de sincronização passa a NÃO cancelar consumos de contas
--   já quitadas.
--
-- Notas de performance/concorrência
--   - O UPDATE dos pedidos é um único statement (locks adquiridos de uma vez,
--     evita deadlock) e roda por último, depois de a conta estar quitada.
--   - O join usa índices existentes: idx_crediario_movimentos_conta_data e
--     idx_crediario_movimentos_pedido. Nenhum índice novo é necessário.
--   - Idempotente: só toca pedidos que ainda usam crediário.
-- ============================================================================

-- 1) Não cancelar o consumo de contas já quitadas (senão o saldo fica negativo)
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
$function$;

-- 2) Quitar a conta passa a concluir os pedidos ligados a ela
create or replace function public.quitar_crediario(p_conta_id uuid, p_descricao text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;
