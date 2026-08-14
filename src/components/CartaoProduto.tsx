'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOff, Plus, Sparkles } from 'lucide-react'
import { Produto } from '@/lib/supabase'
import ModalIngredientes from './ModalIngredientes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  calcularValorParcelaProduto,
  normalizarQuantidadeParcelas,
} from '@/lib/condicoesComerciaisProduto'

type CartaoProdutoProps = {
  produto: Produto
  onAdicionar: (produto: Produto) => void
  variante?: 'grade' | 'destaque' | 'oferta'
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)

export default function CartaoProduto({
  produto,
  onAdicionar,
  variante = 'grade',
}: CartaoProdutoProps) {
  const [imagemCarregada, setImagemCarregada] = useState(false)
  const [erroImagem, setErroImagem] = useState(false)
  const [modalIngredientesAberto, setModalIngredientesAberto] = useState(false)

  const precoOriginal =
    typeof produto.preco_original === 'number' ? produto.preco_original : null
  const possuiDesconto = Boolean(
    produto.desconto && produto.desconto > 0 && precoOriginal,
  )
  const srcImagem =
    !erroImagem &&
    typeof produto.imagem_url === 'string' &&
    produto.imagem_url.trim().length > 0
      ? produto.imagem_url
      : ''
  const exibindoPlaceholder = !srcImagem
  const ehDestaque = variante === 'destaque' || variante === 'oferta'
  const ehOferta = variante === 'oferta'
  const quantidadeParcelas = normalizarQuantidadeParcelas(
    produto.parcelas_sem_juros,
  )

  return (
    <>
      <article
        className={cn(
          'group flex h-full flex-col overflow-hidden bg-card text-card-foreground transition-[border-color,box-shadow]',
          ehDestaque
            ? 'rounded-lg shadow-sm hover:shadow-md'
            : 'rounded-xl border border-border/70 hover:border-primary/30 hover:shadow-[0_12px_28px_-20px_hsl(var(--foreground)/0.3)]',
        )}
      >
        <button
          type="button"
          onClick={() => setModalIngredientesAberto(true)}
          className={cn(
            'relative w-full overflow-hidden bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            ehDestaque ? 'aspect-square' : 'aspect-[4/5]',
          )}
          aria-label={`Ver detalhes de ${produto.nome}`}
        >
          {!exibindoPlaceholder && (
            <>
              {!imagemCarregada && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
                </div>
              )}
              <Image
                src={srcImagem}
                alt={produto.nome}
                fill
                className={cn(
                  'transition-[opacity,transform] duration-300 group-hover:scale-[1.02]',
                  ehDestaque ? 'object-cover' : 'object-contain p-3',
                  imagemCarregada ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setImagemCarregada(true)}
                onError={() => setErroImagem(true)}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </>
          )}

          {exibindoPlaceholder && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/60">
              <ImageOff
                className="mb-2 h-10 w-10 text-muted-foreground/45"
                strokeWidth={1.5}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                Foto em breve
              </span>
            </div>
          )}

          {possuiDesconto && (
            <div className="absolute right-2 top-2">
              <Badge className="bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                {produto.desconto}% OFF
              </Badge>
            </div>
          )}

          {ehDestaque && (
            <Badge className="absolute left-3 top-3 gap-1.5 rounded-full bg-primary/95 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
              <Sparkles className="size-3" aria-hidden />
              {ehOferta ? 'Oferta' : 'Mais vendido'}
            </Badge>
          )}
        </button>

        <div
          className={cn(
            'flex flex-1 flex-col p-3',
            ehDestaque && 'items-center bg-secondary/45 p-4 text-center',
          )}
        >
          {!ehDestaque ? (
            <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {produto.categoria}
            </p>
          ) : null}
          <h3
            className={cn(
              'mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground',
              ehDestaque && 'min-h-11 text-base sm:min-h-12 sm:text-lg',
            )}
          >
            {produto.nome}
          </h3>

          <div
            className={cn(
              'mb-3 flex flex-1 flex-col',
              ehDestaque && 'hidden',
            )}
          >
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {produto.descricao || 'Detalhes do produto disponíveis em breve.'}
            </p>
          </div>

          <div
            className={cn(
              'mt-auto w-full space-y-2.5 pt-3',
              !ehDestaque && 'border-t border-border/70',
            )}
          >
            <div
              className={cn(
                'flex items-baseline gap-2',
                ehDestaque && 'justify-center',
              )}
            >
              {possuiDesconto && (
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatarMoeda(precoOriginal || 0)}
                </span>
              )}
              <span
                className={cn(
                  'text-lg font-semibold text-foreground',
                  ehDestaque && 'text-xl',
                  possuiDesconto && 'text-primary',
                )}
              >
                {formatarMoeda(produto.preco)}
              </span>
            </div>

            {produto.parcelamento_ativo ? (
              <p className="text-xs text-muted-foreground">
                Ou {quantidadeParcelas}x de{' '}
                <strong className="font-semibold tabular-nums text-foreground">
                  {formatarMoeda(
                    calcularValorParcelaProduto(
                      produto.preco,
                      quantidadeParcelas,
                    ),
                  )}
                </strong>{' '}
                sem juros
              </p>
            ) : null}

            <Button
              type="button"
              onClick={() => onAdicionar(produto)}
              className={cn(
                'min-h-11 w-full gap-1.5 px-3 text-xs sm:text-sm',
                ehDestaque && 'rounded-full px-8',
              )}
              aria-label={`Adicionar ${produto.nome} ao carrinho`}
            >
              <Plus className="h-4 w-4" />
              <span>{ehDestaque ? 'Comprar' : 'Adicionar'}</span>
              {!ehDestaque && (
                <span className="hidden sm:inline"> ao carrinho</span>
              )}
            </Button>
          </div>
        </div>
      </article>

      <ModalIngredientes
        produto={produto}
        aberto={modalIngredientesAberto}
        onFechar={() => setModalIngredientesAberto(false)}
        onAdicionar={onAdicionar}
      />
    </>
  )
}
