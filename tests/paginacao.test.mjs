import test from 'node:test'
import assert from 'node:assert/strict'

import {
  fatiarPagina,
  janelaDePaginas,
  normalizarPagina,
  totalDePaginas,
} from '../src/lib/paginacao.mjs'

const lista = (n) => Array.from({ length: n }, (_, i) => `p${i}`)

test('totalDePaginas arredonda para cima', () => {
  assert.equal(totalDePaginas(505, 24), 22)
  assert.equal(totalDePaginas(24, 24), 1)
  assert.equal(totalDePaginas(25, 24), 2)
})

test('lista vazia não tem página nenhuma', () => {
  assert.equal(totalDePaginas(0, 24), 0)
})

test('entrada inválida em totalDePaginas não lança', () => {
  for (const lixo of [null, undefined, 'x', -5, NaN]) {
    assert.equal(totalDePaginas(lixo, 24), 0)
  }
  assert.equal(totalDePaginas(10, 0), 0)
})

test('normalizarPagina prende no intervalo', () => {
  assert.equal(normalizarPagina(0, 22), 1)
  assert.equal(normalizarPagina(-3, 22), 1)
  assert.equal(normalizarPagina(23, 22), 22)
  assert.equal(normalizarPagina(7, 22), 7)
})

test('sem páginas, normalizarPagina devolve 1', () => {
  assert.equal(normalizarPagina(5, 0), 1)
})

test('fatiarPagina devolve a fatia e os índices 1-based', () => {
  const r = fatiarPagina(lista(505), 2, 24)
  assert.equal(r.visiveis.length, 24)
  assert.equal(r.visiveis[0], 'p24')
  assert.equal(r.primeiro, 25)
  assert.equal(r.ultimo, 48)
})

test('a última página devolve o resto, não um bloco cheio', () => {
  const r = fatiarPagina(lista(505), 22, 24)
  assert.equal(r.visiveis.length, 505 - 21 * 24)
  assert.equal(r.ultimo, 505)
})

test('fatiarPagina com entrada inválida devolve vazio', () => {
  for (const lixo of [null, undefined, 'texto', 42, {}]) {
    const r = fatiarPagina(lixo, 1, 24)
    assert.deepEqual(r.visiveis, [])
    assert.equal(r.primeiro, 0)
    assert.equal(r.ultimo, 0)
  }
})

test('página fora do intervalo é corrigida antes de fatiar', () => {
  const r = fatiarPagina(lista(30), 99, 24)
  assert.equal(r.visiveis.length, 6)
  assert.equal(r.primeiro, 25)
})

/* A janela de páginas — a lógica que vivia presa dentro de PaginacaoPedidos.tsx. */

test('até 7 páginas lista todas, sem elipse', () => {
  assert.deepEqual(janelaDePaginas(3, 7), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(janelaDePaginas(1, 1), [1])
})

test('perto do começo, elipse só no fim', () => {
  const j = janelaDePaginas(2, 22)
  assert.deepEqual(j, [1, 2, 3, 4, 5, 'fim-ellipsis', 22])
})

test('perto do fim, elipse só no começo', () => {
  const j = janelaDePaginas(21, 22)
  assert.deepEqual(j, [1, 'inicio-ellipsis', 18, 19, 20, 21, 22])
})

test('no meio, elipse dos dois lados e a página atual no centro', () => {
  const j = janelaDePaginas(11, 22)
  assert.deepEqual(j, [1, 'inicio-ellipsis', 10, 11, 12, 'fim-ellipsis', 22])
})

/*
 * Invariante, e não caso isolado: qualquer combinação precisa produzir uma
 * janela sem número repetido, dentro do intervalo, contendo a página atual e a
 * primeira e a última. Foi assim que a versão do Admin foi conferida.
 */
test('a janela é sempre válida para toda combinação até 60 páginas', () => {
  for (let total = 1; total <= 60; total += 1) {
    for (let atual = 1; atual <= total; atual += 1) {
      const janela = janelaDePaginas(atual, total)
      const numeros = janela.filter((i) => typeof i === 'number')

      assert.equal(new Set(numeros).size, numeros.length, `repetiu em ${atual}/${total}`)
      assert.ok(numeros.every((n) => n >= 1 && n <= total), `fora do intervalo em ${atual}/${total}`)
      assert.ok(numeros.includes(atual), `não contém a atual em ${atual}/${total}`)
      assert.ok(numeros.includes(1), `não contém a primeira em ${atual}/${total}`)
      assert.ok(numeros.includes(total), `não contém a última em ${atual}/${total}`)
      assert.deepEqual([...numeros].sort((a, b) => a - b), numeros, `fora de ordem em ${atual}/${total}`)
    }
  }
})
