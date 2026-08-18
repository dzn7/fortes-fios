export type OrdenacaoCatalogo =
  | 'recomendados'
  | 'maior_desconto'
  | 'menor_preco'
  | 'maior_preco'
  | 'lancamentos'

export type OpcaoOrdenacao = {
  id: OrdenacaoCatalogo
  rotulo: string
}

export type ProdutoFiltravel = {
  nome?: string | null
  descricao?: string | null
  categoria?: string | null
  preco?: number | null
  preco_original?: number | null
  desconto?: number | null
  created_at?: string | null
}

export type FiltrosCatalogo = {
  busca?: string
  categoria?: string
  apenasOfertas?: boolean
  ordenacao?: OrdenacaoCatalogo
}

export const CATEGORIA_TODOS: string
export const ORDENACAO_PADRAO: OrdenacaoCatalogo
export const ORDENACOES_CATALOGO: OpcaoOrdenacao[]

export function normalizarOrdenacao(valor: unknown): OrdenacaoCatalogo
export function chaveTexto(valor: unknown): string
export function percentualDesconto(produto: ProdutoFiltravel | null): number
export function produtoEmOferta(produto: ProdutoFiltravel | null): boolean
export function textoBuscavelProduto(produto: ProdutoFiltravel | null): string
export function produtoAtendeBusca(produto: ProdutoFiltravel | null, busca: unknown): boolean
export function filtrarProdutos<T extends ProdutoFiltravel>(
  produtos: T[],
  filtros?: FiltrosCatalogo,
): T[]
export function ordenarProdutos<T extends ProdutoFiltravel>(
  produtos: T[],
  ordenacao: unknown,
): T[]
export function aplicarFiltrosCatalogo<T extends ProdutoFiltravel>(
  produtos: T[],
  filtros?: FiltrosCatalogo,
): T[]
export function contarFiltrosAtivos(filtros?: FiltrosCatalogo): number
