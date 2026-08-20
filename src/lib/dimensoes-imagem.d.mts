export declare const LARGURAS_PERMITIDAS: readonly number[]
export declare const QUALIDADE_PADRAO: number
export declare function normalizarLargura(valor: unknown): number | null
export declare function normalizarQualidade(valor: unknown): number
export declare function deveConverter(tipoMime: unknown): boolean
export declare function larguraDeSaida(
  pedida: number,
  daFonte: number | null | undefined,
): number
