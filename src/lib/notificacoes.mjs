import { obterSituacaoEstoque } from './estoque-produto.mjs'

/**
 * Domínio da Central de Notificações do Admin.
 *
 * Espelha em JavaScript a regra que o banco aplica nos triggers, para que o
 * comportamento seja testável sem banco — mesmo padrão de `estoque-produto.mjs`.
 * O banco continua sendo a autoridade: quem abre e resolve notificação é a
 * função SQL, não a UI.
 */

export const TIPOS_NOTIFICACAO = {
  ESTOQUE_ESGOTADO: 'estoque_esgotado',
  ESTOQUE_BAIXO: 'estoque_baixo',
  PEDIDO_NOVO: 'pedido_novo',
  CLIENTE_INATIVO: 'cliente_inativo',
}

export const PRIORIDADES = {
  URGENTE: 'urgente',
  NORMAL: 'normal',
}

/** Quantos alertas o modal de entrada mostra antes de resumir em "e mais N". */
export const LIMITE_MODAL = 3

/**
 * Horas que um pedido pode ficar sem atendimento antes de a notificação
 * escalar de `normal` para `urgente`. Doze horas evitam urgência falsa durante
 * a madrugada e ainda sinalizam pedido esquecido no mesmo dia.
 */
export const HORAS_PEDIDO_URGENTE = 12

/**
 * Dias sem comprar até o cliente virar oportunidade de reativação.
 *
 * Sete é o intervalo em que a loja ainda está fresca na memória e um "sentimos
 * sua falta" soa atencioso — mais que isso vira cobrança, menos vira insistência.
 */
export const DIAS_CLIENTE_INATIVO = 7

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000

/** Status em que o pedido ainda depende de uma ação do administrador. */
const STATUS_PEDIDO_AGUARDANDO = new Set(['pendente', 'aguardando_pagamento'])

const MILISSEGUNDOS_POR_HORA = 60 * 60 * 1000

/** @param {string} tipo @param {string} entidadeId */
export const chaveDedupe = (tipo, entidadeId) => `${tipo}:${entidadeId}`

/** @param {number} valor @param {string} singular @param {string} plural */
const concordar = (valor, singular, plural) => `${valor} ${valor === 1 ? singular : plural}`

/**
 * Descritor da notificação de estoque de um produto, ou `null` quando o
 * produto não precisa de atenção. A situação vem da mesma função usada pelo
 * catálogo e pela tela de Estoque — não há segunda regra de "baixo".
 *
 * @param {{ id?: string, nome?: string, estoque_quantidade?: unknown, estoque_minimo?: unknown }} produto
 */
export const descreverNotificacaoEstoque = (produto) => {
  if (!produto?.id) return null

  const situacao = obterSituacaoEstoque(produto)
  if (situacao === 'em_estoque') return null

  const quantidade = Number(produto.estoque_quantidade) || 0
  const minimo = Number(produto.estoque_minimo) || 0
  const nome = produto.nome || 'Produto'

  const tipo =
    situacao === 'esgotado'
      ? TIPOS_NOTIFICACAO.ESTOQUE_ESGOTADO
      : TIPOS_NOTIFICACAO.ESTOQUE_BAIXO

  return {
    tipo,
    prioridade: PRIORIDADES.URGENTE,
    titulo: situacao === 'esgotado' ? 'Produto esgotado' : 'Estoque baixo',
    mensagem:
      situacao === 'esgotado'
        ? `${nome} está sem estoque.`
        : `${nome} possui apenas ${concordar(quantidade, 'unidade', 'unidades')}.`,
    entidade_tipo: 'produto',
    entidade_id: produto.id,
    dados: { quantidade, minimo },
    chave_dedupe: chaveDedupe(tipo, produto.id),
  }
}

/**
 * Descritor da notificação de um pedido que ainda aguarda atendimento, ou
 * `null`. A chave de deduplicação não muda quando a prioridade escala: é o
 * mesmo alerta ficando mais grave, não um alerta novo.
 *
 * @param {{ id?: string, numero_pedido?: unknown, nome_cliente?: string, status?: string, created_at?: string }} pedido
 * @param {Date} agora
 */
