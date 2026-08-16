export type AparenciaStatusPedido = {
  rotulo: string
  classe: string
}

export type PedidoConsultaExibicao = {
  id: string
  numeroExibicao: string
  nomeCliente: string
  telefone: string
  status: string | null
  tipoEntrega: string
  formaPagamento: string
  total: number
  criadoEm: string | null
  observacoes: string
}

export const STATUS_PEDIDO_CLIENTE: string[]

export function aparenciaStatusPedido(status: unknown): AparenciaStatusPedido
export function formatarDataPedido(valor: unknown): string
export function normalizarPedidoConsulta(
  bruto: Record<string, unknown> | null,
): PedidoConsultaExibicao | null
export function telefoneEhConsultavel(telefone: unknown): boolean
