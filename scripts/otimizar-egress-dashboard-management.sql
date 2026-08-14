-- Otimizacao de egress/compute (Management API) — 2026-07-19
-- Projeto: bawysvqqeqwxasmggfcn (edienai)
-- Seguro: indice aditivo + RPC STABLE somente leitura. Nao altera fluxo de pedidos.

CREATE INDEX IF NOT EXISTS idx_item_adicionais_item_pedido_id
  ON public.item_adicionais (item_pedido_id);

CREATE OR REPLACE FUNCTION public.estatisticas_pedidos_periodo(
  p_inicio timestamptz,
  p_fim timestamptz
)
RETURNS TABLE(total_pedidos bigint, receita numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total_pedidos,
    coalesce(sum(total), 0)::numeric AS receita
  FROM pedidos
  WHERE created_at >= p_inicio
    AND created_at <= p_fim
    AND status NOT IN ('cancelado', 'aguardando_pagamento');
$$;

GRANT EXECUTE ON FUNCTION public.estatisticas_pedidos_periodo(timestamptz, timestamptz)
  TO anon, authenticated, service_role;
