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
