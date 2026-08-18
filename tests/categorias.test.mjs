import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ICONES_CATEGORIA,
  ICONE_CATEGORIA_PADRAO,
  iconeValido,
  normalizarNomeCategoria,
  sugerirIconePorNome,
  validarCategoria,
} from '../src/lib/categorias.mjs'

// 1. o catálogo
test('todo ícone tem id, rótulo e palavras que o sugerem', () => {
  assert.ok(ICONES_CATEGORIA.length >= 8)

  const ids = new Set()
  for (const icone of ICONES_CATEGORIA) {
    assert.ok(icone.id, 'ícone sem id')
    assert.ok(icone.rotulo, `${icone.id} sem rótulo`)
    assert.ok(Array.isArray(icone.palavras), `${icone.id} sem palavras`)
    assert.ok(!ids.has(icone.id), `id repetido: ${icone.id}`)
    ids.add(icone.id)
  }

  assert.ok(ids.has(ICONE_CATEGORIA_PADRAO))
})

test('ícone fora do catálogo cai no padrão', () => {
  assert.equal(iconeValido('inventado'), ICONE_CATEGORIA_PADRAO)
  assert.equal(iconeValido(''), ICONE_CATEGORIA_PADRAO)
  assert.equal(iconeValido(null), ICONE_CATEGORIA_PADRAO)
  assert.equal(iconeValido(ICONES_CATEGORIA[1].id), ICONES_CATEGORIA[1].id)
})

/*
 * As categorias REAIS desta loja, lidas do banco em 2026-08-18. É o teste que
 * importa: o catálogo antigo tinha 12 ícones e obrigava escolhas ruins —
 * "Hidratação" ficou com `etiqueta` (a etiqueta genérica) e "Finalizadores" e
 * "Acessórios" ficaram com `maquiagem`, por falta de opção melhor.
 */
test('cada categoria real da loja tem um ícone que faz sentido', () => {
  const esperado = {
    'Kits e promopack': 'kit',
    'Reconstrução': 'reconstrucao',
    'Nutrição': 'nutricao',
    'Mary Kay': 'maquiagem',
    'Infantil': 'infantil',
    'Outros': 'etiqueta',
    'Acessórios': 'acessorio',
    'Cacheados e ondulados': 'cachos',
    'Cabelos oleosos, caspa, antiqueda, crescimento': 'couro',
    'Hidratação': 'hidratacao',
    'Finalizadores': 'finalizador',
  }

  for (const [nome, icone] of Object.entries(esperado)) {
    assert.equal(sugerirIconePorNome(nome), icone, `"${nome}"`)
  }
})

test('o específico vence o genérico: hidratação e nutrição não caem em tratamento', () => {
  assert.equal(sugerirIconePorNome('Hidratação profunda'), 'hidratacao')
  assert.equal(sugerirIconePorNome('Nutrição capilar'), 'nutricao')
  assert.equal(sugerirIconePorNome('Reconstrução total'), 'reconstrucao')
  // O genérico continua existindo para o que não é nenhum dos três.
  assert.equal(sugerirIconePorNome('Tratamento pós-química'), 'tratamento')
})

test('o catálogo cobre o vocabulário de uma loja de cabelo', () => {
  const esperado = {
    'Leave-in e finalizadores': 'finalizador',
    'Óleos capilares': 'oleo',
    'Matizador': 'matizador',
    'Coloração': 'coloracao',
    'Protetor térmico': 'protecao',
    'Escovas e pentes': 'escova',
    'Perfumaria': 'perfume',
    'Linha profissional': 'premium',
  }

  for (const [nome, icone] of Object.entries(esperado)) {
    assert.equal(sugerirIconePorNome(nome), icone, `"${nome}"`)
  }
})

/*
 * Ids gravados no banco não podem sumir do catálogo: `iconeValido` devolveria o
 * padrão e a categoria perderia em silêncio o ícone que alguém escolheu.
 */
test('nenhum id do catálogo antigo foi removido', () => {
  const antigos = [
    'etiqueta', 'banho', 'cachos', 'liso', 'tratamento', 'kit',
    'coloracao', 'infantil', 'ferramenta', 'maquiagem', 'pele', 'promocao',
  ]

  for (const id of antigos) {
    assert.equal(iconeValido(id), id, `o id "${id}" sumiu do catálogo`)
  }
})

test('o catálogo cresceu o suficiente para não forçar escolha ruim', () => {
  assert.ok(
    ICONES_CATEGORIA.length >= 20,
    `só ${ICONES_CATEGORIA.length} ícones — o problema relatado era justamente a falta de opção`,
  )
})

// 2. sugestão pelo nome — o que evita o trabalho de escolher
test('o nome da categoria sugere um ícone coerente', () => {
  assert.equal(sugerirIconePorNome('Shampoo e condicionador'), 'banho')
  assert.equal(sugerirIconePorNome('Cabelos cacheados'), 'cachos')
  assert.equal(sugerirIconePorNome('Kits e promopack'), 'kit')
  assert.equal(sugerirIconePorNome('Infantil'), 'infantil')
  assert.equal(sugerirIconePorNome('Ferramentas e acessórios'), 'ferramenta')
})

test('sugestão ignora acento e caixa', () => {
  assert.equal(sugerirIconePorNome('PÓS-QUÍMICA'), sugerirIconePorNome('pos-quimica'))
  assert.equal(sugerirIconePorNome('Cachos'), sugerirIconePorNome('CACHOS'))
})

test('nome sem correspondência cai no padrão em vez de errar o palpite', () => {
  assert.equal(sugerirIconePorNome('Xyz abc'), ICONE_CATEGORIA_PADRAO)
  assert.equal(sugerirIconePorNome(''), ICONE_CATEGORIA_PADRAO)
  assert.equal(sugerirIconePorNome(null), ICONE_CATEGORIA_PADRAO)
})

// 3. normalização do nome
test('nome é limpo de espaço sobrando', () => {
  assert.equal(normalizarNomeCategoria('  Cachos  '), 'Cachos')
  assert.equal(normalizarNomeCategoria('Kits   e   promopack'), 'Kits e promopack')
  assert.equal(normalizarNomeCategoria(''), '')
  assert.equal(normalizarNomeCategoria(null), '')
})

// 4. validação, com o duplicado que é o erro real do dia a dia
test('categoria válida não tem erro', () => {
  assert.equal(validarCategoria({ nome: 'Cachos' }, []), null)
})

test('nome vazio ou curto demais é recusado', () => {
  assert.ok(validarCategoria({ nome: '' }, []))
  assert.ok(validarCategoria({ nome: ' a ' }, []))
})

test('nome repetido é recusado, ignorando acento e caixa', () => {
  const existentes = [{ id: '1', nome: 'Pós-química' }]

  assert.ok(validarCategoria({ nome: 'Pós-química' }, existentes))
  assert.ok(validarCategoria({ nome: 'pos-quimica' }, existentes))
  assert.ok(validarCategoria({ nome: '  PÓS-QUÍMICA ' }, existentes))
})

test('renomear a própria categoria não colide consigo mesma', () => {
  const existentes = [{ id: '1', nome: 'Cachos' }]

  assert.equal(validarCategoria({ id: '1', nome: 'Cachos' }, existentes), null)
  assert.equal(validarCategoria({ id: '1', nome: 'Cachos definidos' }, existentes), null)
  assert.ok(validarCategoria({ id: '2', nome: 'Cachos' }, existentes))
})
