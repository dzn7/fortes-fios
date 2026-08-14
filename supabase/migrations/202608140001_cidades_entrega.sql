-- A tabela `bairros` passa a representar cidades de entrega. O nome físico é
-- preservado para manter compatibilidade com os clientes e integrações atuais.
alter table public.bairros
  add column if not exists valor_minimo_pedido numeric(10, 2) not null default 0;

alter table public.pedidos
  add column if not exists cidade text;

alter table public.entregas
  add column if not exists cidade text;

alter table public.usuarios_cliente
  add column if not exists cidade text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bairros_valor_minimo_pedido_check'
      and conrelid = 'public.bairros'::regclass
  ) then
    alter table public.bairros
      add constraint bairros_valor_minimo_pedido_check
      check (valor_minimo_pedido >= 0);
  end if;
end
$$;

insert into public.bairros (
  nome,
  taxa_entrega,
  valor_minimo_pedido,
  ativo,
  ordem,
  entrega_gratis
)
values
  ('Porto - PI', 5.00, 70.00, true, 1, false),
  ('Nossa Senhora dos Remédios - PI', 10.00, 70.00, true, 2, false),
  ('Campo Largo - PI', 10.00, 70.00, true, 3, false)
on conflict (nome) do update
set taxa_entrega = excluded.taxa_entrega,
    valor_minimo_pedido = excluded.valor_minimo_pedido,
    ativo = excluded.ativo,
    ordem = excluded.ordem,
    entrega_gratis = excluded.entrega_gratis,
    updated_at = now();
