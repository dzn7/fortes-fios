-- Tabelas de catálogo, cardápio e configuração.
-- Fonte: Supabase Management API em 2026-07-28. Nenhuma linha de dados é incluída.

create table public.adicionais (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  preco numeric(10,2) not null,
  disponivel boolean default true,
  categoria character varying(100),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  imagem_url text
);

create table public.bairros (
  id uuid default gen_random_uuid() not null,
  nome character varying(100) not null,
  taxa_entrega numeric(10,2) default 3.00 not null,
  ativo boolean default true,
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  entrega_gratis boolean default false not null
);

create table public.bebidas (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  descricao text,
  preco numeric(10,2) not null,
  categoria character varying(100) not null,
  imagem_url text,
  disponivel boolean default true,
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  tamanho character varying
);

create table public.categorias_adicionais (
  id uuid default gen_random_uuid() not null,
  nome character varying(100) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.categorias_cardapio (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  tipo text not null,
  ativo boolean default true not null,
  ordem integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.combo_itens (
  id uuid default gen_random_uuid() not null,
  combo_id uuid not null,
  produto_id uuid,
  bebida_id uuid,
  quantidade integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.combos (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  descricao text,
  preco numeric(10,2) not null,
  imagem_url text,
  disponivel boolean default true,
  ordem integer default 0,
  destaque boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  preco_original numeric(10,2) default NULL::numeric,
  desconto_percentual integer
);

create table public.configuracoes_loja (
  id uuid default gen_random_uuid() not null,
  chave character varying(100) not null,
  valor text,
  tipo character varying(50) default 'string'::character varying,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.cupons (
  id uuid default gen_random_uuid() not null,
  codigo character varying(50) not null,
  nome character varying(255) not null,
  descricao text,
  ativo boolean default true not null,
  tipo_desconto character varying(20) default 'percentual'::character varying not null,
  valor_desconto numeric(10,2) default 0 not null,
  pedido_minimo numeric(10,2) default 0 not null,
  limite_desconto numeric(10,2),
  uso_maximo_total integer,
  uso_maximo_por_cliente integer,
  uso_unico boolean default false not null,
  total_usos integer default 0 not null,
  aplica_em character varying(20) default 'pedido'::character varying not null,
  produto_id uuid,
  combo_id uuid,
  validade_inicio timestamp with time zone,
  validade_fim timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.cupons_usos (
  id uuid default gen_random_uuid() not null,
  cupom_id uuid not null,
  pedido_id uuid not null,
  telefone_cliente character varying(20),
  valor_desconto numeric(10,2) default 0 not null,
  valor_frete_descontado numeric(10,2) default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.formas_pagamento (
  id uuid default gen_random_uuid() not null,
  codigo character varying not null,
  nome character varying not null,
  descricao text,
  tipo_taxa character varying default 'nenhuma'::character varying not null,
  valor_taxa numeric(10,2) default 0 not null,
  ativo boolean default true not null,
  visivel_cliente boolean default true not null,
  aceita_troco boolean default false not null,
  ordem integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.produto_adicionais (
  id uuid default gen_random_uuid() not null,
  produto_id uuid not null,
  adicional_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.produtos (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  descricao text,
  preco numeric(10,2) not null,
  categoria character varying(100) not null,
  imagem_url text,
  disponivel boolean default true,
  destaque boolean default false,
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  preco_original numeric,
  desconto numeric
);


