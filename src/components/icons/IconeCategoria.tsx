'use client'

import {
  Baby,
  BadgePercent,
  Blend,
  Brush,
  Crown,
  Droplets,
  Flame,
  FlaskConical,
  Flower2,
  Gem,
  Hand,
  Leaf,
  Package,
  Palette,
  Pipette,
  Scissors,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  SprayCan,
  Sprout,
  Tag,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { ICONE_CATEGORIA_PADRAO, iconeValido } from '@/lib/categorias.mjs'

/**
 * Mapa id → componente do ícone da categoria.
 *
 * **Mora aqui, e não em `src/lib/categorias.mjs`,** porque import de ícone é
 * apresentação — e porque `src/lib/*.mjs` está fora do `content` do Tailwind,
 * então classe declarada lá não seria gerada.
 *
 * **E mora em `components/icons/`, não em `admin/produtos/`,** porque quem
 * desenha o ícone da categoria são as duas pontas: o seletor do Admin e o
 * catálogo do cliente. Enquanto ele vivia dentro da pasta do Admin, o `Header`
 * do site importava de `@/components/admin/produtos/…` — sintoma de que a peça
 * estava no lugar errado.
 *
 * Todo componente aqui foi conferido no `lucide-react` 0.312.0 instalado.
 */
const COMPONENTES: Record<string, LucideIcon> = {
  etiqueta: Tag,

  banho: ShowerHead,

  cachos: Waves,
  liso: Wind,

  hidratacao: Droplets,
  nutricao: Leaf,
  reconstrucao: ShieldCheck,
  tratamento: FlaskConical,
  couro: Sprout,

  finalizador: SprayCan,
  oleo: Pipette,
  protecao: Flame,

  coloracao: Palette,
  matizador: Blend,

  kit: Package,
  promocao: BadgePercent,
  premium: Crown,

  infantil: Baby,

  ferramenta: Scissors,
  escova: Brush,
  acessorio: Gem,

  maquiagem: Sparkles,
  pele: Hand,
  perfume: Flower2,
}

type IconeCategoriaProps = {
  icone: string | null | undefined
  className?: string
  strokeWidth?: number
}

export const IconeCategoria = ({
  icone,
  className,
  strokeWidth = 1.8,
}: IconeCategoriaProps) => {
  const Componente = COMPONENTES[iconeValido(icone)] ?? COMPONENTES[ICONE_CATEGORIA_PADRAO]
  return <Componente className={className} strokeWidth={strokeWidth} aria-hidden />
}
