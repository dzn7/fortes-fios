import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ORDENACAO_PADRAO,
  ORDENACOES_CATALOGO,
  aplicarFiltrosCatalogo,
  contarFiltrosAtivos,
  filtrarProdutos,
  normalizarOrdenacao,
  ordenarProdutos,
  percentualDesconto,
  produtoAtendeBusca,
  produtoEmOferta,
} from '../src/lib/filtros-catalogo.mjs'

const produto = (sobrescritas = {}) => ({
  id: 'p1',
  nome: 'Shampoo Hidratante',
  descricao: 'Limpeza suave para cabelos secos',
  categoria: 'Cabelos',
  preco: 40,
  preco_original: null,
  desconto: 0,
  created_at: '2026-01-01T00:00:00Z',
  ...sobrescritas,
})

// ---------------------------------------------------------------- desconto

test('sem desconto o percentual é zero', () => {
  assert.equal(percentualDesconto(produto()), 0)
  assert.equal(produtoEmOferta(produto()), false)
})

test('desconto vale quando há percentual E preço original — a mesma regra do CartaoProduto', () => {
  const comOferta = produto({ desconto: 30, preco_original: 60, preco: 42 })
  assert.equal(percentualDesconto(comOferta), 30)
  assert.equal(produtoEmOferta(comOferta), true)
})

test('percentual sem preço original não conta: o cartão não mostraria a tarja', () => {
  assert.equal(percentualDesconto(produto({ desconto: 30, preco_original: null })), 0)
})

test('preço original menor ou igual ao preço não é oferta', () => {
  assert.equal(percentualDesconto(produto({ desconto: 10, preco_original: 40, preco: 40 })), 0)
  assert.equal(percentualDesconto(produto({ desconto: 10, preco_original: 30, preco: 40 })), 0)
})

test('desconto inválido não vira NaN', () => {
  for (const lixo of [null, undefined, 'trinta', NaN, -5]) {
    assert.equal(percentualDesconto(produto({ desconto: lixo, preco_original: 60 })), 0)
  }
})

// ------------------------------------------------------------------ busca

test('busca ignora acento nos dois sentidos', () => {
  const mascara = produto({ nome: 'Máscara de Nutrição' })
  assert.equal(produtoAtendeBusca(mascara, 'mascara'), true)
  assert.equal(produtoAtendeBusca(produto({ nome: 'Mascara Simples' }), 'máscara'), true)
})

test('busca ignora caixa e espaço nas pontas', () => {
  assert.equal(produtoAtendeBusca(produto(), '  SHAMPOO '), true)
})

test('busca alcança descrição e categoria, não só o nome', () => {
  const item = produto({ nome: 'Ox Nutre 120ml', descricao: 'óleo nutritivo', categoria: 'Óleos' })
  assert.equal(produtoAtendeBusca(item, 'oleo'), true)
  assert.equal(produtoAtendeBusca(item, 'nutritivo'), true)
})

test('vários termos: todos precisam aparecer, em qualquer ordem', () => {
  const item = produto({ nome: 'Shampoo Hidratante', categoria: 'Cabelos' })
  assert.equal(produtoAtendeBusca(item, 'shampoo hidratante'), true)
  assert.equal(produtoAtendeBusca(item, 'hidratante shampoo'), true)
  assert.equal(produtoAtendeBusca(item, 'shampoo condicionador'), false)
})

test('busca vazia aceita tudo', () => {
  assert.equal(produtoAtendeBusca(produto(), ''), true)
  assert.equal(produtoAtendeBusca(produto(), '   '), true)
})

// ----------------------------------------------------------------- filtro

const catalogo = [
  produto({ id: 'a', nome: 'Shampoo A', categoria: 'Cabelos', preco: 50 }),
  produto({
    id: 'b',
    nome: 'Máscara B',
    categoria: 'Tratamento',
    preco: 30,
    preco_original: 60,
    desconto: 50,
  }),
  produto({
    id: 'c',
    nome: 'Óleo C',
    categoria: 'Cabelos',
    preco: 20,
    preco_original: 25,
    desconto: 20,
  }),
]

const ids = (lista) => lista.map((item) => item.id)

test('categoria "todos" não filtra nada', () => {
  assert.deepEqual(ids(filtrarProdutos(catalogo, { categoria: 'todos' })), ['a', 'b', 'c'])
})

test('categoria filtra ignorando acento e caixa', () => {
  assert.deepEqual(ids(filtrarProdutos(catalogo, { categoria: 'cabelos' })), ['a', 'c'])
})

