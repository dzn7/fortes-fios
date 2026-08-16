/**
 * WhatsApp: número, link e mensagens.
 *
 * Existia em quatro lugares com quatro regras diferentes. Aqui fica a regra
 * única, testável sem browser, como `notificacoes.mjs` e `rbac.mjs`.
 *
 * **Por que `api.whatsapp.com/send` e não `wa.me`:** no Safari do iOS o `wa.me`
 * passa por um redirecionamento que, aberto de dentro de um handler assíncrono,
 * frequentemente cai em "página não encontrada" ou perde o texto. O endpoint
 * `api.whatsapp.com/send` resolve direto para o app instalado e para o WhatsApp
 * Web no desktop, sem salto intermediário.
 */

/**
 * WhatsApp oficial da loja.
 *
 * Existe como padrão porque o canal de contato **não pode depender de uma linha
 * de configuração existir**: sem isso, apagar a chave `whatsapp_numero` faz o
 * botão do cabeçalho desaparecer em silêncio — foi o que aconteceu. A
 * configuração continua vencendo quando está preenchida; este valor é o chão.
 */
export const NUMERO_WHATSAPP_PADRAO = '5586981428538'

/** Menor comprimento plausível: DDD + 8 dígitos. Abaixo disso é dado sujo. */
const MINIMO_DIGITOS = 10
const MAXIMO_DIGITOS = 13

/**
 * Devolve o número em formato internacional só com dígitos, ou `null` quando
 * não dá para confiar. `null` é melhor que link torto: link torto abre o
 * WhatsApp em uma conversa que não existe e o cliente acha que enviou.
 *
 * @param {unknown} valor
 */
export const normalizarNumeroWhatsApp = (valor) => {
  if (typeof valor !== 'string') return null

  const digitos = valor.replace(/\D/g, '')
  if (digitos.length < MINIMO_DIGITOS || digitos.length > MAXIMO_DIGITOS) return null

  // Sem código do país, assume Brasil — é o único mercado da loja.
  const completo = digitos.startsWith('55') ? digitos : `55${digitos}`
  if (completo.length < 12 || completo.length > 13) return null

  return completo
}

/**
 * Link da conversa. Número inválido ou ausente cai no oficial da loja, em vez de
 * devolver `null` e sumir com o botão.
 *
 * @param {unknown} numero
 * @param {string} mensagem
 */
export const linkWhatsApp = (numero, mensagem = '') => {
  const normalizado =
    normalizarNumeroWhatsApp(numero) || normalizarNumeroWhatsApp(NUMERO_WHATSAPP_PADRAO)
  if (!normalizado) return null

  // `encodeURIComponent` preserva `\n` como %0A, que o WhatsApp lê como quebra.
  const texto = mensagem ? `&text=${encodeURIComponent(mensagem)}` : ''
  return `https://api.whatsapp.com/send?phone=${normalizado}${texto}`
}

/** @param {unknown} nome */
export const primeiroNome = (nome) => {
  if (typeof nome !== 'string') return 'cliente'
  const limpo = nome.trim()
  if (!limpo) return 'cliente'
  return limpo.split(/\s+/)[0]
}

const moeda = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 'R$ 0,00'
  return `R$ ${numero.toFixed(2).replace('.', ',')}`
}

const concordar = (quantidade, singular, plural) =>
  `${quantidade} ${quantidade === 1 ? singular : plural}`

/**
 * Follow-ups da ficha do cliente.
 *
 * Três, de propósito: um punhado de opções se lê de relance e se escolhe sem
 * pensar; uma lista longa vira uma segunda decisão antes da conversa. Cobrem os
 * três momentos que a loja realmente tem — retomar quem sumiu, avisar novidade
 * e agradecer quem comprou.
 */
export const FOLLOWUPS_CLIENTE = [
  {
    id: 'retomada',
    rotulo: 'Sentimos sua falta',
    descricao: 'Para quem não compra há um tempo',
    texto: ({ nome }) =>
      `Oi, ${primeiroNome(nome)}! Tudo bem?\n\n` +
      `Faz um tempinho que você não passa aqui na Fortes Fios e a gente lembrou de você. ` +
      `Chegaram novidades que combinam com o que você já levou.\n\n` +
      `Quer que eu te mostre?`,
  },
  {
    id: 'novidades',
    rotulo: 'Novidades da loja',
    descricao: 'Avisar sobre produtos que chegaram',
    texto: ({ nome }) =>
      `Oi, ${primeiroNome(nome)}! Tudo bem?\n\n` +
      `Chegaram produtos novos aqui na Fortes Fios e separei alguns que acho que você vai gostar.\n\n` +
      `Posso te mandar as fotos e os valores?`,
  },
  {
    id: 'agradecimento',
    rotulo: 'Agradecer a compra',
    descricao: 'Depois de um pedido entregue',
    texto: ({ nome }) =>
      `Oi, ${primeiroNome(nome)}! Tudo bem?\n\n` +
      `Passando para agradecer a sua compra na Fortes Fios. ` +
      `Espero que tenha gostado!\n\n` +
      `Se precisar de qualquer coisa, é só chamar por aqui.`,
  },
]

