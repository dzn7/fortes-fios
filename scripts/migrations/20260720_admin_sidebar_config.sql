create table if not exists public.admin_sidebar_config (
  usuario_sistema_id uuid primary key references public.usuarios_sistema(id) on delete cascade,
  config jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.admin_sidebar_config is
  'Preferências de sidebar do admin por usuário (ordem e visibilidade dos itens).';
