import test from 'node:test'
import assert from 'node:assert/strict'

import {
  pedidoUsouCupom,
  rotuloCupom,
  valorDescontadoCupom,
} from '../src/lib/cupom-pedido.mjs'

/*
 * Conferido em produção (2026-08-20): dos 11 pedidos, 4 usaram cupom, todos
 * `PRIMEIRACOMPRA`, e `desconto_cupom` guarda o valor em REAIS já calculado —
 * 40 − 2 = 38, 60 − 3 = 57, 48 − 2,4 = 45,6. Não é o percentual.
 */

test('pedido sem nenhum campo de cupom não usou cupom', () => {
  assert.equal(pedidoUsouCupom({ id: 'x' }), false)
  assert.equal(pedidoUsouCupom({ cupom_id: null, cupom_codigo: '', desconto_cupom: 0 }), false)
})

test('qualquer um dos três campos basta para dizer que usou', () => {
  assert.equal(pedidoUsouCupom({ cupom_id: 'abc' }), true)
  assert.equal(pedidoUsouCupom({ cupom_codigo: 'PRIMEIRACOMPRA' }), true)
  assert.equal(pedidoUsouCupom({ desconto_cupom: 2.73 }), true)
})

test('cupom que descontou zero ainda conta como usado', () => {
  assert.equal(pedidoUsouCupom({ cupom_codigo: 'FRETEGRATIS', desconto_cupom: 0 }), true)
})

test('entrada inválida não derruba a tela', () => {
  for (const lixo of [null, undefined, 'texto', 42]) {
    assert.equal(pedidoUsouCupom(lixo), false)
  }
})

test('o rótulo sai em caixa alta e aparado', () => {
  assert.equal(rotuloCupom({ cupom_codigo: '  primeiracompra ' }), 'PRIMEIRACOMPRA')
})

test('sem código, o rótulo é apenas Cupom', () => {
  for (const vazio of ['', '   ', null, undefined]) {
    assert.equal(rotuloCupom({ cupom_codigo: vazio, desconto_cupom: 5 }), 'Cupom')
  }
  assert.equal(rotuloCupom(null), 'Cupom')
})

test('valor em string é aceito — o PostgREST devolve numeric como texto', () => {
  assert.equal(valorDescontadoCupom({ desconto_cupom: '2.73' }), 2.73)
  assert.equal(valorDescontadoCupom({ desconto_cupom: 3 }), 3)
})

test('valor ausente, negativo ou inválido vira zero', () => {
  for (const lixo of [null, undefined, 'abc', -5, NaN, {}]) {
    assert.equal(valorDescontadoCupom({ desconto_cupom: lixo }), 0)
  }
  assert.equal(valorDescontadoCupom(null), 0)
})
