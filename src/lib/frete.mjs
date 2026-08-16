/**
 * Frete — fonte única da verdade.
 *
 * O cálculo estava inline no `ModalCarrinho`, em uma expressão que só conhecia
 * a cidade. Ao acrescentar a regra global de frete grátis, dois lugares
 * decidindo o mesmo número é como o valor mostrado ao cliente e o valor gravado
 * no pedido divergem. Aqui existe uma função só, testável sem browser, usada
 * pelo carrinho e por quem mais precisar.
 *
 * **Base do limite: o subtotal de produtos, antes de frete e antes de cupom.**
 * É o mesmo critério que `bairros.valor_minimo_pedido` já usava — inventar uma
 * segunda definição de "valor do pedido" faria o cliente ver "faltam R$ 18" e o
 * frete não zerar ao adicionar R$ 18.
 */

/** Regra desligada é o estado seguro: loja nenhuma dá frete por engano. */
export const CONFIG_FRETE_GRATIS_PADRAO = Object.freeze({ ativo: false, valorMinimo: 0 })

/** Atalhos do admin. Valores redondos, na faixa de ticket de uma loja de fios. */
export const SUGESTOES_VALOR_MINIMO = [50, 80, 100, 150, 200]

const paraNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return NaN
  const numero =
    typeof valor === 'number' ? valor : Number(String(valor).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : NaN
}

const arredondar = (valor) => Math.round(valor * 100) / 100

/**
 * Lê o que veio de `configuracoes_loja.valor`, que é texto e pode conter
 * qualquer coisa. Entrada inválida vira a regra desligada — nunca um frete
 * grátis universal por acidente.
 *
 * @param {unknown} bruto
 */
export const normalizarConfigFreteGratis = (bruto) => {
  let dados = bruto

  if (typeof bruto === 'string') {
    try {
      dados = JSON.parse(bruto)
    } catch {
      return { ...CONFIG_FRETE_GRATIS_PADRAO }
    }
  }

  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return { ...CONFIG_FRETE_GRATIS_PADRAO }
  }

  const valorMinimo = paraNumero(dados.valorMinimo)

  // `ativo` só vale sendo booleano de verdade: a string 'sim' virando `true`
  // ligaria a regra por acidente de digitação no banco.
  if (dados.ativo !== true || !Number.isFinite(valorMinimo) || valorMinimo <= 0) {
    return { ...CONFIG_FRETE_GRATIS_PADRAO }
  }

  return { ativo: true, valorMinimo: arredondar(valorMinimo) }
}

/**
 * Frete de um pedido.
 *
 * Ordem de precedência, e ela importa: a cidade com `entrega_gratis` zera o
 * frete sempre, inclusive com a regra global desligada — é uma decisão da loja
 * sobre aquela cidade, não uma promoção.
 *
 * @param {{
 *   tipoEntrega?: string,
 *   cidade?: { taxa_entrega?: number, entrega_gratis?: boolean } | null,
 *   subtotalProdutos?: number,
 *   configFreteGratis?: { ativo?: boolean, valorMinimo?: number },
 * }} entrada
 */
export const calcularFrete = (entrada) => {
  const dados = entrada || {}

  if (dados.tipoEntrega !== 'entrega' || !dados.cidade) {
    return { valor: 0, gratis: false, motivo: null, taxaCheia: 0 }
  }

  const taxaCheia = arredondar(Math.max(0, paraNumero(dados.cidade.taxa_entrega) || 0))

  if (dados.cidade.entrega_gratis === true) {
    return { valor: 0, gratis: true, motivo: 'cidade', taxaCheia }
  }

  const config = normalizarConfigFreteGratis(dados.configFreteGratis)
  const subtotal = Math.max(0, paraNumero(dados.subtotalProdutos) || 0)

  if (config.ativo && subtotal >= config.valorMinimo) {
    return { valor: 0, gratis: true, motivo: 'limite', taxaCheia }
  }

  return { valor: taxaCheia, gratis: false, motivo: null, taxaCheia }
}

/**
 * Quanto falta para o cliente ganhar frete grátis.
 *
 * `visivel: false` quando não há o que prometer — regra desligada, retirada, ou
 * cidade que já entrega de graça. Anunciar "faltam R$ 18" para quem escolheu
 * retirada é ruído.
 *
 * @param {{
 *   subtotalProdutos?: number,
 *   configFreteGratis?: { ativo?: boolean, valorMinimo?: number },
 *   tipoEntrega?: string,
 *   cidade?: { entrega_gratis?: boolean } | null,
 * }} entrada
 */
export const progressoFreteGratis = (entrada) => {
  const dados = entrada || {}
  const config = normalizarConfigFreteGratis(dados.configFreteGratis)

  const oculto = { visivel: false, atingiu: false, faltam: 0, percentual: 0, valorMinimo: 0 }

  if (!config.ativo) return oculto
  if (dados.tipoEntrega !== 'entrega') return oculto
  if (dados.cidade?.entrega_gratis === true) return oculto

  const subtotal = Math.max(0, paraNumero(dados.subtotalProdutos) || 0)
  const faltam = arredondar(Math.max(0, config.valorMinimo - subtotal))

  return {
    visivel: true,
    atingiu: faltam === 0,
    faltam,
    percentual: Math.min(100, Math.round((subtotal / config.valorMinimo) * 100)),
    valorMinimo: config.valorMinimo,
  }
}
