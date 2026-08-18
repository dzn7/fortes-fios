'use client'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ICONES_CATEGORIA, iconeValido } from '@/lib/categorias.mjs'
import { IconeCategoria } from '@/components/icons/IconeCategoria'

type SeletorIconeCategoriaProps = {
  valor: string
  onChange: (icone: string) => void
}

/**
 * Grade de ícones, tudo à vista.
 *
 * Um `Select` esconderia atrás de um clique e de uma lista uma decisão que é
 * visual por natureza — o ícone é o que o cliente reconhece no filtro da loja
 * antes de ler o nome. A grade cresceu de 12 para 24 opções: com doze, faltava
 * vocabulário de loja de cabelo e "Hidratação" acabava com a etiqueta genérica.
 */
export function SeletorIconeCategoria({ valor, onChange }: SeletorIconeCategoriaProps) {
  const selecionado = iconeValido(valor)

  return (
    <div className="space-y-2">
      <Label>Ícone</Label>
      <div className="grid grid-cols-6 gap-1.5">
        {ICONES_CATEGORIA.map((icone) => {
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
              <IconeCategoria icone={icone.id} className="size-[18px]" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
