alter table public.bairros
  add column if not exists dias_entrega smallint[] not null
  default array[0, 1, 2, 3, 4, 5, 6]::smallint[];

alter table public.pedidos
  add column if not exists data_prevista_entrega date;

alter table public.entregas
  add column if not exists data_prevista_entrega date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bairros_dias_entrega_check'
      and conrelid = 'public.bairros'::regclass
  ) then
    alter table public.bairros
      add constraint bairros_dias_entrega_check
      check (
        cardinality(dias_entrega) > 0
        and dias_entrega <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
      );
  end if;
end
$$;

update public.bairros
set dias_entrega = case nome
  when 'Nossa Senhora dos Remédios - PI' then array[1]::smallint[]
  when 'Campo Largo - PI' then array[2]::smallint[]
  when 'Porto - PI' then array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  else dias_entrega
end,
updated_at = now()
where nome in (
  'Porto - PI',
  'Nossa Senhora dos Remédios - PI',
  'Campo Largo - PI'
);
