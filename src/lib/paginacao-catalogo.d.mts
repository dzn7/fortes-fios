export declare const TAMANHO_LOTE_CATALOGO: number
export declare function fatiarCatalogo<T>(
  itens: T[] | null | undefined,
  limite?: number,
): { visiveis: T[]; temMais: boolean; restantes: number }
export declare function proximoLimite(
  limiteAtual: number,
  total: number,
  passo?: number,
): number
