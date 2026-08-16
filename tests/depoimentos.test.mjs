import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CONFIGURACAO_DEPOIMENTOS_PADRAO,
  FORMATOS_DEPOIMENTO,
  LIMITE_DEPOIMENTOS,
  criarIdDepoimento,
  depoimentosVisiveis,
  normalizarConfiguracaoDepoimentos,
  formatoDepoimento,
  reordenarDepoimentos,
} from '../src/lib/vitrineDepoimentos.mjs'

const depoimento = (sobrescritas = {}) => ({
  id: 'dep-1',
  nome: 'Maria Souza',
  imagemUrl: 'https://cdn.exemplo.com/depoimentos/a.webp',
  formato: 'vertical',
  ativo: true,
  ...sobrescritas,
})

const serializar = (config) => JSON.stringify(config)

// 1. entrada inválida nunca liga a seção
test('valor ausente ou quebrado devolve a configuração padrão desligada', () => {
  for (const entrada of [null, undefined, '', '{quebrado', '[]', 'true']) {
    const config = normalizarConfiguracaoDepoimentos(entrada)
    assert.equal(config.ativo, false)
    assert.deepEqual(config.depoimentos, [])
  }
})

// 2. o caminho feliz
test('configuração válida é lida com os campos preservados', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({
      ativo: true,
      titulo: 'Quem já usou',
      depoimentos: [depoimento(), depoimento({ id: 'dep-2', formato: 'horizontal' })],
    }),
  )

  assert.equal(config.ativo, true)
  assert.equal(config.titulo, 'Quem já usou')
  assert.equal(config.depoimentos.length, 2)
  assert.equal(config.depoimentos[0].formato, 'vertical')
  assert.equal(config.depoimentos[1].formato, 'horizontal')
})

// 3. sem imagem não existe depoimento
test('item sem imagem válida é descartado', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({
      ativo: true,
      depoimentos: [
        depoimento({ id: 'ok' }),
        depoimento({ id: 'sem-url', imagemUrl: '' }),
        depoimento({ id: 'javascript', imagemUrl: 'javascript:alert(1)' }),
        depoimento({ id: 'http', imagemUrl: 'http://inseguro.com/a.png' }),
      ],
    }),
  )

  assert.deepEqual(
    config.depoimentos.map((item) => item.id),
    ['ok'],
  )
})

test('caminho relativo do próprio site é aceito', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({ ativo: true, depoimentos: [depoimento({ imagemUrl: '/depoimentos/a.webp' })] }),
  )
  assert.equal(config.depoimentos.length, 1)
})

// 4. formato: o que a tela do site usa para não deformar
test('formato desconhecido cai em vertical, que é o caso comum do print', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({
      ativo: true,
      depoimentos: [
        depoimento({ id: 'a', formato: 'quadrado' }),
        depoimento({ id: 'b', formato: null }),
        depoimento({ id: 'c', formato: 'horizontal' }),
      ],
    }),
  )

  assert.equal(config.depoimentos[0].formato, 'vertical')
  assert.equal(config.depoimentos[1].formato, 'vertical')
  assert.equal(config.depoimentos[2].formato, 'horizontal')
})

test('todo formato do catálogo é semântico, sem classe de CSS', () => {
  assert.ok(FORMATOS_DEPOIMENTO.length >= 2)

  for (const formato of FORMATOS_DEPOIMENTO) {
    assert.ok(formato.id && formato.rotulo && formato.ajuda)
    assert.equal(typeof formato.proporcao, 'number')
    assert.ok(formato.proporcao > 0)
  }
})

/*
 * Guarda contra a regressão que derrubou a seção: classe de Tailwind escrita em
 * `src/lib/*.mjs` fica fora do `content` do config e nunca é gerada. O card
 * perdeu largura e proporção, o `<Image fill>` colapsou e sobrou só o nome.
 */
