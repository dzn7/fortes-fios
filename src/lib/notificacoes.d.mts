export type TipoNotificacao = 'estoque_esgotado' | 'estoque_baixo' | 'pedido_novo'
export type PrioridadeNotificacao = 'urgente' | 'normal'
export type EstadoNotificacao = 'ativa' | 'resolvida'
export type EstadoLeituraNotificacao = 'nova' | 'visualizada' | 'lida'
export type EntidadeNotificacao = 'produto' | 'pedido'

/** Linha devolvida por `listar_notificacoes`, já com o estado do usuário. */
export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  prioridade: PrioridadeNotificacao
  titulo: string
  mensagem: string
  entidade_tipo: EntidadeNotificacao | null
  entidade_id: string | null
  dados: Record<string, unknown>
  estado: EstadoNotificacao
  criada_em: string
  resolvida_em: string | null
  visualizada_em: string | null
  lida_em: string | null
  silenciada_em: string | null
}

export type ResumoNotificacoes = {
  urgentes: number
  normais: number
  naoLidas: number
  total: number
}

/** Descritor de notificação derivado do estado de uma entidade. */
export type DescritorNotificacao = {
  tipo: TipoNotificacao
  prioridade: PrioridadeNotificacao
  titulo: string
  mensagem: string
  entidade_tipo: EntidadeNotificacao
  entidade_id: string
  dados: Record<string, unknown>
  chave_dedupe: string
}

export const TIPOS_NOTIFICACAO: {
  ESTOQUE_ESGOTADO: 'estoque_esgotado'
  ESTOQUE_BAIXO: 'estoque_baixo'
  PEDIDO_NOVO: 'pedido_novo'
}

export const PRIORIDADES: {
  URGENTE: 'urgente'
  NORMAL: 'normal'
}

export const LIMITE_MODAL: number
export const HORAS_PEDIDO_URGENTE: number

export function chaveDedupe(tipo: TipoNotificacao, entidadeId: string): string

export function descreverNotificacaoEstoque(produto: {
  id?: string
  nome?: string
  estoque_quantidade?: number | null
  estoque_minimo?: number | null
}): DescritorNotificacao | null

export function descreverNotificacaoPedido(
  pedido: {
    id?: string
    numero_pedido?: number | null
    nome_cliente?: string | null
    status?: string | null
    created_at?: string | null
  },
  agora?: Date,
): DescritorNotificacao | null

export function estadoLeitura(notificacao: {
  visualizada_em?: string | null
  lida_em?: string | null
}): EstadoLeituraNotificacao

export function notificacaoAbreModal(notificacao: {
  estado?: string
  visualizada_em?: string | null
  lida_em?: string | null
  silenciada_em?: string | null
}): boolean

export function notificacaoVisivelNaCentral(notificacao: {
  estado?: string
  silenciada_em?: string | null
}): boolean

export function notificacaoNoHistorico(notificacao: {
  estado?: string
  silenciada_em?: string | null
}): boolean

export function contribuicaoResumo(notificacao: Partial<Notificacao>): ResumoNotificacoes

export function deltaResumo(
  antes: Partial<Notificacao>,
  depois: Partial<Notificacao>,
): ResumoNotificacoes

export function selecionarNotificacoesDoModal<T extends Notificacao>(
  lista: T[],
  limite?: number,
): T[]

export function agruparPorPrioridade<T extends Notificacao>(
  lista: T[],
): { urgentes: T[]; normais: T[] }

export function resumirNotificacoes(lista: Notificacao[]): ResumoNotificacoes

export function rotaDaNotificacao(notificacao: {
  entidade_tipo?: string | null
  entidade_id?: string | null
}): string | null
