/**
 * Regra global de frete grátis. Mora em `configuracoes_loja` (tabela chave/valor
 * que já guarda JSON em outras chaves) em vez de virar coluna nova — a estrutura
 * existente comporta, e o formato é validado por `normalizarConfigFreteGratis`.
 */
export const CHAVE_FRETE_GRATIS = 'entrega_frete_gratis'

export const CHAVE_TEMPO_ENTREGA = 'tempo_entrega_estimado'
export const CHAVE_TEMPO_RETIRADA = 'tempo_retirada_estimado'

export const TEMPO_ENTREGA_PADRAO = '20-30'
export const TEMPO_RETIRADA_PADRAO = '20-30'

const analisarTempoEstimado = (valor: unknown) => {
  const texto = typeof valor === 'string' ? valor.trim().replace(/[–—]/g, '-') : ''
  const correspondencia = texto.match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/)
  if (!correspondencia) return null

  const inicio = Number(correspondencia[1])
  const fim = correspondencia[2] ? Number(correspondencia[2]) : inicio
  if (inicio <= 0 || fim < inicio) return null

  return correspondencia[2] ? `${inicio}-${fim}` : String(inicio)
}

export const normalizarTempoEstimado = (valor: unknown, fallback: string) =>
  analisarTempoEstimado(valor) || fallback

export const tempoEstimadoValido = (valor: string) => Boolean(analisarTempoEstimado(valor))
