/**
 * Troco no checkout.
 *
 * A versão anterior sugeria sempre `[20, 50, 100, 200]`, independente do valor
 * do pedido: num pedido de R$ 250 as quatro sugestões eram menores que a conta,
 * ou seja, todas inúteis. E não havia nenhuma validação — dava para pedir troco
 * para R$ 50 num pedido de R$ 75, e o problema só aparecia na entrega.
 *
 * Aqui as sugestões saem do total, e o cliente vê quanto vai receber de volta.
 */

const paraNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return NaN
  const numero =
    typeof valor === 'number' ? valor : Number(String(valor).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : NaN
}

const arredondar = (valor) => Math.round(valor * 100) / 100

const moeda = (valor) => `R$ ${arredondar(valor).toFixed(2).replace('.', ',')}`

/** Notas e múltiplos com que as pessoas realmente pagam. */
const DEGRAUS = [5, 10, 20, 50, 100]

/**
 * Quatro valores redondos acima do total, do mais próximo ao mais folgado.
 *
 * O primeiro é o arredondamento imediato (R$ 75 → R$ 80), que é o que quase
 * todo mundo escolhe; os demais abrem espaço para quem só tem nota maior.
 *
 * @param {number|string} total
 */
export const sugerirValoresTroco = (total) => {
  const base = Math.max(0, paraNumero(total) || 0)
  const valores = new Set()

  for (const degrau of DEGRAUS) {
    // `floor + 1` garante estritamente acima: com total exato de R$ 50, sugerir
    // R$ 50 não é troco nenhum.
    valores.add((Math.floor(base / degrau) + 1) * degrau)
  }

  // Em pedido alto os degraus colapsam no mesmo arredondamento (R$ 999 leva
  // todos a R$ 1.000). Aí a variedade vem de somar a maior nota.
  const passo = DEGRAUS.filter((degrau) => degrau <= Math.max(base, 5)).pop() || 5
  let ultimo = Math.max(...valores)
  while (valores.size < 4) {
    ultimo += passo
    valores.add(ultimo)
  }

  return Array.from(valores)
    .sort((a, b) => a - b)
    .slice(0, 4)
}

/**
 * @param {number|string} valorPago
 * @param {number|string} total
 */
export const calcularTroco = (valorPago, total) => {
  const pago = paraNumero(valorPago)
  const conta = paraNumero(total)

  if (!Number.isFinite(pago) || !Number.isFinite(conta)) return 0
  return arredondar(Math.max(0, pago - conta))
}

/**
 * Mensagem de erro, ou `null` quando está tudo certo. Campo vazio não é erro:
 * significa que a pessoa ainda não escolheu.
 *
 * @param {number|string|null} valorPago
 * @param {number|string} total
 */
export const validarValorPago = (valorPago, total) => {
  if (valorPago === null || valorPago === undefined || String(valorPago).trim() === '') {
    return null
  }

  const pago = paraNumero(valorPago)
  if (!Number.isFinite(pago)) return 'Informe um valor válido.'

  const conta = paraNumero(total) || 0
  if (pago < conta) return `Precisa ser pelo menos ${moeda(conta)}, o total do pedido.`

  return null
}
