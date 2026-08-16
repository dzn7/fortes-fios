export type ConfigFreteGratis = {
  ativo: boolean
  valorMinimo: number
}

export type CidadeEntrega = {
  nome?: string
  taxa_entrega?: number
  entrega_gratis?: boolean
} | null

export type ResultadoFrete = {
  valor: number
  gratis: boolean
  /** `cidade` quando a própria cidade entrega de graça; `limite` pela regra global. */
  motivo: 'cidade' | 'limite' | null
  taxaCheia: number
}

export type ProgressoFreteGratis = {
  visivel: boolean
  atingiu: boolean
  faltam: number
  percentual: number
  valorMinimo: number
}

export const CONFIG_FRETE_GRATIS_PADRAO: ConfigFreteGratis
export const SUGESTOES_VALOR_MINIMO: number[]

export function normalizarConfigFreteGratis(bruto: unknown): ConfigFreteGratis

export function calcularFrete(entrada: {
  tipoEntrega?: string
  cidade?: CidadeEntrega
  subtotalProdutos?: number
  configFreteGratis?: Partial<ConfigFreteGratis>
}): ResultadoFrete

export function progressoFreteGratis(entrada: {
  subtotalProdutos?: number
  configFreteGratis?: Partial<ConfigFreteGratis>
  tipoEntrega?: string
  cidade?: CidadeEntrega
}): ProgressoFreteGratis
