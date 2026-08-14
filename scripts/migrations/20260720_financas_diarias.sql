-- Diárias em Finanças: tabela + categoria de despesa.
-- Projeto: bawysvqqeqwxasmggfcn

insert into public.categorias_caixa (nome, tipo, cor, icone, ativo, ordem)
select 'Diária', 'saida', '#FF5151', 'Users', true, 90
where not exists (
  select 1 from public.categorias_caixa where lower(nome) = 'diária' and tipo = 'saida'
);

create table if not exists public.financas_diarias (
  id uuid primary key default gen_random_uuid(),
  data_referencia date not null,
  nome_pessoa text not null check (char_length(trim(nome_pessoa)) > 0),
  funcionario_id uuid null references public.funcionarios(id) on delete set null,
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text null,
  observacoes text null,
  movimentacao_id uuid not null references public.movimentacoes_caixa(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financas_diarias_data_referencia_idx
  on public.financas_diarias (data_referencia);

create index if not exists financas_diarias_movimentacao_id_idx
  on public.financas_diarias (movimentacao_id);

create index if not exists financas_diarias_funcionario_id_idx
  on public.financas_diarias (funcionario_id)
  where funcionario_id is not null;

grant select, insert, update, delete on table public.financas_diarias to anon, authenticated, service_role;
