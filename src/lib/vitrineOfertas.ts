export const CHAVE_OFERTAS_VITRINE = 'vitrine_produtos_ofertas'

export type ConfiguracaoOfertas = {
  ativo: boolean
  quantidade: number
  produtoIds: string[]
}

export const CONFIGURACAO_OFERTAS_PADRAO: ConfiguracaoOfertas = {
  ativo: false,
  quantidade: 6,
  produtoIds: [],
}

const limitarQuantidade = (valor: unknown) => {
  const quantidade = Number(valor)
  if (!Number.isInteger(quantidade)) {
    return CONFIGURACAO_OFERTAS_PADRAO.quantidade
  }
  return Math.min(12, Math.max(2, quantidade))
}

export const normalizarConfiguracaoOfertas = (
  valor: string | null | undefined,
): ConfiguracaoOfertas => {
  if (!valor) return CONFIGURACAO_OFERTAS_PADRAO

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
      ativo: configuracao.ativo === true,
      quantidade: limitarQuantidade(configuracao.quantidade),
      produtoIds,
    }
  } catch {
    return CONFIGURACAO_OFERTAS_PADRAO
  }
}
