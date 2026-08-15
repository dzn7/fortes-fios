export const ESTOQUE_QUANTIDADE_PADRAO = 0
export const ESTOQUE_MINIMO_PADRAO = 5

/**
 * @param {unknown} valor
 * @param {string} campo
 * @param {number} fallback
 */
const normalizarInteiroNaoNegativo = (valor, campo, fallback) => {
  if (valor === undefined || valor === null || valor === '') return fallback
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero) || !Number.isInteger(numero)) {
    throw new Error(`${campo} deve ser uma quantidade inteira.`)
  }
  if (numero < 0) {
    throw new Error(`${campo} não pode ser negativo.`)
  }
  return numero
}

/**
 * @param {{ estoque_quantidade?: unknown, estoque_minimo?: unknown, bloquear_venda_sem_estoque?: unknown }} configuracao
 */
export const normalizarConfiguracaoEstoque = (configuracao = {}) => ({
  estoque_quantidade: normalizarInteiroNaoNegativo(
    configuracao.estoque_quantidade,
    'A quantidade em estoque',
    ESTOQUE_QUANTIDADE_PADRAO,
  ),
  estoque_minimo: normalizarInteiroNaoNegativo(
    configuracao.estoque_minimo,
    'O estoque mínimo',
    ESTOQUE_MINIMO_PADRAO,
  ),
  bloquear_venda_sem_estoque: configuracao.bloquear_venda_sem_estoque === true,
})

/** @param {{ estoque_quantidade?: unknown, estoque_minimo?: unknown }} produto */
export const obterSituacaoEstoque = (produto) => {
  const { estoque_quantidade, estoque_minimo } = normalizarConfiguracaoEstoque(produto)
  if (estoque_quantidade === 0) return 'esgotado'
  if (estoque_quantidade <= estoque_minimo) return 'baixo'
  return 'em_estoque'
}

/** @param {{ estoque_quantidade?: unknown, bloquear_venda_sem_estoque?: unknown }} produto */
export const produtoBloqueadoPorEstoque = (produto) => {
  const configuracao = normalizarConfiguracaoEstoque(produto)
  return configuracao.bloquear_venda_sem_estoque && configuracao.estoque_quantidade === 0
}

/** @param {{ disponivel?: unknown, estoque_quantidade?: unknown, bloquear_venda_sem_estoque?: unknown }} produto */
export const produtoDisponivelParaCompra = (produto) =>
  produto?.disponivel !== false && !produtoBloqueadoPorEstoque(produto)

/**
 * @param {unknown} quantidadeAtual
 * @param {unknown} delta
 */
export const ajustarQuantidadeEstoque = (quantidadeAtual, delta) => {
  const atual = normalizarInteiroNaoNegativo(quantidadeAtual, 'A quantidade em estoque', 0)
  const ajuste = Number(delta)
  if (!Number.isFinite(ajuste) || !Number.isInteger(ajuste)) {
    throw new Error('O ajuste deve ser uma quantidade inteira.')
  }
  const proxima = atual + ajuste
  if (proxima < 0) throw new Error('A quantidade em estoque não pode ser negativa.')
  return proxima
}

/**
 * @param {{ disponivel?: unknown, estoque_quantidade?: unknown, bloquear_venda_sem_estoque?: unknown }} produto
 * @param {unknown} quantidadeAtualCarrinho
 * @param {unknown} quantidadeAdicionar
 */
export const avaliarCompraProduto = (produto, quantidadeAtualCarrinho = 0, quantidadeAdicionar = 1) => {
  const atualCarrinho = normalizarInteiroNaoNegativo(
    quantidadeAtualCarrinho,
    'A quantidade atual no carrinho',
    0,
  )
  const adicionar = normalizarInteiroNaoNegativo(
    quantidadeAdicionar,
    'A quantidade a adicionar',
    1,
  )
  const configuracao = normalizarConfiguracaoEstoque(produto)

  if (produto?.disponivel === false) {
    return { permitido: false, quantidadeMaxima: 0, motivo: 'Produto indisponível' }
  }

  if (!configuracao.bloquear_venda_sem_estoque) {
    return { permitido: true, quantidadeMaxima: null, motivo: null }
  }

  const restante = Math.max(0, configuracao.estoque_quantidade - atualCarrinho)
  if (adicionar <= restante) {
    return {
      permitido: true,
      quantidadeMaxima: configuracao.estoque_quantidade,
      motivo: null,
    }
  }

  return {
    permitido: false,
    quantidadeMaxima: configuracao.estoque_quantidade,
    motivo:
      configuracao.estoque_quantidade === 0
        ? 'Produto esgotado'
        : `Há somente ${restante} ${restante === 1 ? 'unidade disponível' : 'unidades disponíveis'}`,
  }
}
