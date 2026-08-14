export const QUANTIDADE_PARCELAS_PADRAO = 3
export const QUANTIDADE_MINIMA_PARCELAS = 2
export const QUANTIDADE_MAXIMA_PARCELAS = 12

export const normalizarPercentualDesconto = (valor: string | number): number => {
  const percentual = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(percentual)) return 0
  return Math.min(100, Math.max(0, Math.round(percentual)))
}

export const calcularPrecoComDesconto = (
  precoOriginal: number,
  percentualDesconto: number,
): number => {
  const desconto = normalizarPercentualDesconto(percentualDesconto)
  if (desconto === 0) return Number(precoOriginal.toFixed(2))
  return Number((precoOriginal * (1 - desconto / 100)).toFixed(2))
}

export const normalizarQuantidadeParcelas = (
  quantidade: number | null | undefined,
): number => {
  if (typeof quantidade !== 'number' || !Number.isFinite(quantidade)) {
    return QUANTIDADE_PARCELAS_PADRAO
  }
  return Math.min(
    QUANTIDADE_MAXIMA_PARCELAS,
    Math.max(QUANTIDADE_MINIMA_PARCELAS, Math.round(quantidade || 0)),
  )
}

export const calcularValorParcelaProduto = (
  preco: number,
  quantidade: number | null | undefined,
): number =>
  Number(
    (
      Math.max(0, preco) / normalizarQuantidadeParcelas(quantidade)
    ).toFixed(2),
  )
