export type FormatoDepoimento = 'vertical' | 'horizontal'

export type Depoimento = {
  id: string
  nome: string
  imagemUrl: string
  formato: FormatoDepoimento
  ativo: boolean
}

export type ConfiguracaoDepoimentos = {
  ativo: boolean
  titulo: string
  chamada: string
  depoimentos: Depoimento[]
}

export type DescritorFormato = {
  id: FormatoDepoimento
  rotulo: string
  ajuda: string
  /** Largura ÷ altura. A tradução para classe mora no componente. */
  proporcao: number
}

export const CHAVE_DEPOIMENTOS: string
export const LIMITE_DEPOIMENTOS: number
export const FORMATOS_DEPOIMENTO: DescritorFormato[]
export const CONFIGURACAO_DEPOIMENTOS_PADRAO: ConfiguracaoDepoimentos

export function formatoDepoimento(id: string): DescritorFormato
export function normalizarConfiguracaoDepoimentos(
  valor: string | null | undefined,
): ConfiguracaoDepoimentos
export function depoimentosVisiveis(
  configuracao: ConfiguracaoDepoimentos | null | undefined,
): Depoimento[]
export function reordenarDepoimentos<T>(lista: T[], indice: number, direcao: number): T[]
export function criarIdDepoimento(): string
