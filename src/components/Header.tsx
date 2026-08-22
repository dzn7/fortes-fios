'use client'

import { useState, useEffect } from 'react'
import { useStatusLoja } from '@/lib/useStatusLoja'
import type { Produto } from '@/lib/supabase'
import BuscaProdutos from '@/components/BuscaProdutos'
import { linkWhatsApp } from '@/lib/whatsapp.mjs'
import { IconeCategoria } from '@/components/icons/IconeCategoria'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import {
  BadgePercent,
  ChevronRight,
  HelpCircle,
  Instagram,
  Menu,
  Moon,
  ReceiptText,
  Search,
  ShoppingBag,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { cn } from '@/lib/utils'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import IconeTikTok from '@/components/icons/IconeTikTok'
import { FaixaRodape } from '@/components/FaixaRodape'

type HeaderProps = {
  onAbrirAjuda?: () => void
  onAbrirCarrinho: () => void
  onAbrirPedidos: () => void
  categorias: readonly string[]
  /** Nome da categoria → id do ícone. Ausente cai no padrão. */
  iconesCategoria?: Record<string, string>
  categoriaAtiva: string
  onSelecionarCategoria: (categoria: string) => void
  ofertasDisponiveis: boolean
  onAbrirOfertas: () => void
  /**
   * Catálogo já carregado, para a busca da lupa.
   *
   * Vem por prop, e não de uma consulta própria: a home já o tem em memória, e
   * buscar aqui custa ~1,7 ms por tecla contra 50–300 ms de uma requisição.
   * Ver specs/busca-no-header.md.
   */
  produtos?: readonly Produto[]
}

export default function Header({
  onAbrirAjuda,
  onAbrirCarrinho,
  onAbrirPedidos,
  categorias,
  iconesCategoria,
  categoriaAtiva,
  onSelecionarCategoria,
  ofertasDisponiveis,
  onAbrirOfertas,
  produtos = [],
}: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { quantidadeTotal } = useCarrinho()
  // `linkWhatsApp` cai no número oficial quando a configuração está vazia, então
  // o contato nunca depende de uma linha existir no banco.
  const { numeroWhatsApp } = useStatusLoja()
  const linkContatoWhatsApp = linkWhatsApp(
    numeroWhatsApp,
    'Olá! Vim pelo site da Fortes Fios.',
  )
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)

  useEffect(() => {
    setMounted(true)

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? 'border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'
          : 'border-border/70 bg-background/95'
      }`}
    >
      <FaixaRodape />
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-1 md:flex md:justify-between md:gap-3">
          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label="Abrir menu de categorias"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="group inset-x-3 bottom-3 top-1/4 flex h-auto w-auto flex-col gap-0 overflow-visible rounded-2xl border border-border/70 p-0 shadow-xl data-[state=closed]:duration-200 data-[state=open]:duration-300 motion-reduce:animate-none motion-reduce:transition-none md:hidden [&>button]:left-1/2 [&>button]:right-auto [&>button]:top-0 [&>button]:z-10 [&>button]:flex [&>button]:size-14 [&>button]:-translate-x-1/2 [&>button]:-translate-y-1/2 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-border [&>button]:bg-background [&>button]:opacity-100 [&>button]:shadow-md"
            >
              <SheetTitle className="sr-only">Menu Fortes Fios</SheetTitle>
              <SheetDescription className="sr-only">
                Navegue pelas categorias e canais de atendimento da loja.
              </SheetDescription>

              <nav
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-10 [-webkit-overflow-scrolling:touch] motion-safe:group-data-[state=open]:animate-in motion-safe:group-data-[state=open]:fade-in-0 motion-safe:group-data-[state=open]:slide-in-from-bottom-2 motion-safe:group-data-[state=open]:duration-300"
                aria-label="Categorias do catálogo"
              >
                <p className="pb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                  Comprar por categoria
                </p>
                <div>
                  {ofertasDisponiveis ? (
                    <button
                      type="button"
                      onClick={() => {
                        onAbrirOfertas()
                        setMenuAberto(false)
                      }}
                      className="flex min-h-16 w-full items-center gap-3 text-left text-2xl font-semibold leading-snug text-primary transition-colors duration-150 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <BadgePercent
                        className="size-5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">Ofertas</span>
                      <ChevronRight
                        className="size-5 shrink-0"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    </button>
                  ) : null}
                  {categorias.map((categoria) => {
                    const ativo = categoria === categoriaAtiva

                    return (
                      <button
                        type="button"
                        key={categoria}
                        onClick={() => {
                          onSelecionarCategoria(categoria)
                          setMenuAberto(false)
                        }}
                        className={cn(
                          'flex min-h-16 w-full items-center gap-3 text-left text-2xl font-semibold leading-snug text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          ativo ? 'text-primary' : 'hover:text-primary',
                        )}
                        aria-current={ativo ? 'page' : undefined}
                      >
                        <IconeCategoria
                          icone={iconesCategoria?.[categoria]}
                          className="size-6 shrink-0 text-primary/70"
                        />
                        <span className="min-w-0 flex-1">{categoria}</span>
                        <ChevronRight
                          className="size-5 shrink-0 text-primary"
                          strokeWidth={1.8}
                          aria-hidden
                        />
                      </button>
                    )
                  })}
                </div>
              </nav>

              <div className="shrink-0 border-t border-border/70 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] motion-safe:group-data-[state=open]:animate-in motion-safe:group-data-[state=open]:fade-in-0 motion-safe:group-data-[state=open]:slide-in-from-bottom-1 motion-safe:group-data-[state=open]:delay-75 motion-safe:group-data-[state=open]:duration-300">
                <div className="flex items-center gap-5" aria-label="Redes sociais">
                  <a
                    href="https://instagram.com/fortesfioss"
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Abrir Instagram da Fortes Fios"
                  >
                    <Instagram className="size-6" strokeWidth={1.8} aria-hidden />
                  </a>
                  <a
                    href={linkContatoWhatsApp ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Conversar com a Fortes Fios pelo WhatsApp"
                  >
                    <IconeWhatsApp className="size-6" />
                  </a>
                  <a
                    href="https://www.tiktok.com/@jamesfortes1"
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Abrir TikTok da Fortes Fios"
                  >
                    <IconeTikTok className="size-6" />
                  </a>
                </div>

                <div className="mt-3 grid grid-cols-2 border-t border-border/60 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onAbrirPedidos()
                      setMenuAberto(false)
                    }}
                    className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ReceiptText className="size-4" aria-hidden />
                    Meus pedidos
                  </button>
                  {onAbrirAjuda ? (
                    <button
                      type="button"
                      onClick={() => {
                        onAbrirAjuda()
                        setMenuAberto(false)
                      }}
                      className="flex min-h-11 items-center justify-end gap-2 text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <HelpCircle className="size-4" aria-hidden />
                      Como comprar
                    </button>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="mt-1 flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mounted && theme === 'dark' ? (
                    <Sun className="size-4" aria-hidden />
                  ) : (
                    <Moon className="size-4" aria-hidden />
                  )}
                  Alternar tema
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 items-center justify-center gap-2.5 md:justify-start md:gap-3">
            <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border/70 bg-card md:size-11">
              <Image
                src="/logo.webp"
                alt="Fortes Fios"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base md:text-lg">
                Fortes Fios
              </h1>
              <p className="hidden max-w-sm text-xs text-muted-foreground sm:block">
                A loja de quem entende de cabelo.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setBuscaAberta(true)}
            className="size-11 md:hidden"
            aria-label="Buscar produtos"
          >
            <Search className="size-5" aria-hidden />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onAbrirCarrinho}
            className="relative size-11 md:hidden"
            aria-label={
              quantidadeTotal > 0
                ? `Abrir carrinho com ${quantidadeTotal} itens`
                : 'Abrir carrinho vazio'
            }
          >
            <ShoppingBag className="size-5" aria-hidden />
            {quantidadeTotal > 0 ? (
              <span className="absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                {quantidadeTotal > 99 ? '99+' : quantidadeTotal}
              </span>
            ) : null}
          </Button>

          <div className="hidden items-center gap-1.5 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setBuscaAberta(true)}
              aria-label="Buscar produtos"
              className="size-11 shrink-0 md:size-10"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onAbrirPedidos}
              className="h-10 gap-2 px-3 text-sm font-medium"
            >
              <ReceiptText className="size-4" />
              Meus pedidos
            </Button>
            <Button
              type="button"
              onClick={onAbrirCarrinho}
              className="relative h-10 gap-2 px-4 text-sm font-semibold shadow-none"
              aria-label={
                quantidadeTotal > 0
                  ? `Abrir carrinho com ${quantidadeTotal} itens`
                  : 'Abrir carrinho vazio'
              }
            >
              <ShoppingBag className="size-4" />
              Carrinho
              {quantidadeTotal > 0 ? (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-primary-foreground/15 px-1.5 text-[11px] tabular-nums">
                  {quantidadeTotal > 99 ? '99+' : quantidadeTotal}
                </span>
              ) : null}
            </Button>
            {onAbrirAjuda && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onAbrirAjuda}
                aria-label="Como pedir"
                className="size-11 shrink-0 md:size-10"
              >
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Alternar tema"
              className="size-11 shrink-0 md:size-10"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5 text-primary" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <BuscaProdutos
        aberto={buscaAberta}
        onFechar={() => setBuscaAberta(false)}
        produtos={produtos}
      />
    </header>
  )
}
