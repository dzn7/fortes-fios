-- Caixa operacional: Sangria/Suprimento + fechamento_formas + índice de extrato
-- Aplicar via Management API. Não contém secrets.

-- 1) Categorias operacionais
INSERT INTO categorias_caixa (nome, tipo, cor, icone, ativo, ordem)
SELECT 'Sangria', 'saida', '#EF4444', 'arrow-down-circle', true, 90
WHERE NOT EXISTS (SELECT 1 FROM categorias_caixa WHERE nome = 'Sangria');

INSERT INTO categorias_caixa (nome, tipo, cor, icone, ativo, ordem)
SELECT 'Suprimento', 'entrada', '#22C55E', 'arrow-up-circle', true, 91
WHERE NOT EXISTS (SELECT 1 FROM categorias_caixa WHERE nome = 'Suprimento');

-- 2) Detalhe de fechamento por forma (jsonb)
ALTER TABLE caixas
  ADD COLUMN IF NOT EXISTS fechamento_formas jsonb;

COMMENT ON COLUMN caixas.fechamento_formas IS
  'Snapshot do fechamento: { dinheiro: { esperado, contado }, pix: { esperado }, cartao: { esperado }, outros: { esperado } }';

-- 3) Índice para extrato da sessão (caixa_id + created_at)
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa_caixa_created
  ON movimentacoes_caixa (caixa_id, created_at DESC);