test('apenasOfertas deixa só quem tem desconto de verdade', () => {
  assert.deepEqual(ids(filtrarProdutos(catalogo, { apenasOfertas: true })), ['b', 'c'])
})

test('filtros se somam', () => {
  const resultado = filtrarProdutos(catalogo, { categoria: 'Cabelos', apenasOfertas: true })
  assert.deepEqual(ids(resultado), ['c'])
})

test('filtrar não muta a lista recebida', () => {
  const original = [...catalogo]
  filtrarProdutos(catalogo, { apenasOfertas: true })
  assert.deepEqual(catalogo, original)
})

// -------------------------------------------------------------- ordenação

test('maiores descontos vem do maior percentual para o menor', () => {
  assert.deepEqual(ids(ordenarProdutos(catalogo, 'maior_desconto')), ['b', 'c', 'a'])
})

test('produto sem desconto vai para o fim de "maiores descontos"', () => {
  const lista = [produto({ id: 'x' }), produto({ id: 'y', desconto: 10, preco_original: 50 })]
  assert.deepEqual(ids(ordenarProdutos(lista, 'maior_desconto')), ['y', 'x'])
})

test('menor e maior preço', () => {
  assert.deepEqual(ids(ordenarProdutos(catalogo, 'menor_preco')), ['c', 'b', 'a'])
  assert.deepEqual(ids(ordenarProdutos(catalogo, 'maior_preco')), ['a', 'b', 'c'])
})

test('novidades: mais recente primeiro', () => {
  const lista = [
    produto({ id: 'velho', created_at: '2025-01-01T00:00:00Z' }),
    produto({ id: 'novo', created_at: '2026-08-01T00:00:00Z' }),
  ]
  assert.deepEqual(ids(ordenarProdutos(lista, 'lancamentos')), ['novo', 'velho'])
})

test('recomendados preserva a ordem que veio do banco', () => {
  assert.deepEqual(ids(ordenarProdutos(catalogo, 'recomendados')), ['a', 'b', 'c'])
})

test('empate preserva a ordem original — a ordenação é estável', () => {
  const lista = [
    produto({ id: 'primeiro', preco: 10 }),
    produto({ id: 'segundo', preco: 10 }),
    produto({ id: 'terceiro', preco: 10 }),
  ]
  assert.deepEqual(ids(ordenarProdutos(lista, 'menor_preco')), [
    'primeiro',
    'segundo',
    'terceiro',
  ])
})

test('ordenar não muta a lista recebida', () => {
  const original = [...catalogo]
  ordenarProdutos(catalogo, 'menor_preco')
  assert.deepEqual(catalogo, original)
})

// -------------------------------------------------------------- catálogo

test('normalizarOrdenacao recusa valor desconhecido e cai no padrão', () => {
  assert.equal(normalizarOrdenacao('maior_desconto'), 'maior_desconto')
  assert.equal(normalizarOrdenacao('inventado'), ORDENACAO_PADRAO)
  assert.equal(normalizarOrdenacao(null), ORDENACAO_PADRAO)
})

test('toda ordenação do catálogo é aplicável', () => {
  for (const opcao of ORDENACOES_CATALOGO) {
    assert.equal(normalizarOrdenacao(opcao.id), opcao.id)
    assert.equal(ordenarProdutos(catalogo, opcao.id).length, catalogo.length)
    assert.ok(opcao.rotulo.length > 0)
  }
})

test('"Maiores descontos" está na lista oferecida ao cliente', () => {
  const rotulos = ORDENACOES_CATALOGO.map((opcao) => opcao.rotulo)
  assert.ok(rotulos.includes('Maiores descontos'), rotulos.join(' | '))
})

test('aplicarFiltrosCatalogo filtra e depois ordena', () => {
  const resultado = aplicarFiltrosCatalogo(catalogo, {
    apenasOfertas: true,
    ordenacao: 'menor_preco',
  })
  assert.deepEqual(ids(resultado), ['c', 'b'])
})

test('contarFiltrosAtivos ignora o estado neutro', () => {
  assert.equal(contarFiltrosAtivos({}), 0)
  assert.equal(contarFiltrosAtivos({ categoria: 'todos', busca: '  ', apenasOfertas: false }), 0)
  assert.equal(contarFiltrosAtivos({ categoria: 'Cabelos' }), 1)
  assert.equal(contarFiltrosAtivos({ busca: 'oleo', categoria: 'Cabelos', apenasOfertas: true }), 3)
})

test('ordenação não conta como filtro ativo', () => {
  assert.equal(contarFiltrosAtivos({ ordenacao: 'maior_desconto' }), 0)
})
