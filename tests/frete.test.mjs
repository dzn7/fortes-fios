import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CONFIG_FRETE_GRATIS_PADRAO,
  SUGESTOES_VALOR_MINIMO,
  calcularFrete,
  normalizarConfigFreteGratis,
  progressoFreteGratis,
} from '../src/lib/frete.mjs'

const cidade = (sobrescritas = {}) => ({
  nome: 'Gurupi',
  taxa_entrega: 8,
  entrega_gratis: false,
  ...sobrescritas,
})

const ligado = (valorMinimo = 100) => ({ ativo: true, valorMinimo })

// 1. regra desligada: frete normal
test('com a regra desligada o frete é sempre o da cidade', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade(),
    subtotalProdutos: 500,
    configFreteGratis: CONFIG_FRETE_GRATIS_PADRAO,
  })

  assert.equal(resultado.valor, 8)
  assert.equal(resultado.gratis, false)
})

// 2. abaixo do limite: frete normal
test('abaixo do limite o frete continua sendo cobrado', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade(),
    subtotalProdutos: 99.99,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 8)
  assert.equal(resultado.gratis, false)
})

// 3. exatamente no limite: grátis
test('exatamente no limite já ganha frete grátis', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade(),
    subtotalProdutos: 100,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.gratis, true)
  assert.equal(resultado.motivo, 'limite')
})

// 4. acima do limite: grátis
test('acima do limite ganha frete grátis', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade(),
    subtotalProdutos: 250,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.gratis, true)
})

// 5. cair abaixo do limite devolve o frete — é a mesma função, sem estado
test('remover item e cair abaixo do limite recalcula para frete cobrado', () => {
  const entrada = {
    tipoEntrega: 'entrega',
    cidade: cidade(),
    configFreteGratis: ligado(100),
  }

  assert.equal(calcularFrete({ ...entrada, subtotalProdutos: 120 }).valor, 0)
  assert.equal(calcularFrete({ ...entrada, subtotalProdutos: 80 }).valor, 8)
})

// 6. o frete grátis da cidade continua valendo, independente da regra global
test('cidade com entrega grátis vence mesmo abaixo do limite', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade({ entrega_gratis: true }),
    subtotalProdutos: 10,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.gratis, true)
  assert.equal(resultado.motivo, 'cidade')
})

test('cidade com entrega grátis vale até com a regra global desligada', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: cidade({ entrega_gratis: true }),
    subtotalProdutos: 10,
    configFreteGratis: CONFIG_FRETE_GRATIS_PADRAO,
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.motivo, 'cidade')
})

// 7. retirada nunca tem frete
test('retirada não tem frete, e não anuncia frete grátis', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'retirada',
    cidade: cidade(),
    subtotalProdutos: 500,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.gratis, false)
})

// 8. sem cidade escolhida ainda não há frete a cobrar
test('entrega sem cidade selecionada devolve zero sem prometer nada', () => {
  const resultado = calcularFrete({
    tipoEntrega: 'entrega',
    cidade: null,
    subtotalProdutos: 500,
    configFreteGratis: ligado(100),
  })

  assert.equal(resultado.valor, 0)
  assert.equal(resultado.gratis, false)
})

// 9. o feedback do cliente
test('progresso diz quanto falta e some ao atingir', () => {
  const config = ligado(100)

  const faltando = progressoFreteGratis({ subtotalProdutos: 82, configFreteGratis: config, tipoEntrega: 'entrega' })
  assert.equal(faltando.visivel, true)
  assert.equal(faltando.atingiu, false)
  assert.equal(faltando.faltam, 18)
  assert.ok(faltando.percentual > 0 && faltando.percentual < 100)

  const atingiu = progressoFreteGratis({ subtotalProdutos: 100, configFreteGratis: config, tipoEntrega: 'entrega' })
  assert.equal(atingiu.atingiu, true)
  assert.equal(atingiu.faltam, 0)
  assert.equal(atingiu.percentual, 100)
})

test('progresso não aparece com a regra desligada nem em retirada', () => {
  assert.equal(
    progressoFreteGratis({
      subtotalProdutos: 50,
      configFreteGratis: CONFIG_FRETE_GRATIS_PADRAO,
      tipoEntrega: 'entrega',
    }).visivel,
    false,
  )

  assert.equal(
    progressoFreteGratis({
      subtotalProdutos: 50,
      configFreteGratis: ligado(100),
      tipoEntrega: 'retirada',
    }).visivel,
    false,
  )
})

// 10. persistência: o que vem do banco pode ser qualquer coisa
test('configuração inválida do banco vira o padrão desligado', () => {
  for (const entrada of [null, undefined, '', 'true', [], { ativo: 'sim' }, '{quebrado']) {
    const config = normalizarConfigFreteGratis(entrada)
    assert.equal(config.ativo, false, `entrada ${JSON.stringify(entrada)} não deveria ativar`)
  }
})

test('configuração válida é lida de objeto e de JSON em texto', () => {
  assert.deepEqual(normalizarConfigFreteGratis({ ativo: true, valorMinimo: 150 }), {
    ativo: true,
    valorMinimo: 150,
  })

  assert.deepEqual(normalizarConfigFreteGratis('{"ativo":true,"valorMinimo":150}'), {
    ativo: true,
    valorMinimo: 150,
  })
})

test('ativo com valor mínimo inválido não vira frete grátis universal', () => {
  const config = normalizarConfigFreteGratis({ ativo: true, valorMinimo: 0 })
  assert.equal(config.ativo, false)

  const negativo = normalizarConfigFreteGratis({ ativo: true, valorMinimo: -50 })
  assert.equal(negativo.ativo, false)
})

// 11. atalhos do admin
test('sugestões de valor mínimo são valores redondos e crescentes', () => {
  assert.ok(SUGESTOES_VALOR_MINIMO.length >= 3)
  assert.deepEqual(SUGESTOES_VALOR_MINIMO, [...SUGESTOES_VALOR_MINIMO].sort((a, b) => a - b))
  for (const valor of SUGESTOES_VALOR_MINIMO) assert.ok(valor > 0)
})
