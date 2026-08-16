import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRESETS_CUPOM,
  VALOR_SIMULACAO_PADRAO,
  aplicarPreset,
  descreverCupom,
  erroDoCampo,
  simularCupom,
  sugerirCodigo,
  validarFormularioCupom,
} from '../src/lib/cupom-formulario.mjs'

const form = (sobrescritas = {}) => ({
  codigo: 'DESCONTO10',
  nome: 'Desconto de boas-vindas',
  tipoDesconto: 'percentual',
  valorDesconto: '10',
  pedidoMinimo: '',
  limiteDesconto: '',
  aplicaEm: 'pedido',
  produtoId: '',
  usoMaximoTotal: '',
  usoMaximoPorCliente: '',
  validadeFim: '',
  ativo: true,
  ...sobrescritas,
})

// 1. o código sai do que o cupom faz — ninguém precisa inventar
test('código é sugerido a partir do desconto', () => {
  assert.equal(sugerirCodigo('percentual', '10'), 'DESCONTO10')
  assert.equal(sugerirCodigo('percentual', '25'), 'DESCONTO25')
  assert.equal(sugerirCodigo('valor_fixo', '15'), 'MENOS15')
  assert.equal(sugerirCodigo('frete_gratis', ''), 'FRETEGRATIS')
})

test('sugestão sem valor ainda devolve algo utilizável', () => {
  assert.equal(sugerirCodigo('percentual', ''), 'DESCONTO')
  assert.equal(sugerirCodigo('valor_fixo', '0'), 'DESCONTO')
})

// 2. a frase que explica o cupom em português
test('descrição diz o que o cliente ganha', () => {
  assert.match(descreverCupom(form()), /10% de desconto/)
  assert.match(
    descreverCupom(form({ tipoDesconto: 'valor_fixo', valorDesconto: '15' })),
    /R\$ 15,00 de desconto/,
  )
  assert.match(
    descreverCupom(form({ tipoDesconto: 'frete_gratis', valorDesconto: '' })),
    /frete grátis/i,
  )
})

test('descrição incorpora pedido mínimo e teto de desconto', () => {
  const texto = descreverCupom(form({ pedidoMinimo: '80', limiteDesconto: '20' }))
  assert.match(texto, /R\$ 80,00/)
  assert.match(texto, /R\$ 20,00/)
})

// 3. simulação: o número em reais, antes de salvar
test('percentual desconta a porcentagem do pedido', () => {
  const resultado = simularCupom(form(), 100)

  assert.equal(resultado.aplicavel, true)
  assert.equal(resultado.desconto, 10)
  assert.equal(resultado.total, 90)
})

test('teto de desconto limita o percentual', () => {
  const resultado = simularCupom(form({ valorDesconto: '50', limiteDesconto: '20' }), 100)

  assert.equal(resultado.desconto, 20)
  assert.equal(resultado.total, 80)
})

test('valor fixo nunca desconta mais que o próprio pedido', () => {
  const resultado = simularCupom(
    form({ tipoDesconto: 'valor_fixo', valorDesconto: '150' }),
    100,
  )

  assert.equal(resultado.desconto, 100)
  assert.equal(resultado.total, 0)
})

test('pedido abaixo do mínimo não aplica e explica o motivo', () => {
  const resultado = simularCupom(form({ pedidoMinimo: '150' }), 100)

  assert.equal(resultado.aplicavel, false)
  assert.equal(resultado.desconto, 0)
  assert.equal(resultado.total, 100)
  assert.match(resultado.motivo, /R\$ 150,00/)
})

test('frete grátis não mexe no subtotal', () => {
  const resultado = simularCupom(
    form({ tipoDesconto: 'frete_gratis', valorDesconto: '' }),
    100,
  )

  assert.equal(resultado.aplicavel, true)
  assert.equal(resultado.desconto, 0)
  assert.equal(resultado.total, 100)
  assert.match(resultado.motivo, /frete/i)
})

// 4. validação por campo, não um toast genérico por vez
test('validação aponta o campo, e o formulário válido não tem erro', () => {
  assert.deepEqual(validarFormularioCupom(form()), [])

  const erros = validarFormularioCupom(form({ codigo: '', nome: '', valorDesconto: '0' }))
  const campos = erros.map((erro) => erro.campo)

  assert.ok(campos.includes('codigo'))
  assert.ok(campos.includes('nome'))
  assert.ok(campos.includes('valorDesconto'))
  assert.equal(erroDoCampo(erros, 'codigo')?.mensagem.length > 0, true)
  assert.equal(erroDoCampo(erros, 'inexistente'), null)
})

test('percentual acima de 100 é recusado', () => {
  const erros = validarFormularioCupom(form({ valorDesconto: '120' }))
  assert.ok(erros.some((erro) => erro.campo === 'valorDesconto'))
})

test('frete grátis não exige valor de desconto', () => {
  const erros = validarFormularioCupom(
    form({ tipoDesconto: 'frete_gratis', valorDesconto: '' }),
  )
  assert.deepEqual(erros, [])
})

test('cupom de produto exige o produto escolhido', () => {
  const erros = validarFormularioCupom(form({ aplicaEm: 'produto', produtoId: '' }))
  assert.ok(erros.some((erro) => erro.campo === 'produtoId'))

  assert.deepEqual(
    validarFormularioCupom(form({ aplicaEm: 'produto', produtoId: 'abc' })),
    [],
  )
})

test('validade no passado é recusada', () => {
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const erros = validarFormularioCupom(form({ validadeFim: ontem }))
  assert.ok(erros.some((erro) => erro.campo === 'validadeFim'))
})

// 5. presets: o caminho de três cliques
test('todo preset produz formulário já válido', () => {
  assert.ok(PRESETS_CUPOM.length >= 3)

  for (const preset of PRESETS_CUPOM) {
    assert.ok(preset.id && preset.rotulo && preset.descricao)

    const preenchido = aplicarPreset(form({ codigo: '', nome: '', valorDesconto: '' }), preset.id)
    assert.deepEqual(
      validarFormularioCupom(preenchido),
      [],
      `preset ${preset.id} não produziu formulário válido`,
    )
    assert.ok(preenchido.codigo, `preset ${preset.id} não sugeriu código`)
  }
})

test('preset desconhecido devolve o formulário intacto', () => {
  const original = form()
  assert.deepEqual(aplicarPreset(original, 'inexistente'), original)
})

test('a simulação padrão usa um valor de pedido plausível', () => {
  assert.ok(VALOR_SIMULACAO_PADRAO > 0)
  assert.equal(simularCupom(form(), VALOR_SIMULACAO_PADRAO).aplicavel, true)
})
