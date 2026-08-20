export type ItemPagina = number | 'inicio-ellipsis' | 'fim-ellipsis'
export declare function totalDePaginas(totalItens: unknown, porPagina: unknown): number
export declare function normalizarPagina(pagina: unknown, totalPaginas: unknown): number
export declare function fatiarPagina<T>(
  itens: T[] | null | undefined,
  pagina: unknown,
  porPagina: unknown,
): { visiveis: T[]; primeiro: number; ultimo: number; pagina: number; totalPaginas: number }
export declare function janelaDePaginas(paginaAtual: number, totalPaginas: number): ItemPagina[]
