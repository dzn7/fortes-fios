-- Tabelas de operação, pedidos, identidade e impressão.
-- Fonte: Supabase Management API em 2026-07-28. Nenhuma linha de dados é incluída.

create table public.admin_sidebar_config (
  usuario_sistema_id uuid not null,
  config jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table public.anotacoes_painel (
  id uuid default gen_random_uuid() not null,
  titulo character varying(255) not null,
  conteudo text,
  cor character varying(50) default 'amarelo'::character varying,
  categoria character varying(50) default 'geral'::character varying,
  prioridade character varying(20) default 'media'::character varying,
  concluida boolean default false,
  fixada boolean default false,
  ordem integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.atividade_garcom (
  id uuid default gen_random_uuid() not null,
  garcom_id uuid not null,
  tipo_acao character varying not null,
  pedido_id uuid,
  item_pedido_id uuid,
  descricao text,
  dados_extra jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.entregas (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  entregador_id uuid,
  status character varying(50) default 'pendente'::character varying,
  endereco_entrega text,
  bairro character varying(100),
  taxa_entrega numeric(10,2) default 0,
  tempo_estimado integer,
  tempo_real integer,
  distancia_km numeric(10,2),
  observacoes text,
  data_saida timestamp with time zone,
  data_entrega timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  excluida_repasse boolean default false not null
);

create table public.fila_impressao (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  status character varying(20) default 'pendente'::character varying,
  tentativas integer default 0,
  erro text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  tipo character varying(20) default 'cozinha'::character varying,
  erro_mensagem text,
  criado_em timestamp with time zone default timezone('utc'::text, now()),
  processado_em timestamp with time zone,
  impresso_em timestamp with time zone,
  escopo character varying(30) default 'pedido_completo'::character varying not null,
  itens_snapshot jsonb,
  pedido_snapshot jsonb,
  origem character varying(60),
  hash_evento character varying(120),
  automatico boolean default true not null
);

create table public.funcionarios (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  telefone character varying(20),
  tipo character varying(50) not null,
  ativo boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  recebe_mensagem boolean default true,
  cargo character varying(100)
);

create table public.item_adicionais (
  id uuid default gen_random_uuid() not null,
  item_pedido_id uuid not null,
  adicional_id uuid,
  nome character varying(255) not null,
  preco numeric(10,2) not null,
  quantidade integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.itens_pedido (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  produto_id uuid,
  bebida_id uuid,
  combo_id uuid,
  nome_item character varying(255) not null,
  quantidade integer default 1,
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  observacoes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  nome_produto character varying(255),
  preco_total numeric,
  adicionado_por_garcom_id uuid,
  subtotal_original numeric,
  desconto_manual numeric default 0 not null
);

create table public.mesas (
  id uuid default gen_random_uuid() not null,
  numero integer not null,
  status character varying(50) default 'livre'::character varying,
  nome_cliente character varying(255),
  ocupada_em timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  capacidade integer default 4,
  tempo_limite_minutos integer default 90,
  liberar_em timestamp with time zone,
  pedido_id uuid,
  observacoes text,
  tipo character varying(20) default 'mesa'::character varying not null,
  codigo_qr text not null,
  identificador text,
  qr_ativo boolean default true
);

create table public.notification_preferences (
  id uuid default gen_random_uuid() not null,
  user_id character varying(255) not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  enabled boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  notifications_enabled boolean default true,
  push_enabled boolean default true,
  sound_enabled boolean default true,
  new_order_notifications boolean default true,
  status_change_notifications boolean default true
);

create table public.pagamentos_online (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  provedor character varying default 'mercado_pago'::character varying not null,
  external_reference character varying not null,
  mercado_pago_payment_id character varying,
  status character varying default 'pendente'::character varying not null,
  status_detalhe text,
  valor numeric not null,
  qr_code text,
  qr_code_base64 text,
  qr_code_ticket_url text,
  payload_criacao jsonb,
  payload_atualizacao jsonb,
  ultima_verificacao_em timestamp with time zone,
  pago_em timestamp with time zone,
  expira_em timestamp with time zone,
  aprovado_processado boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.pagamentos_pedido (
  id uuid default gen_random_uuid() not null,
  pedido_id uuid not null,
  forma_pagamento character varying(50) not null,
  valor numeric(10,2) not null,
  troco_para numeric(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  troco numeric,
  bandeira character varying,
  nsu character varying,
  itens_pagos jsonb default '[]'::jsonb not null
);

create table public.pedidos (
  id uuid default gen_random_uuid() not null,
  numero_pedido integer not null,
  nome_cliente character varying(255) not null,
  telefone character varying(20),
  tipo_entrega character varying(50) not null,
  endereco_entrega text,
  bairro character varying(100),
  taxa_entrega numeric(10,2) default 0,
  forma_pagamento character varying(50),
  troco_para numeric(10,2),
  subtotal numeric(10,2) not null,
  total numeric(10,2) not null,
  status character varying(50) default 'pendente'::character varying,
  observacoes text,
  mesa_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  endereco text,
  complemento text,
  referencia text,
  mesa integer,
  cupom_id uuid,
  cupom_codigo character varying(50),
  tipo_desconto_cupom character varying(20),
  desconto_cupom numeric(10,2) default 0,
  desconto_frete numeric(10,2) default 0,
  comanda integer,
  taxa_servico numeric(10,2) default 0 not null,
  pagamento_online boolean default false not null,
  pagamento_online_status character varying default 'nao_aplicavel'::character varying not null,
  pagamento_online_pago_em timestamp with time zone,
  pagamento_online_gateway character varying,
  pagamento_online_referencia character varying,
  taxa_pagamento numeric(10,2) default 0 not null,
  origem text,
  garcom_id uuid,
  subtotal_original numeric,
  total_original numeric,
  desconto_itens_total numeric default 0 not null,
  desconto_manual numeric default 0 not null,
  cliente_id uuid
);

create table public.usuarios_cliente (
  id uuid default gen_random_uuid() not null,
  telefone text not null,
  nome text,
  primeiro_pedido_em timestamp with time zone,
  ultimo_pedido_em timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  endereco text,
  bairro text,
  complemento text
);

create table public.usuarios_sistema (
  id uuid default gen_random_uuid() not null,
  nome character varying(255) not null,
  nome_usuario character varying(100) not null,
  senha_hash text not null,
  papel character varying(20) not null,
  avatar_url text,
  cor_avatar character varying(7) default '#f97316'::character varying,
  ativo boolean default true,
  funcionario_id uuid,
  ultimo_acesso timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);


