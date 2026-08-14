-- Tabelas de caixa, finanças, crediário e produtividade.
-- Fonte: Supabase Management API em 2026-07-28. Nenhuma linha de dados é incluída.

create table public.caixa_automacao_config (
  id uuid default gen_random_uuid() not null,
  singleton boolean default true not null,
  ativo boolean default false not null,
  timezone text default 'America/Sao_Paulo'::text not null,
  horario_abertura time without time zone default '10:00:00'::time without time zone not null,
  horario_fechamento time without time zone default '23:00:00'::time without time zone not null,
  dias_ativos smallint[] default ARRAY[0::smallint, 1::smallint, 2::smallint, 3::smallint, 4::smallint, 5::smallint, 6::smallint] not null,
  responsavel_padrao character varying,
  valor_abertura_padrao numeric default 0 not null,
  auto_sincronizar_pedidos boolean default true not null,
  fechar_com_saldo_esperado boolean default true not null,
  ultimo_dia_abertura character varying,
  ultimo_dia_fechamento character varying,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.caixas (
  id uuid default gen_random_uuid() not null,
  data_abertura timestamp with time zone not null,
  data_fechamento timestamp with time zone,
  valor_abertura numeric(10,2) default 0,
  valor_fechamento numeric(10,2),
  total_entradas numeric(10,2) default 0,
  total_saidas numeric(10,2) default 0,
  saldo_esperado numeric(10,2) default 0,
  diferenca numeric(10,2),
  responsavel_abertura character varying(255),
  responsavel_fechamento character varying(255),
  observacoes text,
  status character varying(20) default 'aberto'::character varying,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  fechamento_formas jsonb
);

create table public.categorias_caixa (
  id uuid default gen_random_uuid() not null,
  nome character varying(100) not null,
  tipo character varying(20) not null,
  descricao text,
  ativo boolean default true,
  cor character varying(7),
  icone character varying(50),
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.crediario_contas (
  id uuid default gen_random_uuid() not null,
  cliente_id uuid,
  cliente_nome text not null,
  cliente_chave text not null,
  telefone text,
  status text default 'aberto'::text not null,
  saldo_atual numeric(12,2) default 0 not null,
  limite_credito numeric(12,2),
  observacoes text,
  origem text default 'manual'::text not null,
  legado_id uuid,
  legado_firebase_id text,
  metadata jsonb default '{}'::jsonb not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  atualizado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  quitado_em timestamp with time zone
);

create table public.crediario_movimentos (
  id uuid default gen_random_uuid() not null,
  conta_id uuid not null,
  pedido_id uuid,
  tipo text not null,
  status text default 'ativo'::text not null,
  valor numeric(12,2) not null,
  descricao text,
  itens jsonb,
  origem text default 'manual'::text not null,
  legado_id uuid,
  legado_order_id uuid,
  legado_firebase_id text,
  realizado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  criado_por text,
  metadata jsonb default '{}'::jsonb not null
);

create table public.financas_diarias (
  id uuid default gen_random_uuid() not null,
  data_referencia date not null,
  nome_pessoa text not null,
  funcionario_id uuid,
  valor numeric(12,2) not null,
  forma_pagamento text,
  observacoes text,
  movimentacao_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.movimentacoes_caixa (
  id uuid default gen_random_uuid() not null,
  caixa_id uuid,
  categoria_id uuid,
  funcionario_id uuid,
  pedido_id uuid,
  tipo character varying(50) not null,
  valor numeric(10,2) not null,
  descricao text,
  forma_pagamento character varying(50),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.pagamentos_entregadores (
  id uuid default gen_random_uuid() not null,
  entregador_id uuid not null,
  data_referencia date not null,
  total_devido numeric(10,2) default 0 not null,
  total_entregas integer default 0 not null,
  valor_pago numeric(10,2) default 0 not null,
  status character varying(20) default 'pendente'::character varying not null,
  metodo_pagamento character varying(50),
  observacoes text,
  data_pagamento timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.produtividade_config (
  chave text not null,
  valor numeric not null,
  atualizado_em timestamp with time zone default now() not null
);