test('o domínio não carrega classe de Tailwind', () => {
  const serializado = JSON.stringify(FORMATOS_DEPOIMENTO)

  assert.ok(!serializado.includes('aspect-'), 'proporção virou classe no domínio')
  assert.ok(!/\bw-\[/.test(serializado), 'largura virou classe no domínio')
})

test('vertical é retrato e horizontal é paisagem', () => {
  assert.ok(formatoDepoimento('vertical').proporcao < 1)
  assert.ok(formatoDepoimento('horizontal').proporcao > 1)
  assert.equal(formatoDepoimento('inexistente').id, 'vertical')
})

// 5. id duplicado quebraria a key do React
test('ids repetidos são desambiguados', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({
      ativo: true,
      depoimentos: [depoimento({ id: 'igual' }), depoimento({ id: 'igual' })],
    }),
  )

  assert.equal(config.depoimentos.length, 2)
  assert.notEqual(config.depoimentos[0].id, config.depoimentos[1].id)
})

// 6. teto de itens
test('a lista respeita o limite máximo', () => {
  const muitos = Array.from({ length: LIMITE_DEPOIMENTOS + 10 }, (_, indice) =>
    depoimento({ id: `dep-${indice}` }),
  )

  const config = normalizarConfiguracaoDepoimentos(
    serializar({ ativo: true, depoimentos: muitos }),
  )

  assert.equal(config.depoimentos.length, LIMITE_DEPOIMENTOS)
})

// 7. o que o site realmente renderiza
test('só depoimentos ativos aparecem, e a seção some quando não sobra nenhum', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({
      ativo: true,
      depoimentos: [depoimento({ id: 'a' }), depoimento({ id: 'b', ativo: false })],
    }),
  )

  assert.deepEqual(
    depoimentosVisiveis(config).map((item) => item.id),
    ['a'],
  )

  const desligada = normalizarConfiguracaoDepoimentos(
    serializar({ ativo: false, depoimentos: [depoimento()] }),
  )
  assert.deepEqual(depoimentosVisiveis(desligada), [])
})

// 8. reordenação
test('reordenar move o item e preserva todos os demais', () => {
  const lista = [depoimento({ id: 'a' }), depoimento({ id: 'b' }), depoimento({ id: 'c' })]

  assert.deepEqual(reordenarDepoimentos(lista, 0, 1).map((i) => i.id), ['b', 'a', 'c'])
  assert.deepEqual(reordenarDepoimentos(lista, 2, -1).map((i) => i.id), ['a', 'c', 'b'])
})

test('reordenar nas bordas não perde nem duplica item', () => {
  const lista = [depoimento({ id: 'a' }), depoimento({ id: 'b' })]

  assert.deepEqual(reordenarDepoimentos(lista, 0, -1).map((i) => i.id), ['a', 'b'])
  assert.deepEqual(reordenarDepoimentos(lista, 1, 1).map((i) => i.id), ['a', 'b'])
  assert.equal(reordenarDepoimentos(lista, 99, 1).length, 2)
})

// 9. nome é opcional — o print é o depoimento
test('depoimento sem nome continua válido', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({ ativo: true, depoimentos: [depoimento({ nome: '' })] }),
  )

  assert.equal(config.depoimentos.length, 1)
  assert.equal(config.depoimentos[0].nome, '')
})

test('nome longo demais é truncado em vez de estourar o card', () => {
  const config = normalizarConfiguracaoDepoimentos(
    serializar({ ativo: true, depoimentos: [depoimento({ nome: 'a'.repeat(500) })] }),
  )

  assert.ok(config.depoimentos[0].nome.length <= 80)
})

// 10. id único
test('ids gerados não colidem', () => {
  const ids = new Set(Array.from({ length: 50 }, () => criarIdDepoimento()))
  assert.equal(ids.size, 50)
})

test('a configuração padrão é segura', () => {
  assert.equal(CONFIGURACAO_DEPOIMENTOS_PADRAO.ativo, false)
  assert.deepEqual(CONFIGURACAO_DEPOIMENTOS_PADRAO.depoimentos, [])
  assert.ok(CONFIGURACAO_DEPOIMENTOS_PADRAO.titulo)
})
