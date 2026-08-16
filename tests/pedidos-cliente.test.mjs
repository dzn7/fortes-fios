import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STATUS_PEDIDO_CLIENTE,
  aparenciaStatusPedido,
  formatarDataPedido,
  normalizarPedidoConsulta,
  telefoneEhConsultavel,
} from '../src/lib/pedidos-cliente.mjs'

// 1. o ponto que derrubava a árvore: data inválida em `format()`
test('data inválida devolve texto, nunca lança', () => {
  for (const entrada of [null, undefined, '', 'não é data', '0000-00-00', {}, 42]) {
    assert.doesNotThrow(() => formatarDataPedido(entrada))
    assert.equal(typeof formatarDataPedido(entrada), 'string')
  }
})

test('data ISO com fuso é formatada em pt-BR', () => {
  const texto = formatarDataPedido('2026-08-16T13:38:03.718152+00:00')

  assert.match(texto, /16\/08\/2026/)
  assert.match(texto, /\d{2}:\d{2}/)
})

test('formato do Postgres com espaço no lugar do T também é aceito', () => {
  // Safari recusa `2026-08-16 13:38:03+00` no construtor de Date; Chrome aceita.
  // Normalizar aqui é o que impede a divergência entre navegadores.
  const texto = formatarDataPedido('2026-08-16 13:38:03+00')

  assert.match(texto, /16\/08\/2026/)
  assert.ok(!texto.toLowerCase().includes('invalid'))
})

// 2. status
test('todo status conhecido tem rótulo e classe de token', () => {
  for (const status of STATUS_PEDIDO_CLIENTE) {
    const aparencia = aparenciaStatusPedido(status)
    assert.ok(aparencia.rotulo)
    assert.ok(aparencia.classe)
  }
})

test('status desconhecido ou vazio não quebra a lista', () => {
  assert.ok(aparenciaStatusPedido(null).rotulo)
  assert.ok(aparenciaStatusPedido('inventado').rotulo)
  assert.ok(aparenciaStatusPedido(undefined).classe)
})

// 3. normalização do que a RPC devolve
test('pedido normalizado tem sempre total numérico e id', () => {
  const pedido = normalizarPedidoConsulta({
    id: 'abc',
    numero_pedido: null,
    total: '75.5',
    created_at: '2026-08-16T13:38:03+00:00',
    status: null,
  })

  assert.equal(pedido.total, 75.5)
  assert.equal(pedido.id, 'abc')
  assert.equal(typeof pedido.numeroExibicao, 'string')
})

test('linha sem id é descartada em vez de virar item fantasma', () => {
  assert.equal(normalizarPedidoConsulta({ total: 10 }), null)
  assert.equal(normalizarPedidoConsulta(null), null)
})

test('total inválido vira zero, não NaN na tela', () => {
  const pedido = normalizarPedidoConsulta({ id: 'a', total: 'abc' })
  assert.equal(pedido.total, 0)
})

// 4. a busca
test('telefone só é consultável com dígitos suficientes', () => {
  assert.equal(telefoneEhConsultavel('63981053014'), true)
  assert.equal(telefoneEhConsultavel('(63) 98105-3014'), true)
  assert.equal(telefoneEhConsultavel('6398105301'), true)
  assert.equal(telefoneEhConsultavel('123'), false)
  assert.equal(telefoneEhConsultavel(''), false)
  assert.equal(telefoneEhConsultavel(null), false)
  assert.equal(telefoneEhConsultavel('   '), false)
})
