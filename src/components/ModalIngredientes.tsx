'use client'

import Image from 'next/image'
import { ImageOff, ShoppingBag } from 'lucide-react'
import { Produto } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  calcularValorParcelaProduto,
  normalizarQuantidadeParcelas,
} from '@/lib/condicoesComerciaisProduto'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { produtoBloqueadoPorEstoque } from '@/lib/estoque-produto.mjs'

type ModalIngredientesProps = {
  produto: Produto | null
  aberto: boolean
  onFechar: () => void
  onAdicionar: (produto: Produto) => void
}

export default function ModalIngredientes({
  produto,
  aberto,
  onFechar,
  onAdicionar,
}: ModalIngredientesProps) {
  if (!produto) return null

  const precoOriginal =
    typeof produto.preco_original === 'number' ? produto.preco_original : null
  const possuiDesconto = Boolean(
    produto.desconto && produto.desconto > 0 && precoOriginal,
  )
  const temImagem =
    typeof produto.imagem_url === 'string' &&
    produto.imagem_url.trim().length > 0
  const quantidadeParcelas = normalizarQuantidadeParcelas(
    produto.parcelas_sem_juros,
  )
  const esgotado = produtoBloqueadoPorEstoque(produto)

  const adicionarAoCarrinho = () => {
    onFechar()
    onAdicionar(produto)
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximoEstado) => !proximoEstado && onFechar()}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative aspect-[4/3] overflow-hidden bg-muted sm:aspect-auto sm:min-h-[30rem]">
            {temImagem ? (
              <Image
                src={produto.imagem_url}
                alt={produto.nome}
                fill
                sizes="(max-width: 640px) 100vw, 45vw"
                className={esgotado ? 'object-cover grayscale opacity-50' : 'object-cover'}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff
                  className="size-10 opacity-50"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span className="text-sm">Foto em breve</span>
              </div>
            )}
            {esgotado ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                <Badge variant="secondary" className="px-4 py-2 tracking-[0.18em]">ESGOTADO</Badge>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col p-5 sm:p-7">
            <DialogHeader className="pr-10 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {produto.categoria}
                </span>
                {possuiDesconto ? (
                  <Badge className="bg-primary text-primary-foreground">
                    {produto.desconto}% OFF
                  </Badge>
                ) : null}
              </div>
              <DialogTitle className="pt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                {produto.nome}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm leading-relaxed sm:text-base">
                {produto.descricao ||
                  'Detalhes do produto disponíveis em breve.'}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 border-t border-border/70 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preço
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  R$ {produto.preco.toFixed(2)}
                </span>
                {possuiDesconto ? (
                  <span className="text-sm tabular-nums text-muted-foreground line-through">
                    R$ {precoOriginal?.toFixed(2)}
                  </span>
                ) : null}
              </div>
              {produto.parcelamento_ativo ? (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Ou {quantidadeParcelas}x de{' '}
                    <strong className="font-medium tabular-nums text-foreground">
                      R${' '}
                      {calcularValorParcelaProduto(
                        produto.preco,
                        quantidadeParcelas,
                      )
                        .toFixed(2)
                        .replace('.', ',')}
                    </strong>{' '}
                    sem juros
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Condição informativa; a forma de pagamento é escolhida ao finalizar.
                  </p>
                </div>
              ) : null}
            </div>

            <DialogFooter className="mt-7 sm:mt-auto sm:pt-8">
              <Button
                type="button"
                size="lg"
                onClick={adicionarAoCarrinho}
                disabled={esgotado}
                className="w-full gap-2"
              >
                <ShoppingBag className="size-5" aria-hidden />
                {esgotado ? 'Produto esgotado' : 'Adicionar ao carrinho'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
