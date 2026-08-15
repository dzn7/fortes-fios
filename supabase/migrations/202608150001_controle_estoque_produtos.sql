alter table public.produtos
  add column if not exists estoque_quantidade integer not null default 0,
  add column if not exists estoque_minimo integer not null default 5,
  add column if not exists bloquear_venda_sem_estoque boolean not null default false;

alter table public.itens_pedido
  add column if not exists estoque_quantidade_consumida integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'produtos_estoque_quantidade_nao_negativa'
      and conrelid = 'public.produtos'::regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_quantidade_nao_negativa
      check (estoque_quantidade >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'produtos_estoque_minimo_nao_negativo'
      and conrelid = 'public.produtos'::regclass
  ) then
    alter table public.produtos
      add constraint produtos_estoque_minimo_nao_negativo
      check (estoque_minimo >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'itens_pedido_estoque_consumido_valido'
      and conrelid = 'public.itens_pedido'::regclass
  ) then
    alter table public.itens_pedido
      add constraint itens_pedido_estoque_consumido_valido
      check (
        estoque_quantidade_consumida >= 0
        and estoque_quantidade_consumida <= quantidade
      );
  end if;
end;
$$;

create or replace function public.definir_estoque_produto(
  p_produto_id uuid,
  p_quantidade integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  if p_quantidade is null or p_quantidade < 0 then
    raise exception using
      errcode = '23514',
      message = 'A quantidade de estoque não pode ser negativa.';
  end if;

  update public.produtos
     set estoque_quantidade = p_quantidade,
         updated_at = timezone('utc'::text, now())
   where id = p_produto_id
   returning estoque_quantidade into v_quantidade;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Produto não encontrado.';
  end if;

  return v_quantidade;
end;
$$;

create or replace function public.ajustar_estoque_produto(
  p_produto_id uuid,
  p_delta integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_quantidade integer;
begin
  if p_delta is null then
    raise exception using
      errcode = '22004',
      message = 'O ajuste de estoque é obrigatório.';
  end if;

  update public.produtos
     set estoque_quantidade = estoque_quantidade + p_delta,
         updated_at = timezone('utc'::text, now())
   where id = p_produto_id
     and estoque_quantidade + p_delta >= 0
   returning estoque_quantidade into v_quantidade;

  if found then
    return v_quantidade;
  end if;

  if exists (select 1 from public.produtos where id = p_produto_id) then
    raise exception using
      errcode = '23514',
      message = 'A quantidade de estoque não pode ser negativa.';
  end if;

  raise exception using
    errcode = 'P0002',
    message = 'Produto não encontrado.';
end;
$$;

create or replace function public.sincronizar_estoque_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto public.produtos%rowtype;
  v_pedido_cancelado boolean := false;
  v_consumir integer := 0;
begin
  if tg_op = 'DELETE' then
    if old.produto_id is not null and old.estoque_quantidade_consumida > 0 then
      perform 1
        from public.produtos
       where id = old.produto_id
       for update;

      update public.produtos
         set estoque_quantidade = estoque_quantidade + old.estoque_quantidade_consumida,
             updated_at = timezone('utc'::text, now())
       where id = old.produto_id;
    end if;
    return old;
  end if;

  if new.quantidade is null or new.quantidade <= 0 then
    raise exception using
      errcode = '23514',
      message = 'A quantidade do item deve ser maior que zero.';
  end if;

  if tg_op = 'UPDATE' then
    perform 1
      from public.produtos
     where id in (old.produto_id, new.produto_id)
     order by id
     for update;

    if old.produto_id is not null and old.estoque_quantidade_consumida > 0 then
      update public.produtos
         set estoque_quantidade = estoque_quantidade + old.estoque_quantidade_consumida,
             updated_at = timezone('utc'::text, now())
       where id = old.produto_id;
    end if;
  elsif new.produto_id is not null then
    perform 1
      from public.produtos
     where id = new.produto_id
     for update;
  end if;

  new.estoque_quantidade_consumida := 0;
  if new.produto_id is null then
    return new;
  end if;

  select coalesce(p.status = 'cancelado', false)
    into v_pedido_cancelado
    from public.pedidos p
   where p.id = new.pedido_id;

  if v_pedido_cancelado then
    return new;
  end if;

  select * into v_produto
    from public.produtos
   where id = new.produto_id
   for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Produto do item não encontrado.';
  end if;

  if v_produto.bloquear_venda_sem_estoque
     and new.quantidade > v_produto.estoque_quantidade then
    raise exception using
      errcode = 'P0001',
      message = format(
        'ESTOQUE_INSUFICIENTE:%s:%s:%s',
        new.produto_id,
        v_produto.nome,
        v_produto.estoque_quantidade
      );
  end if;

  v_consumir := least(v_produto.estoque_quantidade, new.quantidade);
  if v_consumir > 0 then
    update public.produtos
       set estoque_quantidade = estoque_quantidade - v_consumir,
           updated_at = timezone('utc'::text, now())
     where id = new.produto_id;
  end if;

  new.estoque_quantidade_consumida := v_consumir;
  return new;
end;
$$;

create or replace function public.reconciliar_estoque_status_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (new.status = 'cancelado' or old.status = 'cancelado') then
    update public.itens_pedido
       set estoque_quantidade_consumida = estoque_quantidade_consumida
     where pedido_id = new.id
       and produto_id is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sincronizar_estoque_item_pedido on public.itens_pedido;
create trigger trg_sincronizar_estoque_item_pedido
before insert or delete or update of produto_id, pedido_id, quantidade, estoque_quantidade_consumida
on public.itens_pedido
for each row
execute function public.sincronizar_estoque_item_pedido();

drop trigger if exists trg_reconciliar_estoque_status_pedido on public.pedidos;
create trigger trg_reconciliar_estoque_status_pedido
after update of status
on public.pedidos
for each row
execute function public.reconciliar_estoque_status_pedido();

revoke all on function public.sincronizar_estoque_item_pedido() from public, anon, authenticated;
revoke all on function public.reconciliar_estoque_status_pedido() from public, anon, authenticated;

grant execute on function public.definir_estoque_produto(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.ajustar_estoque_produto(uuid, integer) to anon, authenticated, service_role;

comment on column public.produtos.estoque_quantidade is
  'Quantidade física atual. O estado de estoque é derivado deste valor e de estoque_minimo.';
comment on column public.produtos.estoque_minimo is
  'Limite inclusivo para sinalizar estoque baixo.';
comment on column public.produtos.bloquear_venda_sem_estoque is
  'Quando verdadeiro, itens com estoque zero ou insuficiente não podem entrar em pedidos.';
comment on column public.itens_pedido.estoque_quantidade_consumida is
  'Quantidade efetivamente reservada pelo item, usada para restauração exata.';
