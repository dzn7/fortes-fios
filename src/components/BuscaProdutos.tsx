'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ImageOff, Search, X } from 'lucide-react'
import type { Produto } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { buscarProdutos, TERMO_MINIMO } from '@/lib/busca-produtos.mjs'
import { caminhoDoProduto } from '@/lib/link-produto.mjs'
import { produtoBloqueadoPorEstoque } from '@/lib/estoque-produto.mjs'
import { cn } from '@/lib/utils'

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

type BuscaProdutosProps = {
  aberto: boolean
  onFechar: () => void
  produtos: readonly Produto[]
}

/**
 * Busca de produtos do header.
 *
 * **Sem ida ao banco.** O catálogo já está em memória; filtrar custa ~1,7 ms por
 * tecla contra 50–300 ms de uma requisição no celular. Por isso não há debounce
 * nem estado de carregamento: não há o que esperar. O raciocínio completo, com
 * as medições, está em `src/lib/busca-produtos.mjs` e na spec.
 *
 * A superfície é o mesmo `Sheet side="bottom"` que o menu de categorias deste
 * header já usa — uma linguagem só para as duas gavetas que saem daqui.
 *
 * Spec: specs/busca-no-header.md
 */
export default function BuscaProdutos({ aberto, onFechar, produtos }: BuscaProdutosProps) {
  const router = useRouter()
  const [termo, setTermo] = useState('')
  const campoRef = useRef<HTMLInputElement>(null)

  // Abrir limpa o termo anterior e leva o foco ao campo: quem tocou na lupa
  // quer digitar, não encontrar a busca de ontem.
  useEffect(() => {
    if (!aberto) return
    setTermo('')
    const foco = window.setTimeout(() => campoRef.current?.focus(), 120)
    return () => window.clearTimeout(foco)
  }, [aberto])

  const resultado = useMemo(() => buscarProdutos(produtos as Produto[], termo), [produtos, termo])

  const digitouPouco = termo.trim().length > 0 && termo.trim().length < TERMO_MINIMO
  const semResultado = !digitouPouco && termo.trim().length >= TERMO_MINIMO && resultado.total === 0

  const abrirProduto = (produto: Produto) => {
    onFechar()
    router.push(caminhoDoProduto(produto))
  }

  return (
    <Sheet open={aberto} onOpenChange={(proximo) => !proximo && onFechar()}>
      <SheetContent
        side="bottom"
        className="inset-x-0 bottom-0 flex h-[85dvh] w-auto flex-col gap-0 rounded-t-2xl border-border/70 p-0 sm:inset-x-auto sm:mx-auto sm:max-w-lg [&>button]:hidden"
      >
        <SheetTitle className="sr-only">Buscar produtos</SheetTitle>
        <SheetDescription className="sr-only">
          Digite o nome, a categoria ou a marca do produto
        </SheetDescription>

        {/* Faixa fixa: o campo nunca sai de vista enquanto a lista rola. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-3 sm:px-4">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={campoRef}
              type="search"
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
              onKeyDown={(evento) => evento.key === 'Escape' && onFechar()}
              placeholder="Buscar shampoo, máscara, kit ou marca..."
              aria-label="Buscar produtos"
              className="h-12 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 shrink-0"
            onClick={onFechar}
            aria-label="Fechar busca"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* O único container de rolagem desta folha. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {resultado.itens.length > 0 ? (
            <>
              <ul className="divide-y divide-border/60">
                {resultado.itens.map((produto) => {
                  const esgotado = produtoBloqueadoPorEstoque(produto)
                  const temImagem =
                    typeof produto.imagem_url === 'string' && produto.imagem_url.trim().length > 0

                  return (
                    <li key={produto.id}>
                      <button
                        type="button"
                        onClick={() => abrirProduto(produto)}
                        className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-4"
                      >
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {temImagem ? (
                            <Image
                              src={produto.imagem_url}
                              alt=""
                              fill
                              sizes="56px"
                              className={cn('object-contain p-1', esgotado && 'opacity-45 grayscale')}
                            />
                          ) : (
                            <ImageOff
                              className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50"
                              aria-hidden
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                            {produto.categoria}
                          </span>
                          <span className="block truncate text-sm font-medium text-foreground">
                            {produto.nome}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {formatarMoeda(produto.preco)}
                            </span>
                            {/*
                              Esgotado aparece marcado, não sumido: o produto
                              existe e a pessoa procurou por ele.
                            */}
                            {esgotado ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Esgotado
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {resultado.temMais ? (
                <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                  Mostrando {resultado.itens.length} de {resultado.total}. Refine a busca para
                  encontrar mais rápido.
                </p>
              ) : null}
            </>
          ) : (
            <div className="px-6 py-14 text-center">
              {semResultado ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Nada encontrado para “{termo.trim()}”
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tente outro termo — o nome do produto, a categoria ou a marca.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {digitouPouco
                    ? `Digite ao menos ${TERMO_MINIMO} letras.`
                    : 'Digite para encontrar um produto.'}
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
