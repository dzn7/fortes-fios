export declare const TERMO_MINIMO: number
export declare const LIMITE_RESULTADOS: number
export declare function buscarProdutos<T extends { id?: unknown; disponivel?: unknown }>(
  produtos: T[] | null | undefined,
  busca: unknown,
  limite?: number,
): { itens: T[]; total: number; temMais: boolean }
