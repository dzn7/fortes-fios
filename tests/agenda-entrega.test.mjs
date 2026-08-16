import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRAZO_ENTREGA_PADRAO,
  descreverPrazoEntrega,
  entregaTodosOsDias,
} from '../src/lib/agenda-entrega.mjs'

// domingo, para os cálculos abaixo terem referência estável
const REFERENCIA = new Date('2026-08-16T15:00:00.000Z')

// 1. o caso do Porto: entrega todo dia
test('cidade que entrega todos os dias promete prazo, não data', () => {
  const prazo = descreverPrazoEntrega([0, 1, 2, 3, 4, 5, 6], REFERENCIA)

  assert.equal(prazo.ehData, false)
  assert.equal(prazo.texto, PRAZO_ENTREGA_PADRAO)
  assert.match(prazo.texto, /24 horas/)
})

test('entregaTodosOsDias reconhece a semana completa e só ela', () => {
  assert.equal(entregaTodosOsDias([0, 1, 2, 3, 4, 5, 6]), true)
  assert.equal(entregaTodosOsDias([1, 2]), false)
  assert.equal(entregaTodosOsDias([2]), false)
})

// 2. sem cidade escolhida ainda é o prazo — nunca minutos
test('sem configuração de dias o prazo é o de 24 horas', () => {
  for (const entrada of [null, undefined, [], 'qualquer coisa', {}]) {
    const prazo = descreverPrazoEntrega(entrada, REFERENCIA)
    assert.equal(prazo.texto, PRAZO_ENTREGA_PADRAO)
    assert.equal(prazo.ehData, false)
  }
})

// 3. cidades de dia fixo continuam mostrando a data — já estava certo
test('cidade com dia fixo mostra a próxima data de entrega', () => {
  // Terça-feira, a partir de um domingo
  const prazo = descreverPrazoEntrega([2], REFERENCIA)

  assert.equal(prazo.ehData, true)
  assert.match(prazo.texto, /terça-feira/)
  assert.match(prazo.texto, /18 de agosto/)
  assert.ok(!prazo.texto.includes('24 horas'))
})

test('cidade com dois dias fixos aponta o mais próximo', () => {
  // Segunda e quinta, a partir de domingo → segunda
  const prazo = descreverPrazoEntrega([1, 4], REFERENCIA)

  assert.equal(prazo.ehData, true)
  assert.match(prazo.texto, /segunda-feira/)
})

// 4. nenhum caminho devolve minuto
test('nenhuma configuração produz estimativa em minutos', () => {
  for (const dias of [[0, 1, 2, 3, 4, 5, 6], [1], [2, 5], null, []]) {
    const prazo = descreverPrazoEntrega(dias, REFERENCIA)
    assert.ok(!/\bmin\b/.test(prazo.texto), `"${prazo.texto}" fala em minutos`)
  }
})