export const descreverNotificacaoPedido = (pedido, agora = new Date()) => {
  if (!pedido?.id) return null

  const status = String(pedido.status || '').trim().toLowerCase()
  if (!STATUS_PEDIDO_AGUARDANDO.has(status)) return null

  const criadoEm = pedido.created_at ? new Date(pedido.created_at) : null
  const horasParado =
    criadoEm && !Number.isNaN(criadoEm.getTime())
      ? Math.floor((agora.getTime() - criadoEm.getTime()) / MILISSEGUNDOS_POR_HORA)
      : 0

  const urgente = horasParado >= HORAS_PEDIDO_URGENTE
  const numero = pedido.numero_pedido ?? '—'
  const cliente = pedido.nome_cliente || 'cliente não identificado'

  return {
    tipo: TIPOS_NOTIFICACAO.PEDIDO_NOVO,
    prioridade: urgente ? PRIORIDADES.URGENTE : PRIORIDADES.NORMAL,
    titulo: urgente ? 'Pedido parado' : 'Pedido novo',
    mensagem: urgente
      ? `Pedido #${numero} de ${cliente} está há ${concordar(horasParado, 'hora', 'horas')} sem atendimento.`
      : `Pedido #${numero} de ${cliente} aguarda atendimento.`,
    entidade_tipo: 'pedido',
    entidade_id: pedido.id,
    dados: { numero_pedido: pedido.numero_pedido ?? null, horas_parado: horasParado },
    chave_dedupe: chaveDedupe(TIPOS_NOTIFICACAO.PEDIDO_NOVO, pedido.id),
  }
}

/**
 * Cliente que comprou e sumiu. Diferente de estoque e pedido, aqui não há
 * problema a resolver — há oportunidade a aproveitar, então a prioridade é
 * `normal` e o alerta nunca escala.
 *
 * Quem nunca comprou não entra: não é reativação, é prospecção, e o follow-up
 * de "sentimos sua falta" não faria sentido.
 *
 * @param {{ id?: string, nome?: string, telefone?: string, ultimo_pedido_em?: string }} cliente
 * @param {Date} agora
 */
export const descreverNotificacaoCliente = (cliente, agora = new Date()) => {
  if (!cliente?.id) return null
  if (!cliente.ultimo_pedido_em) return null

  const ultimoPedido = new Date(cliente.ultimo_pedido_em)
  if (Number.isNaN(ultimoPedido.getTime())) return null

  const dias = Math.floor((agora.getTime() - ultimoPedido.getTime()) / MILISSEGUNDOS_POR_DIA)
  if (dias < DIAS_CLIENTE_INATIVO) return null

  const nome = (cliente.nome || '').trim() || 'Cliente'

  return {
    tipo: TIPOS_NOTIFICACAO.CLIENTE_INATIVO,
    prioridade: PRIORIDADES.NORMAL,
    titulo: 'Cliente sem comprar',
    mensagem: `${nome} não compra há ${concordar(dias, 'dia', 'dias')}.`,
    entidade_tipo: 'cliente',
    entidade_id: cliente.id,
    dados: { dias, telefone: cliente.telefone ?? null },
    chave_dedupe: chaveDedupe(TIPOS_NOTIFICACAO.CLIENTE_INATIVO, cliente.id),
  }
}

/** @param {{ visualizada_em?: unknown, lida_em?: unknown }} notificacao */
export const estadoLeitura = (notificacao) => {
  if (notificacao?.lida_em) return 'lida'
  if (notificacao?.visualizada_em) return 'visualizada'
  return 'nova'
}

/**
 * O modal de entrada só interrompe por algo que o usuário ainda não viu.
 * Silenciar dispensa a ocorrência; uma reincidência é uma linha nova e volta.
 *
 * @param {{ estado?: string, visualizada_em?: unknown, lida_em?: unknown, silenciada_em?: unknown }} notificacao
 */
export const notificacaoAbreModal = (notificacao) =>
  notificacao?.estado === 'ativa' &&
  !notificacao.visualizada_em &&
  !notificacao.lida_em &&
  !notificacao.silenciada_em

/**
 * Uma notificação ocupa a lista ativa e os contadores enquanto a condição
 * existir E o usuário não a tiver dispensado. Espelha o `where` de
 * `resumo_notificacoes`/`listar_notificacoes` — sem esse espelho, a marcação
 * otimista do cliente diverge do que o servidor devolve logo em seguida.
 *
 * @param {{ estado?: string, silenciada_em?: unknown }} notificacao
 */
export const notificacaoVisivelNaCentral = (notificacao) =>
  notificacao?.estado === 'ativa' && !notificacao.silenciada_em

