'use client'

import { Bell } from 'lucide-react'
import { ITENS_MENU_ADMIN } from '@/lib/admin-sidebar-routes'
import { cn } from '@/lib/utils'
import { listarArtigosPorCategoria } from '../help/catalogo.mjs'

type ModuleCatalogProps = {
  artigoAtivoId: string | null
  artigoDestaTelaId: string | null
  onSelecionar: (id: string) => void
}

export const ModuleCatalog = ({
  artigoAtivoId,
  artigoDestaTelaId,
  onSelecionar,
}: ModuleCatalogProps) => (
  <nav className="flex flex-col gap-4" aria-label="Áreas do painel">
    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      Todas as áreas
    </p>
    {listarArtigosPorCategoria().map((grupo) => (
      <div key={grupo.categoria} className="flex flex-col gap-1">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {grupo.categoria}
        </span>
        {grupo.artigos.map((artigo) => {
          const item = ITENS_MENU_ADMIN.find((rota) => rota.path === artigo.rota)
          const Icone = item?.icone ?? Bell
          const ativo = artigo.id === artigoAtivoId
          const destaTela = artigo.id === artigoDestaTelaId

          return (
            <button
              key={artigo.id}
              type="button"
              onClick={() => onSelecionar(artigo.id)}
              aria-current={ativo ? 'true' : undefined}
              className={cn(
                'flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ativo && 'bg-muted/80',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-sm">{artigo.titulo}</span>
              </span>
              {destaTela ? (
                <span className="shrink-0 text-[11px] font-medium text-primary">Esta tela</span>
              ) : null}
            </button>
          )
        })}
      </div>
    ))}
  </nav>
)
