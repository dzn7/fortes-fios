'use client'

import { Home, PackageSearch, ShoppingBag } from 'lucide-react'
import { useCarrinho } from '@/contexts/CarrinhoContext'

type FooterProps = {
  onAbrirCarrinho: () => void
  onAbrirPedidos: () => void
}

export default function Footer({
  onAbrirCarrinho,
  onAbrirPedidos,
}: FooterProps) {
  const { quantidadeTotal } = useCarrinho()

  const scrollParaInicio = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Navegação principal da loja"
      data-public-bottom-nav
    >
      <div className="pointer-events-auto mx-auto grid max-w-sm grid-cols-3 gap-1 rounded-2xl border border-border/80 bg-background/95 p-1.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
        <button
          type="button"
          onClick={scrollParaInicio}
          className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-primary transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent"
          aria-label="Ir para o início da loja"
          aria-current="page"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-active:scale-95">
            <Home className="size-4" strokeWidth={1.8} aria-hidden />
          </span>
          <span className="text-xs font-medium leading-none">Início</span>
        </button>

        <button
          type="button"
          onClick={onAbrirPedidos}
          className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent"
          aria-label="Acompanhar meus pedidos"
        >
          <span className="flex size-7 items-center justify-center transition-transform group-active:scale-95">
            <PackageSearch className="size-5" strokeWidth={1.7} aria-hidden />
          </span>
          <span className="text-xs font-medium leading-none">Pedidos</span>
        </button>

        <button
          type="button"
          onClick={onAbrirCarrinho}
          className="group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent"
          aria-label={
            quantidadeTotal > 0
              ? `Abrir sacola com ${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`
              : 'Abrir sacola vazia'
          }
        >
          <span className="relative flex size-7 items-center justify-center transition-transform group-active:scale-95">
            <ShoppingBag className="size-5" strokeWidth={1.7} aria-hidden />
            {quantidadeTotal > 0 ? (
              <span
                className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                aria-live="polite"
              >
                {quantidadeTotal > 99 ? '99+' : quantidadeTotal}
              </span>
            ) : null}
          </span>
          <span className="text-xs font-medium leading-none">Sacola</span>
        </button>
      </div>
    </nav>
  )
}
