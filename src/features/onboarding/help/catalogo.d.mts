export type SecaoAjuda = {
  titulo: string
  corpo: string
}

export type ArtigoAjuda = {
  id: string
  rota: string | null
  titulo: string
  categoria: string
  virtual?: boolean
  palavrasChave: string[]
  resumo: string
  secoes: SecaoAjuda[]
}

export const ROTAS_ADMIN_REAIS: string[]
export const ROTAS_ADMIN_OCULTAS_AJUDA: string[]
export const ARTIGOS_AJUDA: ArtigoAjuda[]

export function obterArtigoPorRota(pathname: string): ArtigoAjuda | null
export function buscarArtigos(termo: string): ArtigoAjuda[]
export function listarArtigosPorCategoria(): Array<{
  categoria: string
  artigos: ArtigoAjuda[]
}>
export function auditarCoberturaAjuda(): {
  faltando: string[]
  extrasOcultos: string[]
}
