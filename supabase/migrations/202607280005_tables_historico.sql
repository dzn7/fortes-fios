-- Tabelas de histórico anual e arquivamento.
-- Fonte: Supabase Management API em 2026-07-28. Nenhuma linha de dados é incluída.

create table public.historico_caixas (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  caixa_id_original uuid not null,
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
  status character varying(20),
  arquivado_em timestamp with time zone default timezone('America/Sao_Paulo'::text, now())
);

create table public.historico_entregas (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  historico_pedido_id uuid,
  entrega_id_original uuid,
  entregador_nome character varying(255),
  status character varying(50),
  endereco_entrega text,
  bairro character varying(100),
  taxa_entrega numeric(10,2) default 0,
  tempo_estimado integer,
  tempo_real integer,
  distancia_km numeric(10,2),
  observacoes text,
  data_saida timestamp with time zone,
  data_entrega timestamp with time zone,
  data_criacao timestamp with time zone
);

create table public.historico_item_adicionais (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  historico_item_id uuid,
  adicional_nome character varying(255) not null,
  preco numeric(10,2) not null,
  quantidade integer default 1
);

create table public.historico_itens_pedido (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  historico_pedido_id uuid,
  nome_item character varying(255) not null,
  quantidade integer default 1,
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  observacoes text
);

create table public.historico_movimentacoes_caixa (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  movimentacao_id_original uuid,
  caixa_id_original uuid,
  categoria_nome character varying(100),
  funcionario_nome character varying(255),
  tipo character varying(50) not null,
  valor numeric(10,2) not null,
  descricao text,
  forma_pagamento character varying(50),
  pedido_id_original uuid,
  data_movimentacao timestamp with time zone not null,
  arquivado_em timestamp with time zone default timezone('America/Sao_Paulo'::text, now())
);

create table public.historico_pedidos (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  pedido_id_original uuid not null,
  numero_pedido integer,
  nome_cliente character varying(255),
  telefone character varying(20),
  tipo_entrega character varying(50),
  endereco_entrega text,
  bairro character varying(100),
  taxa_entrega numeric(10,2) default 0,
  forma_pagamento character varying(50),
  subtotal numeric(10,2),
  total numeric(10,2),
  status character varying(50),
  observacoes text,
  data_pedido timestamp with time zone,
  arquivado_em timestamp with time zone default timezone('America/Sao_Paulo'::text, now())
);

create table public.resumo_anual (
  id uuid default gen_random_uuid() not null,
  ano integer not null,
  total_pedidos integer default 0,
  total_pedidos_entrega integer default 0,
  total_pedidos_retirada integer default 0,
  total_pedidos_local integer default 0,
  receita_total numeric(10,2) default 0,
  receita_entregas numeric(10,2) default 0,
  receita_retiradas numeric(10,2) default 0,
  receita_local numeric(10,2) default 0,
  ticket_medio numeric(10,2) default 0,
  total_entregas_realizadas integer default 0,
  total_taxas_entrega numeric(10,2) default 0,
  produto_mais_vendido character varying(255),
  produto_mais_vendido_qtd integer default 0,
  mes_mais_lucrativo integer,
  mes_mais_lucrativo_valor numeric(10,2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  total_movimentacoes_caixa integer default 0,
  total_entradas_caixa numeric default 0,
  total_saidas_caixa numeric default 0,
  data_arquivamento timestamp with time zone default timezone('America/Sao_Paulo'::text, now()),
  dados_completos boolean default false
);


