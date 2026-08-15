import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ESTOQUE_MINIMO_PADRAO,
  ESTOQUE_QUANTIDADE_PADRAO,
  ajustarQuantidadeEstoque,
  avaliarCompraProduto,
  normalizarConfiguracaoEstoque,
  obterSituacaoEstoque,
  produtoBloqueadoPorEstoque,
  produtoDisponivelParaCompra,
} from '../src/lib/estoque-produto.mjs'

const produto = (sobrescritas = {}) => ({
  id: 'produto-1',
  nome: 'Produto teste',
  disponivel: true,
  estoque_quantidade: 10,
  estoque_minimo: 3,
  bloquear_venda_sem_estoque: true,
  ...sobrescritas,
})

test('produto criado com estoque preserva quantidade, limite e bloqueio', () => {
  assert.deepEqual(
    normalizarConfiguracaoEstoque({
      estoque_quantidade: 12,
      estoque_minimo: 4,
      bloquear_venda_sem_estoque: true,
    }),
    {
      estoque_quantidade: 12,
      estoque_minimo: 4,
      bloquear_venda_sem_estoque: true,
    },
  )
})

test('produto criado sem configuracao usa defaults retrocompativeis', () => {
  assert.deepEqual(normalizarConfiguracaoEstoque({}), {
    estoque_quantidade: ESTOQUE_QUANTIDADE_PADRAO,
    estoque_minimo: ESTOQUE_MINIMO_PADRAO,
    bloquear_venda_sem_estoque: false,
  })
  assert.equal(ESTOQUE_QUANTIDADE_PADRAO, 0)
  assert.equal(ESTOQUE_MINIMO_PADRAO, 5)
})

test('aumenta, diminui e zera estoque sem arredondamento implícito', () => {
  assert.equal(ajustarQuantidadeEstoque(12, 3), 15)
  assert.equal(ajustarQuantidadeEstoque(12, -2), 10)
  assert.equal(ajustarQuantidadeEstoque(12, -12), 0)
})

test('rejeita quantidade negativa, fracionada ou não numérica', () => {
  assert.throws(() => ajustarQuantidadeEstoque(2, -3), /negativ/i)
  assert.throws(() => ajustarQuantidadeEstoque(2, 0.5), /inteir/i)
  assert.throws(
    () => normalizarConfiguracaoEstoque({ estoque_quantidade: 'abc' }),
    /quantidade/i,
  )
  assert.throws(
    () => normalizarConfiguracaoEstoque({ estoque_minimo: -1 }),
    /mínimo|negativ/i,
  )
})

test('deriva em estoque, baixo e esgotado sem persistir status', () => {
  assert.equal(obterSituacaoEstoque(produto({ estoque_quantidade: 8 })), 'em_estoque')
  assert.equal(obterSituacaoEstoque(produto({ estoque_quantidade: 3 })), 'baixo')
  assert.equal(obterSituacaoEstoque(produto({ estoque_quantidade: 1 })), 'baixo')
  assert.equal(obterSituacaoEstoque(produto({ estoque_quantidade: 0 })), 'esgotado')
})

test('zero com bloqueio ativo fica esgotado e indisponível', () => {
  const item = produto({ estoque_quantidade: 0, bloquear_venda_sem_estoque: true })
  assert.equal(produtoBloqueadoPorEstoque(item), true)
  assert.equal(produtoDisponivelParaCompra(item), false)
  assert.deepEqual(avaliarCompraProduto(item, 0, 1), {
    permitido: false,
    quantidadeMaxima: 0,
    motivo: 'Produto esgotado',
  })
})

test('zero com bloqueio desativado continua disponível e sem limite físico', () => {
  const item = produto({ estoque_quantidade: 0, bloquear_venda_sem_estoque: false })
  assert.equal(produtoBloqueadoPorEstoque(item), false)
  assert.equal(produtoDisponivelParaCompra(item), true)
  assert.deepEqual(avaliarCompraProduto(item, 20, 5), {
    permitido: true,
    quantidadeMaxima: null,
    motivo: null,
  })
})

test('produto comercialmente oculto não pode ser comprado mesmo com estoque', () => {
  const item = produto({ disponivel: false, estoque_quantidade: 20 })
  assert.equal(produtoDisponivelParaCompra(item), false)
  assert.match(avaliarCompraProduto(item, 0, 1).motivo, /indisponível/i)
})

test('bloqueio ativo respeita saldo considerando itens já no carrinho', () => {
  const item = produto({ estoque_quantidade: 3, bloquear_venda_sem_estoque: true })
  assert.equal(avaliarCompraProduto(item, 1, 2).permitido, true)
  assert.deepEqual(avaliarCompraProduto(item, 2, 2), {
    permitido: false,
    quantidadeMaxima: 3,
    motivo: 'Há somente 1 unidade disponível',
  })
})

test('Admin, Estoque, site e pedido derivam a mesma situação do mesmo produto', () => {
  const compartilhado = produto({ estoque_quantidade: 2, estoque_minimo: 2 })
  const estados = ['admin', 'estoque', 'site', 'pedido'].map(() => ({
    situacao: obterSituacaoEstoque(compartilhado),
    disponivel: produtoDisponivelParaCompra(compartilhado),
  }))
  assert.deepEqual(new Set(estados.map(JSON.stringify)).size, 1)
  assert.deepEqual(estados[0], { situacao: 'baixo', disponivel: true })
})

test('objeto antigo sem campos de estoque permanece vendável por compatibilidade', () => {
  const legado = { id: 'legado', nome: 'Produto legado', disponivel: true }
  assert.equal(obterSituacaoEstoque(legado), 'esgotado')
  assert.equal(produtoBloqueadoPorEstoque(legado), false)
  assert.equal(produtoDisponivelParaCompra(legado), true)
})