/**
 * @param {string} id
 * @param {{ nome?: string }} dados
 */
export const montarFollowUp = (id, dados = {}) => {
  const followup = FOLLOWUPS_CLIENTE.find((item) => item.id === id)
  return followup ? followup.texto(dados) : null
}

const ROTULO_TIPO_ENTREGA = {
  entrega: 'Entrega',
  retirada: 'Retirada na loja',
  mesa: 'Consumo no local',
}

/**
 * Mensagem que o CLIENTE envia para a loja ao fechar o pedido.
 *
 * Escrita para ser lida no celular pela pessoa que vai atender: cabeçalho com o
 * número do pedido, itens, e só então os dados que mudam conforme o tipo. Nada
 * de emoji decorativo em cada linha — a mensagem é um documento de trabalho.
 *
 * @param {{
 *   numeroPedido?: number|string,
 *   nomeCliente?: string,
 *   telefone?: string,
 *   tipoEntrega?: string,
 *   formaPagamento?: string,
 *   trocoPara?: number|null,
 *   total?: number,
 *   taxaEntrega?: number|null,
 *   endereco?: string,
 *   bairro?: string,
 *   cidade?: string,
 *   pontoReferencia?: string,
 *   observacoes?: string,
 *   itens?: Array<{ nome?: string, quantidade?: number, subtotal?: number }>,
 * }} pedido
 */
export const mensagemPedidoParaLoja = (pedido) => {
  const dados = pedido || {}
  const itens = Array.isArray(dados.itens) ? dados.itens : []
  const totalUnidades = itens.reduce((soma, item) => soma + (Number(item?.quantidade) || 0), 0)

  const linhas = [
    `*Pedido #${dados.numeroPedido ?? '—'}*`,
    '',
    `*Cliente:* ${String(dados.nomeCliente || '').trim() || 'não informado'}`,
  ]

  if (dados.telefone) linhas.push(`*Telefone:* ${dados.telefone}`)

  const tipo = String(dados.tipoEntrega || '').toLowerCase()
  linhas.push(`*Tipo:* ${ROTULO_TIPO_ENTREGA[tipo] || 'Retirada na loja'}`)
  linhas.push(`*Pagamento:* ${String(dados.formaPagamento || '').trim() || 'a combinar'}`)

  const troco = Number(dados.trocoPara)
  if (Number.isFinite(troco) && troco > 0) {
    linhas.push(`*Troco para* ${moeda(troco)}`)
  }

  if (itens.length > 0) {
    linhas.push('', `*Itens (${concordar(totalUnidades, 'item', 'itens')})*`)
    for (const item of itens) {
      const quantidade = Number(item?.quantidade) || 0
      const nome = String(item?.nome || 'Produto').trim()
      linhas.push(`• ${quantidade}x ${nome} — ${moeda(item?.subtotal)}`)
    }
  }

  // Só o pedido de entrega carrega endereço: em retirada, esses campos ou estão
  // vazios ou trazem lixo de um pedido anterior.
  if (tipo === 'entrega') {
    linhas.push('', '*Entrega*')
    if (dados.endereco) linhas.push(`Endereço: ${dados.endereco}`)
    if (dados.bairro) linhas.push(`Bairro: ${dados.bairro}`)
    if (dados.cidade) linhas.push(`Cidade: ${dados.cidade}`)
    if (dados.pontoReferencia) linhas.push(`Referência: ${dados.pontoReferencia}`)

    const taxa = Number(dados.taxaEntrega)
    if (Number.isFinite(taxa) && taxa > 0) linhas.push(`Taxa de entrega: ${moeda(taxa)}`)
  }

  const observacoes = String(dados.observacoes || '').trim()
  if (observacoes) {
    linhas.push('', '*Observações*', observacoes)
  }

  linhas.push('', `*Total: ${moeda(dados.total)}*`)

  return linhas.join('\n')
}
