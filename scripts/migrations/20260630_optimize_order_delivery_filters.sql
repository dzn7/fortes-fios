create extension if not exists pg_trgm;

create index if not exists idx_pedidos_created_at_id
  on public.pedidos (created_at desc, id desc);

create index if not exists idx_pedidos_status_created_at_id
  on public.pedidos (status, created_at desc, id desc);

create index if not exists idx_pedidos_tipo_created_at_id
  on public.pedidos (tipo_entrega, created_at desc, id desc);

create index if not exists idx_pedidos_nome_cliente_trgm
  on public.pedidos using gin (nome_cliente gin_trgm_ops);

create index if not exists idx_pedidos_telefone_trgm
  on public.pedidos using gin (telefone gin_trgm_ops);

create index if not exists idx_entregas_created_at_id
  on public.entregas (created_at desc, id desc);

create index if not exists idx_entregas_status_created_at_id
  on public.entregas (status, created_at desc, id desc);

create index if not exists idx_pagamentos_entregadores_status_data
  on public.pagamentos_entregadores (status, data_referencia desc);

create index if not exists idx_pagamentos_entregadores_data_id
  on public.pagamentos_entregadores (data_referencia desc, id desc);
