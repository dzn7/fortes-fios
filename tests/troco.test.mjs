import test from 'node:test'
import assert from 'node:assert/strict'

import { calcularTroco, sugerirValoresTroco, validarValorPago } from '../src/lib/troco.mjs'

// 1. as sugestões precisam ser úteis: sempre ACIMA do total
test('sugestões partem do total, nunca abaixo dele', () => {
  for (const total of [12.5, 75, 187.4, 250, 999]) {
    const valores = sugerirValoresTroco(total)

    assert.ok(valores.length >= 3, `total ${total} gerou poucas sugestões`)
    for (const valor of valores) {
      assert.ok(valor > total, `sugestão ${valor} não cobre o total ${total}`)
    }
  }
})

// 2. o defeito da tela antiga: [20, 50, 100, 200] fixo
test('pedido alto não sugere valores que não pagam a conta', () => {
  const valores = sugerirValoresTroco(250)

  assert.ok(!valores.includes(20))
  assert.ok(!valores.includes(50))
  assert.ok(!valores.includes(100))
  assert.ok(!valores.includes(200))
})

// 3. valores redondos: ninguém paga com R$ 83
test('sugestões são notas redondas, em ordem crescente e sem repetir', () => {
  const valores = sugerirValoresTroco(75)

  assert.deepEqual(valores, [...valores].sort((a, b) => a - b))
  assert.equal(new Set(valores).size, valores.length)
  for (const valor of valores) {
    assert.equal(valor % 5, 0, `${valor} não é uma nota redonda`)
  }
})

test('pedido pequeno começa nas notas pequenas', () => {
  const valores = sugerirValoresTroco(12.5)
  assert.equal(valores[0], 15)
})

test('total zero ou inválido ainda devolve sugestões utilizáveis', () => {
  assert.ok(sugerirValoresTroco(0).length >= 3)
  assert.ok(sugerirValoresTroco(NaN).length >= 3)
  assert.ok(sugerirValoresTroco(-10).length >= 3)
})

// 4. o troco em si
test('troco é a diferença, e nunca negativo', () => {
  assert.equal(calcularTroco(100, 75), 25)
  assert.equal(calcularTroco(75, 75), 0)
  assert.equal(calcularTroco(50, 75), 0)
})

test('troco arredonda para centavos', () => {
  assert.equal(calcularTroco(100, 33.333), 66.67)
})

test('troco aceita valor com vírgula, como o cliente digita', () => {
  assert.equal(calcularTroco('100,50', 75), 25.5)
})

// 5. validação do que foi digitado
test('valor pago abaixo do total é recusado com a mensagem certa', () => {
  const erro = validarValorPago('50', 75)

  assert.ok(erro)
  assert.match(erro, /R\$ 75,00/)
})

test('valor pago igual ou acima do total passa', () => {
  assert.equal(validarValorPago('75', 75), null)
  assert.equal(validarValorPago('100', 75), null)
})

test('campo vazio não é erro — só significa que ainda não escolheu', () => {
  assert.equal(validarValorPago('', 75), null)
  assert.equal(validarValorPago(null, 75), null)
})

test('texto que não é número é recusado', () => {
  assert.ok(validarValorPago('abc', 75))
})
