-- Coluna usada pelo admin de bairros e pelo checkout (ModalCarrinho).
-- Aplicada via Management API no projeto bawysvqqeqwxasmggfcn em 2026-07-20.
alter table public.bairros
  add column if not exists entrega_gratis boolean not null default false;
