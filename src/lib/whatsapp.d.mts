export type ItemPedidoWhatsApp = {
  nome?: string
  quantidade?: number
  subtotal?: number
}

export type PedidoWhatsApp = {
  numeroPedido?: number | string | null
  nomeCliente?: string
  telefone?: string
  tipoEntrega?: string
  formaPagamento?: string
  trocoPara?: number | null
  total?: number
  taxaEntrega?: number | null
  endereco?: string
  bairro?: string
  cidade?: string
  pontoReferencia?: string
  observacoes?: string
  itens?: ItemPedidoWhatsApp[]
}

export type FollowUpCliente = {
  id: string
  rotulo: string
  descricao: string
  texto: (dados: { nome?: string }) => string
}

export const NUMERO_WHATSAPP_PADRAO: string
export const FOLLOWUPS_CLIENTE: FollowUpCliente[]

export function normalizarNumeroWhatsApp(valor: unknown): string | null
export function linkWhatsApp(numero: unknown, mensagem?: string): string | null
export function primeiroNome(nome: unknown): string
export function montarFollowUp(id: string, dados?: { nome?: string }): string | null
export function mensagemPedidoParaLoja(pedido: PedidoWhatsApp): string
