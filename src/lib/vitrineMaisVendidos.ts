export const CHAVE_MAIS_VENDIDOS_VITRINE = 'vitrine_produtos_mais_vendidos'

export type ModoMaisVendidos = 'automatico' | 'manual'

export type ConfiguracaoMaisVendidos = {
  ativo: boolean
  modo: ModoMaisVendidos
  quantidade: number
  produtoIds: string[]
}

export const CONFIGURACAO_MAIS_VENDIDOS_PADRAO: ConfiguracaoMaisVendidos = {
  ativo: true,
  modo: 'automatico',
  quantidade: 6,
  produtoIds: [],
}

const limitarQuantidade = (valor: unknown) => {
  const quantidade = Number(valor)
  if (!Number.isInteger(quantidade)) {
    return CONFIGURACAO_MAIS_VENDIDOS_PADRAO.quantidade
  }
  return Math.min(12, Math.max(4, quantidade))
}

export const normalizarConfiguracaoMaisVendidos = (
  valor: string | null | undefined,
): ConfiguracaoMaisVendidos => {
  if (!valor) return CONFIGURACAO_MAIS_VENDIDOS_PADRAO

  try {
    const configuracao = JSON.parse(valor) as Record<string, unknown>
    const produtoIds = Array.isArray(configuracao.produtoIds)
      ? Array.from(
          new Set(
            configuracao.produtoIds.filter(
              (produtoId): produtoId is string =>
                typeof produtoId === 'string' && produtoId.trim().length > 0,
            ),
          ),
        ).slice(0, 12)
      : []

    return {
      ativo: configuracao.ativo !== false,
      modo: configuracao.modo === 'manual' ? 'manual' : 'automatico',
      quantidade: limitarQuantidade(configuracao.quantidade),
      produtoIds,
    }
  } catch {
    return CONFIGURACAO_MAIS_VENDIDOS_PADRAO
  }
}
