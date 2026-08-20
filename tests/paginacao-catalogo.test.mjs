import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TAMANHO_LOTE_CATALOGO,
  fatiarCatalogo,
  proximoLimite,
} from '../src/lib/paginacao-catalogo.mjs'

/*
 * O catálogo tem 505 produtos disponíveis e a aba "Todos" montava os 505 de uma
 * vez: 505 <article>, 505 <img> com srcset de 15 URLs, 505 raízes de Dialog.
 * Peso de main thread, não de rede — é a rolagem travada no celular.
 */

const lista = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }))

test('lista menor que o lote sai inteira e marca que acabou', () => {
  const r = fatiarCatalogo(lista(5), TAMANHO_LOTE_CATALOGO)
  assert.equal(r.visiveis.length, 5)
  assert.equal(r.temMais, false)
  assert.equal(r.restantes, 0)
})

test('lista maior que o lote sai cortada e marca que há mais', () => {
  const total = TAMANHO_LOTE_CATALOGO + 17
  const r = fatiarCatalogo(lista(total), TAMANHO_LOTE_CATALOGO)
  assert.equal(r.visiveis.length, TAMANHO_LOTE_CATALOGO)
  assert.equal(r.temMais, true)
  assert.equal(r.restantes, 17)
})

test('lista do tamanho exato do lote não promete mais nada', () => {
  const r = fatiarCatalogo(lista(TAMANHO_LOTE_CATALOGO), TAMANHO_LOTE_CATALOGO)
  assert.equal(r.temMais, false)
  assert.equal(r.restantes, 0)
})

test('o corte preserva a ordem que chegou', () => {
  const r = fatiarCatalogo(lista(100), 10)
  assert.deepEqual(
    r.visiveis.map((p) => p.id),
    ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'],
  )
})

test('entrada inválida não derruba a tela', () => {
  for (const lixo of [null, undefined, 'texto', 42, {}]) {
    const r = fatiarCatalogo(lixo, 10)
    assert.deepEqual(r.visiveis, [])
    assert.equal(r.temMais, false)
  }
})

test('limite cresce de lote em lote e para no total', () => {
  assert.equal(proximoLimite(24, 100, 24), 48)
  assert.equal(proximoLimite(96, 100, 24), 100)
  assert.equal(proximoLimite(100, 100, 24), 100)
})

test('limite nunca fica abaixo de um lote', () => {
  assert.equal(proximoLimite(0, 100, 24), 24)
  assert.equal(proximoLimite(-5, 100, 24), 24)
})
