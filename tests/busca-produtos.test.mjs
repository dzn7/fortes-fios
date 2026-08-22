import test from 'node:test'
import assert from 'node:assert/strict'

import { LIMITE_RESULTADOS, TERMO_MINIMO, buscarProdutos } from '../src/lib/busca-produtos.mjs'

const p = (id, nome, extras = {}) => ({
  id,
  nome,
  descricao: '',
  categoria: 'Geral',
  disponivel: true,
  ...extras,
})

const catalogo = [
  p('1', 'Creme de Pentear Toque Final'),
  p('2', 'Shampoo Hidratante'),
  p('3', 'Máscara de Nutrição', { descricao: 'Com óleo de argan e shampoo suave' }),
  p('4', 'Condicionador', { categoria: 'Shampoo e condicionador' }),
  p('5', 'Shampoo Anticaspa'),
]

test('termo curto demais não busca', () => {
  for (const curto of ['', ' ', 'a', ' s ']) {
    assert.deepEqual(buscarProdutos(catalogo, curto).itens, [])
  }
  assert.ok(TERMO_MINIMO >= 2)
})

test('acento e caixa são ignorados', () => {
  assert.equal(buscarProdutos(catalogo, 'mascara').itens[0].id, '3')
  assert.equal(buscarProdutos(catalogo, 'MÁSCARA').itens[0].id, '3')
  assert.equal(buscarProdutos(catalogo, 'oleo').itens[0].id, '3')
})

test('nome que começa com o termo vem antes de nome que só contém', () => {
  const itens = buscarProdutos(catalogo, 'shampoo').itens
  const posicao = (id) => itens.findIndex((item) => item.id === id)

  // 2 e 5 começam com "Shampoo"; 4 casa pela categoria; 3 só pela descrição.
  assert.ok(posicao('2') < posicao('4'), 'nome-prefixo deveria vir antes de categoria')
  assert.ok(posicao('5') < posicao('4'), 'nome-prefixo deveria vir antes de categoria')
  assert.ok(posicao('4') < posicao('3'), 'categoria deveria vir antes de descrição')
})

test('empate no mesmo nível preserva a ordem do catálogo', () => {
  const itens = buscarProdutos(catalogo, 'shampoo').itens
  const posicao = (id) => itens.findIndex((item) => item.id === id)
  assert.ok(posicao('2') < posicao('5'), 'a ordem do catálogo deveria desempatar')
})

test('nome vence descrição mesmo quando a descrição casa primeiro na lista', () => {
  const lista = [
    p('a', 'Ampola', { descricao: 'ideal depois do shampoo' }),
    p('b', 'Shampoo Neutro'),
  ]
  assert.equal(buscarProdutos(lista, 'shampoo').itens[0].id, 'b')
})

test('o limite corta os desenhados, o total conta todos', () => {
  const muitos = Array.from({ length: 60 }, (_, i) => p(String(i), `Shampoo ${i}`))
  const resultado = buscarProdutos(muitos, 'shampoo')

  assert.equal(resultado.itens.length, LIMITE_RESULTADOS)
  assert.equal(resultado.total, 60)
  assert.equal(resultado.temMais, true)
})

test('sem excedente, temMais é falso', () => {
  const resultado = buscarProdutos(catalogo, 'shampoo')
  assert.equal(resultado.temMais, false)
  assert.equal(resultado.total, resultado.itens.length)
})

test('vários termos exigem todos', () => {
  const lista = [
    p('a', 'Kit Hidratação Profunda'),
    p('b', 'Kit Reconstrução'),
    p('c', 'Máscara de Hidratação'),
  ]
  const ids = buscarProdutos(lista, 'kit hidratacao').itens.map((i) => i.id)
  assert.deepEqual(ids, ['a'])
})

test('produto indisponível nunca aparece', () => {
  const lista = [p('a', 'Shampoo Oculto', { disponivel: false }), p('b', 'Shampoo Visível')]
  assert.deepEqual(buscarProdutos(lista, 'shampoo').itens.map((i) => i.id), ['b'])
})

test('entrada inválida devolve vazio sem lançar', () => {
  for (const lixo of [null, undefined, 'texto', 42, {}]) {
    const r = buscarProdutos(lixo, 'shampoo')
    assert.deepEqual(r.itens, [])
    assert.equal(r.total, 0)
  }
  assert.deepEqual(buscarProdutos(catalogo, null).itens, [])
})