/**
 * Histórico: o que saiu da lista ativa, seja porque a condição acabou
 * (resolvida) ou porque o usuário dispensou a ocorrência.
 *
 * @param {{ estado?: string, silenciada_em?: unknown }} notificacao
 */
export const notificacaoNoHistorico = (notificacao) =>
  notificacao?.estado === 'resolvida' || Boolean(notificacao?.silenciada_em)

const pesoPrioridade = (notificacao) =>
  notificacao?.prioridade === PRIORIDADES.URGENTE ? 0 : 1

const instante = (valor) => {
  const data = valor ? new Date(valor) : null
  return data && !Number.isNaN(data.getTime()) ? data.getTime() : 0
}

/**
 * @param {Array<Record<string, unknown>>} lista
 * @param {number} limite
 */
export const selecionarNotificacoesDoModal = (lista, limite = LIMITE_MODAL) =>
  (Array.isArray(lista) ? lista : [])
    .filter(notificacaoAbreModal)
    .sort(
      (a, b) =>
        pesoPrioridade(a) - pesoPrioridade(b) || instante(b.criada_em) - instante(a.criada_em),
    )
    .slice(0, Math.max(0, limite))

/** @param {Array<Record<string, unknown>>} lista */
export const agruparPorPrioridade = (lista) => {
  const itens = Array.isArray(lista) ? lista : []
  return {
    urgentes: itens.filter((item) => item?.prioridade === PRIORIDADES.URGENTE),
    normais: itens.filter((item) => item?.prioridade !== PRIORIDADES.URGENTE),
  }
}

const RESUMO_ZERO = { urgentes: 0, normais: 0, naoLidas: 0, total: 0 }

/**
 * Quanto uma única notificação soma ao badge. Usada para ajustar os contadores
 * por DELTA depois de uma ação local: a lista do painel vem truncada, então
 * recontar a coleção inteira derrubaria o badge para o tamanho da página.
 *
 * @param {Record<string, unknown>} notificacao
 */
export const contribuicaoResumo = (notificacao) => {
  if (!notificacaoVisivelNaCentral(notificacao)) return { ...RESUMO_ZERO }

  const urgente = notificacao.prioridade === PRIORIDADES.URGENTE
  return {
    urgentes: urgente ? 1 : 0,
    normais: urgente ? 0 : 1,
    naoLidas: notificacao.lida_em ? 0 : 1,
    total: 1,
  }
}

/**
 * Diferença entre o retrato anterior e o novo da MESMA notificação, no formato
 * do resumo. Marcar como lida devolve `naoLidas: -1`; dispensar zera as quatro.
 *
 * @param {Record<string, unknown>} antes
 * @param {Record<string, unknown>} depois
 */
export const deltaResumo = (antes, depois) => {
  const a = contribuicaoResumo(antes)
  const b = contribuicaoResumo(depois)
  return {
    urgentes: b.urgentes - a.urgentes,
    normais: b.normais - a.normais,
    naoLidas: b.naoLidas - a.naoLidas,
    total: b.total - a.total,
  }
}

/**
 * Contadores do badge derivados de uma coleção já carregada. O caminho de
 * produção usa `resumo_notificacoes` no banco; esta função existe para o
 * cliente recontar sem ir ao servidor depois de uma ação local.
 *
 * @param {Array<Record<string, unknown>>} lista
 */
export const resumirNotificacoes = (lista) => {
  const resumo = { ...RESUMO_ZERO }

  for (const item of Array.isArray(lista) ? lista : []) {
    const parcela = contribuicaoResumo(item)
    resumo.urgentes += parcela.urgentes
    resumo.normais += parcela.normais
    resumo.naoLidas += parcela.naoLidas
    resumo.total += parcela.total
  }

  return resumo
}

/** @param {{ entidade_tipo?: unknown, entidade_id?: unknown }} notificacao */
export const rotaDaNotificacao = (notificacao) => {
  const id = notificacao?.entidade_id
  if (!id) return null
  if (notificacao.entidade_tipo === 'produto') {
    return `/admin/estoque?produto=${encodeURIComponent(String(id))}`
  }
  if (notificacao.entidade_tipo === 'pedido') {
    return `/admin/pedidos/${encodeURIComponent(String(id))}`
  }
  if (notificacao.entidade_tipo === 'cliente') {
    // Abre a ficha já com o seletor de follow-up à mão.
    return `/admin/usuarios?cliente=${encodeURIComponent(String(id))}`
  }
  return null
}
