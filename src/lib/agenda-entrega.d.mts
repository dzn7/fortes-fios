export type DiaSemanaEntrega = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type DescritorDiaEntrega = {
  valor: DiaSemanaEntrega
  curto: string
  nome: string
  recorrencia: string
}

export type PrazoEntrega = {
  texto: string
  /** `true` quando o texto é uma data; `false` quando é um prazo. */
  ehData: boolean
}

export const DIAS_SEMANA_ENTREGA: DescritorDiaEntrega[]
export const TODOS_DIAS_ENTREGA: DiaSemanaEntrega[]
export const PRAZO_ENTREGA_PADRAO: string

export function normalizarDiasEntrega(valor: unknown): DiaSemanaEntrega[]
export function calcularProximaDataEntrega(diasConfigurados: unknown, referencia?: Date): string
export function formatarDataPrevistaEntrega(dataIso: string): string
export function descreverAgendaEntrega(diasConfigurados: unknown): string
export function entregaTodosOsDias(diasConfigurados: unknown): boolean
export function descreverPrazoEntrega(diasConfigurados: unknown, referencia?: Date): PrazoEntrega
