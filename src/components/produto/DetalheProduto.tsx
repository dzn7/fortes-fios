'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ImageOff, Link2, Minus, Plus, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import type { Produto } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import {
  avaliarCompraProduto,
  produtoBloqueadoPorEstoque,
} from '@/lib/estoque-produto.mjs'
import {
  calcularValorParcelaProduto,
  normalizarQuantidadeParcelas,
} from '@/lib/condicoesComerciaisProduto'
import { urlPublicaDoProduto } from '@/lib/link-produto.mjs'
import { cn } from '@/lib/utils'

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

type DetalheProdutoProps = {
  produto: Produto
  /** Modal ganha respiro menor; a página cheia usa a largura toda. */
  variante?: 'pagina' | 'modal'
}

/**
 * Conteúdo da página do produto.
 *
 * O **mesmo** componente serve a `/produto/[slug]` e à rota interceptada que
 * abre por cima do catálogo — se fossem dois, um sairia do ar sem ninguém notar.
 *
 * A quantidade é escolhida **aqui, antes do carrinho**, com a trava de estoque
 * que o `ModalComplementos` já usava (`avaliarCompraProduto`). Adicionar não
 * abre o carrinho: quem quis mais de um provavelmente quer continuar comprando.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default function DetalheProduto({ produto, variante = 'pagina' }: DetalheProdutoProps) {
  const { adicionarItem } = useCarrinho()
  const [quantidade, setQuantidade] = useState(1)
  const [copiado, setCopiado] = useState(false)

  const esgotado = produtoBloqueadoPorEstoque(produto)
  const podeAumentar = avaliarCompraProduto(produto, 0, quantidade + 1).permitido
  const precoOriginal =
    typeof produto.preco_original === 'number' ? produto.preco_original : null
  const possuiDesconto = Boolean(produto.desconto && produto.desconto > 0 && precoOriginal)
  const parcelas = normalizarQuantidadeParcelas(produto.parcelas_sem_juros)
  const temImagem =
    typeof produto.imagem_url === 'string' && produto.imagem_url.trim().length > 0

  const adicionar = () => {
    if (!adicionarItem(produto, quantidade, [], undefined)) {
      toast.warning('Quantidade indisponível', {
        description: 'O estoque deste produto mudou. Escolha uma quantidade menor.',
      })
      return
    }
    toast.success(
      `${quantidade > 1 ? `${quantidade}× ` : ''}${produto.nome} no carrinho`,
      { description: 'Continue escolhendo ou revise o pedido quando quiser.' },
    )
  }

  const copiarLink = async () => {
    // `window.location.origin` e não uma env: o link tem de sair com o domínio
    // por onde a pessoa entrou, seja o de produção ou uma preview da Vercel.
    const url = urlPublicaDoProduto(produto, window.location.origin)
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('Não foi possível copiar', { description: url })
    }
  }

  return (
    <div
      className={cn(
        'grid gap-6 sm:grid-cols-2 sm:gap-8',
        variante === 'pagina' && 'sm:gap-10',
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted">
        {temImagem ? (
          <Image
            src={produto.imagem_url}
            alt={produto.nome}
            fill
            // A foto do produto é o maior elemento da tela: prioridade alta para
            // ela não chegar depois do texto.
            priority
            sizes="(max-width: 640px) 100vw, 45vw"
            className={cn('object-contain p-4', esgotado && 'opacity-45 grayscale')}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-10 opacity-50" strokeWidth={1.5} aria-hidden />
            <span className="text-sm">Foto em breve</span>
          </div>
        )}

        {possuiDesconto && (
          <Badge className="absolute right-3 top-3 bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
            {produto.desconto}% OFF
          </Badge>
        )}

        {esgotado && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40">
            <span className="rounded-full border border-foreground/15 bg-background/90 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-foreground shadow-sm">
              ESGOTADO
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {produto.categoria}
        </p>
        <h1
          className={cn(
            'mt-1 font-semibold leading-tight text-foreground',
            variante === 'pagina' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {produto.nome}
        </h1>

        {produto.descricao ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {produto.descricao}
          </p>
        ) : null}

        <div className="mt-5 flex items-baseline gap-2.5">
          {possuiDesconto && (
            <span className="text-sm text-muted-foreground line-through">
              {formatarMoeda(precoOriginal || 0)}
            </span>
          )}
          <span
            className={cn(
              'text-3xl font-semibold tabular-nums',
              possuiDesconto ? 'text-primary' : 'text-foreground',
            )}
          >
            {formatarMoeda(produto.preco)}
          </span>
        </div>

        {produto.parcelamento_ativo ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Ou {parcelas}x de{' '}
            <strong className="font-semibold tabular-nums text-foreground">
              {formatarMoeda(calcularValorParcelaProduto(produto.preco, parcelas))}
            </strong>{' '}
            sem juros
          </p>
        ) : null}

        <div className="mt-auto space-y-3 pt-6">
          {!esgotado && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Quantidade</span>
              <div className="flex items-center gap-1 rounded-lg border border-border/70 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setQuantidade((atual) => Math.max(1, atual - 1))}
                  disabled={quantidade <= 1}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-4" />
                </Button>
                <span
                  className="w-8 text-center text-sm font-semibold tabular-nums text-foreground"
                  aria-live="polite"
                >
                  {quantidade}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setQuantidade((atual) => atual + 1)}
                  disabled={!podeAumentar}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {/* Só avisa do limite quando ele foi realmente alcançado. */}
              {!podeAumentar && (
                <span className="text-xs text-muted-foreground">
                  Limite do estoque
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-12 flex-1 gap-2 text-sm"
              onClick={adicionar}
              disabled={esgotado}
            >
              <ShoppingBag className="size-4" />
              {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 gap-2 text-sm"
              onClick={() => void copiarLink()}
              aria-label="Copiar link deste produto"
            >
              {copiado ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copiado ? 'Link copiado' : 'Copiar link'}
            </Button>
          </div>

          {variante === 'pagina' && (
            <Link
              href="/#catalogo"
              className="inline-block pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver todo o catálogo
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
