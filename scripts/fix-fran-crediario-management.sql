-- Harden crediario account matching and repair movements wrongly attached to the
-- blank-key FRAN account.

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
    update public.crediario_movimentos
    set status = 'cancelado',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('status_pedido', new.status)
    where pedido_id = new.id
      and origem = 'pedido'
      and tipo = 'consumo'
      and status <> 'cancelado';
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

do $$
declare
  rec record;
  v_nome text;
  v_telefone text;
  v_chave text;
  v_conta_destino uuid;
begin
  update public.crediario_contas
  set cliente_chave = coalesce(nullif(public.normalizar_chave_crediario(cliente_nome, telefone), ''), 'conta:' || id::text)
  where nullif(trim(coalesce(cliente_chave, '')), '') is null;

  for rec in
    select
      m.id as movimento_id,
      m.conta_id as conta_origem_id,
      p.id as pedido_id,
      p.nome_cliente,
      p.telefone,
      p.cliente_id,
      p.created_at
    from public.crediario_movimentos m
    join public.crediario_contas c on c.id = m.conta_id
    join public.pedidos p on p.id = m.pedido_id
    where c.id = 'b7e0e89b-bc31-45fa-8143-2a005f72dcbe'::uuid
      and lower(coalesce(p.nome_cliente, '')) not like '%fran%'
      and m.status = 'ativo'
      and m.tipo = 'consumo'
      and m.origem = 'pedido'
  loop
    v_nome := coalesce(nullif(trim(rec.nome_cliente), ''), 'Cliente');
    v_telefone := public.normalizar_telefone_cliente(rec.telefone);
    v_chave := coalesce(nullif(public.normalizar_chave_crediario(v_nome, v_telefone), ''), 'pedido:' || rec.pedido_id::text);
    v_conta_destino := null;

    if rec.cliente_id is not null then
      select id
      into v_conta_destino
      from public.crediario_contas
      where cliente_id = rec.cliente_id
      order by criado_em asc
      limit 1;
    end if;

    if v_conta_destino is null then
      select id
      into v_conta_destino
      from public.crediario_contas
      where cliente_chave = v_chave
        and nullif(trim(coalesce(cliente_chave, '')), '') is not null
      limit 1;
    end if;

    if v_conta_destino is null then
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
        rec.cliente_id,
        v_nome,
        v_chave,
        v_telefone,
        'aberto',
        'pedido',
        coalesce(rec.created_at, timezone('utc'::text, now())),
        timezone('utc'::text, now())
      )
      returning id into v_conta_destino;
    end if;

    update public.crediario_movimentos
    set conta_id = v_conta_destino,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'corrigido_em', timezone('utc'::text, now()),
          'corrigido_de_conta_id', rec.conta_origem_id,
          'motivo_correcao', 'Conta FRAN com cliente_chave vazia recebeu pedido de outro cliente'
        )
    where id = rec.movimento_id;
  end loop;

  perform public.recalcular_crediario_conta('b7e0e89b-bc31-45fa-8143-2a005f72dcbe'::uuid);
end $$;

create or replace function public.limpar_mesas_expiradas()
 returns void
 language plpgsql
as $function$
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
$function$;
