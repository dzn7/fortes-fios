import test from 'node:test'
import assert from 'node:assert/strict'

import {
  moverItem,
  moverParaBaixo,
  moverParaCima,
  ordemMudou,
  podeDescer,
  podeSubir,
} from '../src/lib/ordem-categorias.mjs'

const lista = () => ['Kits', 'Nutrição', 'Hidratação', 'Infantil']

// ------------------------------------------------------------------ moverItem

test('move um item para frente e empurra os do caminho', () => {
  assert.deepEqual(moverItem(lista(), 0, 2), ['Nutrição', 'Hidratação', 'Kits', 'Infantil'])
})

test('move um item para trás', () => {
  assert.deepEqual(moverItem(lista(), 3, 1), ['Kits', 'Infantil', 'Nutrição', 'Hidratação'])
})

test('mover para a própria posição não muda nada', () => {
  assert.deepEqual(moverItem(lista(), 2, 2), lista())
})

test('índice fora da faixa devolve a lista intacta', () => {
  for (const [de, para] of [
    [-1, 1],
    [0, -1],
    [4, 0],
    [0, 4],
    [99, 99],
  ]) {
    assert.deepEqual(moverItem(lista(), de, para), lista(), `de=${de} para=${para}`)
  }
})

test('índice não inteiro não corrompe a lista', () => {
  for (const lixo of [1.5, NaN, null, undefined, '1', {}]) {
    assert.deepEqual(moverItem(lista(), lixo, 0), lista())
    assert.deepEqual(moverItem(lista(), 0, lixo), lista())
  }
})

/*
 * O modal mantém dois retratos ao mesmo tempo — o rascunho e o original — para
 * o "Cancelar" ter o que restaurar. Mutar a lista recebida destruiria o
 * original no primeiro clique de seta.
 */
test('não muta a lista recebida', () => {
  const original = lista()
  const copia = [...original]
  moverItem(original, 0, 3)
  assert.deepEqual(original, copia)
})

test('lista vazia ou não-array não quebra', () => {
  assert.deepEqual(moverItem([], 0, 1), [])
  assert.deepEqual(moverItem(null, 0, 1), [])
  assert.deepEqual(moverItem(undefined, 0, 1), [])
})

test('lista de um item só é sempre estável', () => {
  assert.deepEqual(moverItem(['Único'], 0, 0), ['Único'])
  assert.deepEqual(moverParaCima(['Único'], 0), ['Único'])
  assert.deepEqual(moverParaBaixo(['Único'], 0), ['Único'])
})

// ----------------------------------------------------------------- atalhos

test('subir troca com o anterior', () => {
  assert.deepEqual(moverParaCima(lista(), 1), ['Nutrição', 'Kits', 'Hidratação', 'Infantil'])
})

test('descer troca com o seguinte', () => {
  assert.deepEqual(moverParaBaixo(lista(), 0), ['Nutrição', 'Kits', 'Hidratação', 'Infantil'])
})

test('subir no topo e descer no fim são no-op', () => {
  assert.deepEqual(moverParaCima(lista(), 0), lista())
  assert.deepEqual(moverParaBaixo(lista(), 3), lista())
})

test('subir e descer se desfazem', () => {
  assert.deepEqual(moverParaCima(moverParaBaixo(lista(), 1), 2), lista())
})

// -------------------------------------------------------- estado das setas

test('podeSubir e podeDescer nas bordas', () => {
  assert.equal(podeSubir(0), false)
  assert.equal(podeSubir(1), true)
  assert.equal(podeDescer(3, 4), false)
  assert.equal(podeDescer(2, 4), true)
})

test('lista de um item não permite mover para lado nenhum', () => {
  assert.equal(podeSubir(0), false)
  assert.equal(podeDescer(0, 1), false)
})

// ------------------------------------------------------------- ordemMudou

test('ordemMudou compara posição, não conteúdo', () => {
  assert.equal(ordemMudou(lista(), lista()), false)
  assert.equal(ordemMudou(lista(), moverParaCima(lista(), 1)), true)
})

test('tamanhos diferentes contam como mudança', () => {
  assert.equal(ordemMudou(lista(), lista().slice(0, 3)), true)
})

test('mesmos nomes em ordem diferente contam como mudança', () => {
  assert.equal(ordemMudou(['a', 'b'], ['b', 'a']), true)
})

test('ordemMudou tolera entrada inválida', () => {
  assert.equal(ordemMudou(null, null), false)
  assert.equal(ordemMudou(lista(), null), true)
})
