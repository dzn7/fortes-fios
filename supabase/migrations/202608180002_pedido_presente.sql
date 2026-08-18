-- ---------------------------------------------------------------------------
-- Pedido marcado como presente.
--
-- Coluna própria, e não um texto dentro de `observacoes`: aviso escondido em
-- parágrafo não vira badge, não vira filtro e não vira contagem. Um booleano é
-- a diferença entre um dado que o sistema entende e um recado que alguém pode
-- deixar de ler.
--
-- `not null default false` para que os pedidos já existentes e todo INSERT que
-- não conhece o campo (PDV, garçom, bot) sigam válidos sem alteração.
--
-- Spec: specs/pedido-presente.md
-- ---------------------------------------------------------------------------

alter table public.pedidos
  add column if not exists presente boolean not null default false;

comment on column public.pedidos.presente is
  'Cliente marcou o pedido como presente no carrinho. Some na mensagem do WhatsApp e no card do admin.';

-- Índice parcial: presente é minoria, e a lista do admin filtra por "só
-- presentes" varrendo poucas linhas em vez da tabela inteira. Índice comum em
-- boolean com 99% de `false` não seria usado pelo planner.
create index if not exists pedidos_presente_idx
  on public.pedidos (created_at desc)
  where presente;

-- A loja pública escreve em `pedidos` pelo checkout (anon), então a coluna
-- precisa do mesmo grant das demais para o INSERT do carrinho não quebrar.
-- Não amplia superfície: `anon` já tem INSERT na tabela inteira (AGENTS §3.9).
