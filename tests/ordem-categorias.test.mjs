import test from 'node:test'
import assert from 'node:assert/strict'

import {
  moverItem,
  ordenarParaBanco,
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

// ------------------------------------------------- persistência no banco
/*
 * O modal gravava só `configuracoes_loja.ordem_categorias_produtos`, e o site
 * ordena por `categorias_cardapio.ordem`. Duas gavetas: a ordem salva nunca
 * chegava ao catálogo. `ordenarParaBanco` produz a atualização da coluna certa.
 */
const linhas = [
  { id: 'a', nome: 'Kits e promopack' },
  { id: 'b', nome: 'Hidratação' },
  { id: 'c', nome: 'Cacheados e ondulados' },
]

test('a posição na lista vira ordem 1..N', () => {
  assert.deepEqual(
    ordenarParaBanco(['Hidratação', 'Kits e promopack', 'Cacheados e ondulados'], linhas),
    [
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
      { id: 'c', ordem: 3 },
    ],
  )
})

test('casa por nome sem acento e sem caixa', () => {
  // Só a primeira posição interessa aqui; as demais linhas entram depois, na
  // ordem do banco, e isso é coberto pelos testes de completude abaixo.
  assert.deepEqual(ordenarParaBanco(['  hidratacao  '], linhas)[0], { id: 'b', ordem: 1 })
  assert.deepEqual(ordenarParaBanco(['KITS E PROMOPACK'], linhas)[0], { id: 'a', ordem: 1 })
})

test('nome sem linha na tabela é ignorado, sem furo na numeração', () => {
  assert.deepEqual(
    ordenarParaBanco(['Inexistente', 'Hidratação', 'Outra que não existe', 'Kits e promopack'], linhas),
    [
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
      // `c` não foi citada e entra no fim, mantendo a numeração contígua.
      { id: 'c', ordem: 3 },
    ],
  )
})

test('duplicado fica só com a primeira posição', () => {
  assert.deepEqual(
    ordenarParaBanco(['Hidratação', 'Kits e promopack', 'Hidratação'], linhas),
    [
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
      { id: 'c', ordem: 3 },
    ],
  )
})

test('entrada inválida não quebra o salvamento', () => {
  assert.deepEqual(ordenarParaBanco(null, linhas), [])
  assert.deepEqual(ordenarParaBanco(['Hidratação'], null), [])
  // Sem nome utilizável, toda linha da tabela ainda recebe ordem contígua:
  // devolver vazio aqui deixaria o banco com a numeração antiga e repetida.
  assert.equal(ordenarParaBanco(['', '  '], linhas).length, linhas.length)
})

test('linha sem id ou sem nome é ignorada', () => {
  const sujas = [{ id: 'x' }, { nome: 'Sem id' }, { id: 'y', nome: 'Boa' }]
  assert.deepEqual(ordenarParaBanco(['Sem id', 'Boa'], sujas), [{ id: 'y', ordem: 1 }])
})

/*
 * Reproduz o estado real do banco em 2026-08-18: o site mostrava Reconstrução
 * em 2º porque `categorias_cardapio.ordem` dizia isso, enquanto o modal exibia
 * Ofertas relâmpago em 2º, vindo do JSON.
 */
test('o caso real: a ordem do modal vira a ordem da tabela', () => {
  const doBanco = [
    { id: '1', nome: 'Kits e promopack' },
    { id: '2', nome: 'Reconstrução' },
    { id: '3', nome: 'Nutrição' },
    { id: '4', nome: 'Ofertas relâmpago' },
    { id: '5', nome: 'Hidratação' },
  ]
  const escolhidaNoModal = [
    'Kits e promopack',
    'Ofertas relâmpago',
    'Hidratação',
    'Nutrição',
    'Reconstrução',
  ]

  assert.deepEqual(ordenarParaBanco(escolhidaNoModal, doBanco), [
    { id: '1', ordem: 1 },
    { id: '4', ordem: 2 },
    { id: '5', ordem: 3 },
    { id: '3', ordem: 4 },
    { id: '2', ordem: 5 },
  ])
})

/*
 * Caso real do banco: `categorias_cardapio` tinha 11 linhas e a lista salva
 * pelo modal, 10 — faltava "Mary Kay". Se a linha de fora mantivesse a `ordem`
 * antiga, duas categorias ficariam com o mesmo número e o `order by` do site
 * decidiria no desempate. Ela vai para o fim, com numeração contígua.
 */
test('categoria da tabela ausente da lista vai para o fim, sem ordem repetida', () => {
  const doBanco = [
    { id: '1', nome: 'Kits' },
    { id: '2', nome: 'Mary Kay' },
    { id: '3', nome: 'Nutrição' },
  ]

  const atualizacoes = ordenarParaBanco(['Nutrição', 'Kits'], doBanco)

  assert.deepEqual(atualizacoes, [
    { id: '3', ordem: 1 },
    { id: '1', ordem: 2 },
    { id: '2', ordem: 3 },
  ])

  const ordens = atualizacoes.map((a) => a.ordem)
  assert.equal(new Set(ordens).size, ordens.length, 'ordem repetida')
})

test('toda linha da tabela recebe ordem, mesmo com a lista vazia', () => {
  const doBanco = [
    { id: 'a', nome: 'Um' },
    { id: 'b', nome: 'Dois' },
  ]
  assert.deepEqual(ordenarParaBanco([], doBanco), [
    { id: 'a', ordem: 1 },
    { id: 'b', ordem: 2 },
  ])
})
