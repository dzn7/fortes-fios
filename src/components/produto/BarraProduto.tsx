'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import ModalCarrinho from '@/components/ModalCarrinho'
import { Button } from '@/components/ui/button'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { useStatusLoja } from '@/lib/useStatusLoja'

/**
 * Barra da página do produto.
 *
 * **Não reusa o `Header` do catálogo de propósito:** aquele exige busca,
 * categorias, categoria ativa e os manipuladores de pedidos — estado que só a
 * home tem. Passar tudo isso para uma página de produto acoplaria as duas telas
 * para ganhar uma barra que aqui só precisa de duas coisas: voltar e o carrinho.
 *
 * O carrinho precisa estar aqui porque a página adiciona item; sem ele a pessoa
 * adicionaria sem ter para onde ir.
 */
export default function BarraProduto() {
  const { quantidadeTotal } = useCarrinho()
  const { lojaFechada } = useStatusLoja()
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/#catalogo"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao catálogo
          </Link>

          <Button
            type="button"
            variant="outline"
            className="relative h-11 gap-2"
            onClick={() => setCarrinhoAberto(true)}
            aria-label={`Abrir carrinho com ${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingBag className="size-4" aria-hidden />
            <span className="hidden sm:inline">Carrinho</span>
            {quantidadeTotal > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold tabular-nums text-primary-foreground">
                {quantidadeTotal}
              </span>
            )}
          </Button>
        </div>
      </header>

      <ModalCarrinho
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        lojaFechada={lojaFechada}
      />
    </>
  )
}
