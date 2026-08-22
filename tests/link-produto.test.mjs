import test from 'node:test'
import assert from 'node:assert/strict'

import {
  caminhoDoProduto,
  idDoSlug,
  slugDoProduto,
  urlPublicaDoProduto,
} from '../src/lib/link-produto.mjs'

const ID = '9ceea5e4-5fa6-4677-b85d-d89bcb22b7ce'

test('o slug junta nome higienizado e id', () => {
  assert.equal(
    slugDoProduto({ id: ID, nome: 'Máscara de Hidratação Profunda' }),
    `mascara-de-hidratacao-profunda-${ID}`,
  )
})

test('pontuação, espaço e barra viram um único hífen', () => {
  assert.equal(
    slugDoProduto({ id: ID, nome: 'Shampoo  &  Condicionador / 2 em 1!' }),
    `shampoo-condicionador-2-em-1-${ID}`,
  )
})

test('nome vazio ou só símbolo devolve apenas o id, sem hífen sobrando', () => {
  for (const nome of ['', '   ', '!!!', '///', null, undefined, 42]) {
    assert.equal(slugDoProduto({ id: ID, nome }), ID, `falhou com ${String(nome)}`)
  }
})

test('nome muito longo é cortado sem deixar hífen na ponta', () => {
  const slug = slugDoProduto({ id: ID, nome: 'palavra '.repeat(40) })
  const parteLegivel = slug.slice(0, slug.length - ID.length - 1)
  assert.ok(parteLegivel.length <= 60, `parte legível ficou com ${parteLegivel.length}`)
  assert.ok(!parteLegivel.endsWith('-'))
  assert.equal(idDoSlug(slug), ID)
})

test('produto sem id não gera slug', () => {
  assert.equal(slugDoProduto({ nome: 'Máscara' }), '')
  assert.equal(slugDoProduto(null), '')
  assert.equal(slugDoProduto({ id: 'nao-e-uuid', nome: 'X' }), '')
})

test('idDoSlug lê o uuid do fim', () => {
  assert.equal(idDoSlug(`mascara-${ID}`), ID)
  assert.equal(idDoSlug(ID), ID)
})

test('idDoSlug aceita uuid em maiúsculas e devolve em minúsculas', () => {
  assert.equal(idDoSlug(`mascara-${ID.toUpperCase()}`), ID)
})

test('idDoSlug devolve null para entrada sem uuid válido, sem lançar', () => {
  for (const lixo of [
    '',
    '   ',
    'mascara-de-hidratacao',
    'mascara-9ceea5e4-5fa6-4677-b85d',
    'mascara-zzzzzzzz-5fa6-4677-b85d-d89bcb22b7ce',
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(idDoSlug(lixo), null, `aceitou ${String(lixo)}`)
  }
})

/*
 * Ida e volta é a garantia que sustenta o formato escolhido: o nome é
 * decoração, o id é a chave. Se esta propriedade quebrar, link compartilhado
 * deixa de abrir.
 */
test('ida e volta preserva o id para qualquer nome', () => {
  const nomes = [
    'Máscara de Hidratação Profunda',
    'Óleo de Argan 100% puro',
    'Shampoo 2 em 1 — cachos & ondas',
    'Kit ✨ Reconstrução ✨',
    'Ampola / dose única',
    'ÁÉÍÓÚ ÃÕ Ç',
    '',
    '---',
  ]
  for (const nome of nomes) {
    const slug = slugDoProduto({ id: ID, nome })
    assert.equal(idDoSlug(slug), ID, `ida e volta falhou para "${nome}"`)
  }
})

test('o caminho começa em /produto/', () => {
  assert.equal(
    caminhoDoProduto({ id: ID, nome: 'Máscara' }),
    `/produto/mascara-${ID}`,
  )
  assert.equal(caminhoDoProduto({ nome: 'sem id' }), '')
})

test('a URL pública junta a origem sem barra dupla', () => {
  const esperada = `https://fortesfios.com/produto/mascara-${ID}`
  assert.equal(urlPublicaDoProduto({ id: ID, nome: 'Máscara' }, 'https://fortesfios.com'), esperada)
  assert.equal(urlPublicaDoProduto({ id: ID, nome: 'Máscara' }, 'https://fortesfios.com/'), esperada)
})

test('sem origem, a URL pública devolve o caminho relativo', () => {
  assert.equal(
    urlPublicaDoProduto({ id: ID, nome: 'Máscara' }, ''),
    `/produto/mascara-${ID}`,
  )
})
