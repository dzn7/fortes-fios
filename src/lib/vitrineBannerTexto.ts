export const POSICOES_TEXTO_BANNER = [
  'superior_esquerda',
  'superior_centro',
  'superior_direita',
  'centro_esquerda',
  'centro',
  'centro_direita',
  'inferior_esquerda',
  'inferior_centro',
  'inferior_direita',
] as const

export type PosicaoTextoBanner = (typeof POSICOES_TEXTO_BANNER)[number]

export const POSICAO_TEXTO_BANNER_CLASSES: Record<
  PosicaoTextoBanner,
  string
> = {
  superior_esquerda: 'items-start justify-start text-left',
  superior_centro: 'items-start justify-center text-center',
  superior_direita: 'items-start justify-end text-right',
  centro_esquerda: 'items-center justify-start text-left',
  centro: 'items-center justify-center text-center',
  centro_direita: 'items-center justify-end text-right',
  inferior_esquerda: 'items-end justify-start text-left',
  inferior_centro: 'items-end justify-center text-center',
  inferior_direita: 'items-end justify-end text-right',
}

export const POSICAO_TEXTO_BANNER_ROTULOS: Record<
  PosicaoTextoBanner,
  string
> = {
  superior_esquerda: 'Superior esquerdo',
  superior_centro: 'Superior centralizado',
  superior_direita: 'Superior direito',
  centro_esquerda: 'Centro esquerdo',
  centro: 'Centro',
  centro_direita: 'Centro direito',
  inferior_esquerda: 'Inferior esquerdo',
  inferior_centro: 'Inferior centralizado',
  inferior_direita: 'Inferior direito',
}

export const ehPosicaoTextoBanner = (
  valor: unknown,
): valor is PosicaoTextoBanner =>
  POSICOES_TEXTO_BANNER.includes(valor as PosicaoTextoBanner)

export const FONTES_TEXTO_BANNER = [
  'quiche',
  'bricolage',
  'raleway',
  'geist',
] as const

export type FonteTextoBanner = (typeof FONTES_TEXTO_BANNER)[number]

export const FONTE_TEXTO_BANNER_ROTULOS: Record<FonteTextoBanner, string> = {
  quiche: 'Quiche Sans · Editorial',
  bricolage: 'Bricolage Grotesque · Impacto',
  raleway: 'Raleway · Minimalista',
  geist: 'Geist · Moderna',
}

export const FONTE_TEXTO_BANNER_CLASSES: Record<FonteTextoBanner, string> = {
  quiche: 'fonte-banner-quiche',
  bricolage: 'fonte-banner-bricolage',
  raleway: 'fonte-banner-raleway',
  geist: 'fonte-banner-geist',
}

export const PESOS_TITULO_BANNER = [
  'leve',
  'medio',
  'seminegrito',
  'negrito',
] as const

export type PesoTituloBanner = (typeof PESOS_TITULO_BANNER)[number]

export const PESO_TITULO_BANNER_ROTULOS: Record<PesoTituloBanner, string> = {
  leve: 'Leve',
  medio: 'Médio',
  seminegrito: 'Seminegrito',
  negrito: 'Negrito',
}

export const PESO_TITULO_BANNER_CLASSES: Record<PesoTituloBanner, string> = {
  leve: 'font-light',
  medio: 'font-medium',
  seminegrito: 'font-semibold',
  negrito: 'font-[700]',
}

export const ehFonteTextoBanner = (valor: unknown): valor is FonteTextoBanner =>
  FONTES_TEXTO_BANNER.includes(valor as FonteTextoBanner)

export const ehPesoTituloBanner = (
  valor: unknown,
): valor is PesoTituloBanner =>
  PESOS_TITULO_BANNER.includes(valor as PesoTituloBanner)
