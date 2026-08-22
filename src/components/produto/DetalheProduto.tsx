'use client'

import { useState } from 'react'
import Image from 'next/image'
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
}

/**
 * Conteúdo do produto expandido.
 *
 * **Duas faixas: uma que rola e uma que não.** O erro da versão anterior era não
 * ter essa separação — tudo num fluxo só, dentro de containers de rolagem
 * aninhados. Numa tela de 430 px a imagem quadrada ocupava a altura inteira e o
 * botão de comprar nascia fora da vista, sem rolagem que o alcançasse.
 *
 * Agora o rodapé com quantidade e "Adicionar ao carrinho" é `shrink-0` e fica
 * sempre visível; só a faixa de cima rola, e é o **único** container de rolagem
 * da tela. A imagem ganha teto em `dvh` para nunca engolir a folha.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default function DetalheProduto({ produto }: DetalheProdutoProps) {
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        O único container de rolagem da tela. `min-h-0` é o que permite ele
        encolher dentro do flex — sem isso o filho estica o pai e o rodapé sai
        empurrado para fora da folha, que era o defeito.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 pt-2 [-webkit-overflow-scrolling:touch] sm:px-6">
        <div className="relative mx-auto aspect-square max-h-[34dvh] w-full overflow-hidden rounded-xl bg-muted">
          {temImagem ? (
            <Image
              src={produto.imagem_url}
              alt={produto.nome}
              fill
              // A foto é o maior elemento da folha: prioridade alta para ela não
              // chegar depois do texto.
              priority
              sizes="(max-width: 640px) 100vw, 32rem"
              className={cn('object-contain p-3', esgotado && 'opacity-45 grayscale')}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="size-9 opacity-50" strokeWidth={1.5} aria-hidden />
              <span className="text-sm">Foto em breve</span>
            </div>
          )}

          {possuiDesconto && (
            <Badge className="absolute left-2 top-2 bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
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

        <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {produto.categoria}
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {produto.nome}
        </h2>

        {produto.descricao ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {produto.descricao}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {possuiDesconto && (
            <span className="text-sm text-muted-foreground line-through">
              {formatarMoeda(precoOriginal || 0)}
            </span>
          )}
          <span
            className={cn(
              'text-2xl font-semibold tabular-nums',
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
      </div>

      {/*
        Faixa fixa. `shrink-0` para o flex nunca a comprimir, e o
        `env(safe-area-inset-bottom)` para o botão não ficar sob a barra de
        gestos do iPhone.
      */}
      <div className="shrink-0 border-t border-border/70 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {!esgotado && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Quantidade</span>
            <div className="flex items-center gap-1 rounded-lg border border-border/70 p-1">
              {/* size-11 = 44px, o mínimo de alvo de toque. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() => setQuantidade((atual) => Math.max(1, atual - 1))}
                disabled={quantidade <= 1}
                aria-label="Diminuir quantidade"
              >
                <Minus className="size-4" />
              </Button>
              <span
                className="w-9 text-center text-base font-semibold tabular-nums text-foreground"
                aria-live="polite"
              >
                {quantidade}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() => setQuantidade((atual) => atual + 1)}
                disabled={!podeAumentar}
                aria-label="Aumentar quantidade"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="h-12 flex-1 gap-2 text-sm"
            onClick={adicionar}
            disabled={esgotado}
          >
            <ShoppingBag className="size-4" />
            {esgotado ? 'Esgotado' : 'Adicionar ao carrinho'}
          </Button>
          {/*
            Ícone só: o rótulo roubava largura do CTA principal numa tela de
            430px e empurrava os dois para duas linhas.
          */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0"
            onClick={() => void copiarLink()}
            aria-label={copiado ? 'Link copiado' : 'Copiar link deste produto'}
          >
            {copiado ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Link2 className="size-4" />
            )}
          </Button>
        </div>

        {!esgotado && !podeAumentar && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Você atingiu o limite do estoque disponível.
          </p>
        )}
      </div>
    </div>
  )
}
