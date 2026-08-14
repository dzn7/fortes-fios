-- ============================================================================
-- Backfill: concluir pedidos de contas de crediário JÁ quitadas.
--
-- Contexto
--   Antes de 20260724_crediario_concluir_pedidos.sql, quitar a conta não
--   escrevia em `pedidos`. Estes pedidos foram pagos, mas seguem marcados
--   com forma de pagamento de crediário no card.
--
-- Segurança
--   - Só toca pedidos cujo consumo está ATIVO numa conta com status 'quitado'.
--   - `pedido_usa_crediario(p.forma_pagamento)` torna o script idempotente:
--     rodar de novo não altera mais nada.
--   - O trigger `sincronizar_pedido_crediario` dispara em cada linha, mas a
--     guarda adicionada na migration anterior impede o cancelamento do consumo
--     (que negativaria o saldo da conta).
-- ============================================================================

with atualizados as (
  update public.pedidos p
  set forma_pagamento = 'Concluído',
      updated_at = timezone('utc'::text, now())
  from public.crediario_movimentos m
  join public.crediario_contas c on c.id = m.conta_id
  where m.pedido_id = p.id
    and m.origem = 'pedido'
    and m.tipo = 'consumo'
    and m.status = 'ativo'
    and c.status = 'quitado'
    and public.pedido_usa_crediario(p.forma_pagamento)
  returning p.id
)
select count(*) as pedidos_concluidos from atualizados;
