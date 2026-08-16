'use client'

import {
  Baby,
  Bath,
  Gift,
  Package,
  Palette,
  Scissors,
  Sparkles,
  Tag,
  Waves,
  Wind,
  Droplets,
  Percent,
  type LucideIcon,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ICONES_CATEGORIA, ICONE_CATEGORIA_PADRAO, iconeValido } from '@/lib/categorias.mjs'

/**
 * Mapa id → componente.
 *
 * Fica aqui, e não em `src/lib/categorias.mjs`, porque import de ícone é
 * apresentação — e porque `src/lib/*.mjs` está fora do `content` do Tailwind,
 * então qualquer classe declarada lá não seria gerada.
 */
const COMPONENTES: Record<string, LucideIcon> = {
  etiqueta: Tag,
  banho: Bath,
  cachos: Waves,
  liso: Wind,
  tratamento: Droplets,
  kit: Package,
  coloracao: Palette,
  infantil: Baby,
  ferramenta: Scissors,
  maquiagem: Sparkles,
  pele: Gift,
  promocao: Percent,
}

export const IconeCategoria = ({
  icone,
  className,
}: {
  icone: string | null | undefined
  className?: string
}) => {
  const Componente = COMPONENTES[iconeValido(icone)] ?? COMPONENTES[ICONE_CATEGORIA_PADRAO]
  return <Componente className={className} strokeWidth={1.8} aria-hidden />
}

type SeletorIconeCategoriaProps = {
  valor: string
  onChange: (icone: string) => void
}

/**
 * Grade de ícones, tudo à vista.
 *
 * Doze opções cabem numa grade que se lê de uma vez — um `Select` esconderia a
 * escolha atrás de um clique e de uma lista, para uma decisão que é visual por
 * natureza. O ícone é o que o cliente reconhece no filtro da loja antes de ler
 * o nome.
 */
export function SeletorIconeCategoria({ valor, onChange }: SeletorIconeCategoriaProps) {
  const selecionado = iconeValido(valor)

  return (
    <div className="space-y-2">
      <Label>Ícone</Label>
      <div className="grid grid-cols-6 gap-1.5">
        {ICONES_CATEGORIA.map((icone) => {
          const Componente = COMPONENTES[icone.id] ?? Tag
          const ativo = selecionado === icone.id

          return (
            <button
              key={icone.id}
              type="button"
              onClick={() => onChange(icone.id)}
              title={icone.rotulo}
              aria-label={icone.rotulo}
              aria-pressed={ativo}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg border transition-colors',
                ativo
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Componente className="size-[18px]" strokeWidth={1.8} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
