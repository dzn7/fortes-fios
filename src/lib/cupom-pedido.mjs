/**
 * Leitura do cupom gravado no pedido.
 *
 * **`desconto_cupom` guarda o valor em REAIS já calculado, não o percentual.**
 * Conferido na produção em 2026-08-20: 40 − 2 = 38, 60 − 3 = 57,
 * 48 − 2,4 = 45,6, 54,5 − 2,73 = 51,77. O percentual original do cupom não é
 * gravado no pedido, então a tela mostra o código e o valor descontado — exibir
 * porcentagem exigiria inventar.
 *
 * Spec: specs/cupom-no-pedido-admin.md
 */

const ehObjeto = (valor) => typeof valor === 'object' && valor !== null

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * Valor descontado, normalizado. Aceita string porque o PostgREST devolve
 * `numeric` como texto em parte das rotas.
 *
 * @param {unknown} pedido
 * @returns {number}
 */
export const valorDescontadoCupom = (pedido) => {
  if (!ehObjeto(pedido)) return 0
  const bruto = /** @type {{ desconto_cupom?: unknown }} */ (pedido).desconto_cupom
  if (typeof bruto !== 'number' && typeof bruto !== 'string') return 0
  const numero = Number(bruto)
  return Number.isFinite(numero) && numero > 0 ? numero : 0
}

/**
 * Qualquer um dos três campos basta.
 *
 * Os três, e não só `cupom_id`, porque pedido antigo pode ter gravação parcial
 * — e porque cupom que descontou zero (frete grátis sem frete, por exemplo)
 * continua sendo cupom usado, que é o fato que a pessoa do balcão precisa ver.
 *
 * @param {unknown} pedido
 * @returns {boolean}
 */
export const pedidoUsouCupom = (pedido) => {
  if (!ehObjeto(pedido)) return false
  const registro = /** @type {{ cupom_id?: unknown, cupom_codigo?: unknown }} */ (pedido)
  return (
    texto(registro.cupom_id).length > 0 ||
    texto(registro.cupom_codigo).length > 0 ||
    valorDescontadoCupom(pedido) > 0
  )
}

/**
 * Código em caixa alta, ou `Cupom` quando o pedido registrou o desconto sem o
 * código — esconder a linha seria pior que mostrá-la sem o nome.
 *
 * @param {unknown} pedido
 * @returns {string}
 */
export const rotuloCupom = (pedido) => {
  if (!ehObjeto(pedido)) return 'Cupom'
  const codigo = texto(/** @type {{ cupom_codigo?: unknown }} */ (pedido).cupom_codigo)
  return codigo.length > 0 ? codigo.toUpperCase() : 'Cupom'
}
