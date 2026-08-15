'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BookOpen, PlayCircle, Search } from 'lucide-react'
import { ITENS_MENU_ADMIN, isRotaAtivaSidebar } from '@/lib/admin-sidebar-routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import {
  ARTIGOS_AJUDA,
  buscarArtigos,
  obterArtigoPorRota,
  type ArtigoAjuda,
} from '../help/catalogo.mjs'
import { useOnboarding } from '../context'
import { getTourByRoute } from '../registry'
import { ModuleCatalog } from './module-catalog'

export const HelpPanel = () => {
  const pathname = usePathname() ?? ''
  const isMobile = useIsMobile()
  const { isHelpPanelOpen, closeHelpPanel, startTour } = useOnboarding()
  const [busca, setBusca] = useState('')
  const [artigoSelecionadoId, setArtigoSelecionadoId] = useState<string | null>(null)

  const artigoDaRota = obterArtigoPorRota(pathname)
  const itemAtual = ITENS_MENU_ADMIN.find((item) => isRotaAtivaSidebar(item.path, pathname))
  const nomeTela = artigoDaRota?.titulo ?? itemAtual?.texto ?? 'painel'

  useEffect(() => {
    if (!isHelpPanelOpen) return
    setBusca('')
    setArtigoSelecionadoId(artigoDaRota?.id ?? null)
  }, [artigoDaRota?.id, isHelpPanelOpen])

  const termo = busca.trim()
  const resultados = useMemo(() => (termo ? buscarArtigos(termo) : []), [termo])
  const artigoExibido = useMemo(() => {
    if (termo) return null
    const id = artigoSelecionadoId ?? artigoDaRota?.id
    return ARTIGOS_AJUDA.find((artigo) => artigo.id === id) ?? artigoDaRota ?? null
  }, [artigoDaRota, artigoSelecionadoId, termo])

  const tourDaTela =
    artigoExibido?.rota && artigoExibido.id === artigoDaRota?.id
      ? getTourByRoute(artigoExibido.rota)
      : undefined
  const vendoOutraTela =
    Boolean(artigoExibido && artigoDaRota && artigoExibido.id !== artigoDaRota.id)

  const handleSelecionarArtigo = (id: string) => {
    setArtigoSelecionadoId(id)
    setBusca('')
  }

  return (
    <Sheet open={isHelpPanelOpen} onOpenChange={(open) => !open && closeHelpPanel()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        style={{ zIndex: 9998 }}
        className={cn(
          'flex flex-col gap-0 border-0 p-0 shadow-2xl',
          isMobile ? 'h-[85dvh] rounded-t-xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="border-b border-border/70 p-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Ajuda · {nomeTela}
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Como usar esta tela e as demais áreas do painel.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar no painel"
              aria-label="Buscar no painel de ajuda"
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
            {termo ? (
              <ResultadosBusca
                termo={termo}
                resultados={resultados}
                onSelecionar={handleSelecionarArtigo}
              />
            ) : (
              <>
                {vendoOutraTela && artigoDaRota ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 justify-start text-sm"
                    onClick={() => handleSelecionarArtigo(artigoDaRota.id)}
                  >
                    Voltar para {artigoDaRota.titulo}
                  </Button>
                ) : null}

                {artigoExibido ? (
                  <ArtigoAjudaConteudo artigo={artigoExibido} destaTela={artigoExibido.id === artigoDaRota?.id} />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Escolha uma área abaixo para ver como ela funciona.
                  </p>
                )}

                {tourDaTela ? (
                  <Button
                    type="button"
                    className="w-full justify-center gap-2"
                    onClick={() => {
                      closeHelpPanel()
                      startTour(tourDaTela.id)
                    }}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Ver tutorial guiado desta tela
                  </Button>
                ) : null}

                <ModuleCatalog
                  artigoAtivoId={artigoExibido?.id ?? null}
                  artigoDestaTelaId={artigoDaRota?.id ?? null}
                  onSelecionar={handleSelecionarArtigo}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

const ArtigoAjudaConteudo = ({
  artigo,
  destaTela,
}: {
  artigo: ArtigoAjuda
  destaTela: boolean
}) => (
  <article className="flex flex-col gap-3">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{artigo.titulo}</h3>
        {destaTela ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Esta tela
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{artigo.resumo}</p>
    </div>
    {artigo.secoes.map((secao) => (
      <section key={secao.titulo} className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-foreground">{secao.titulo}</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{secao.corpo}</p>
      </section>
    ))}
  </article>
)

const ResultadosBusca = ({
  termo,
  resultados,
  onSelecionar,
}: {
  termo: string
  resultados: ArtigoAjuda[]
  onSelecionar: (id: string) => void
}) => {
  if (resultados.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Nenhum resultado para “{termo}”. Tente o nome da tela, como Estoque ou Vitrine.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1" role="list">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
      </p>
      {resultados.map((artigo) => (
        <button
          key={artigo.id}
          type="button"
          role="listitem"
          onClick={() => onSelecionar(artigo.id)}
          className="rounded-md px-2 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block text-sm font-medium text-foreground">{artigo.titulo}</span>
          <span className="block text-xs text-muted-foreground">{artigo.resumo}</span>
        </button>
      ))}
    </div>
  )
}
