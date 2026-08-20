'use client'

import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { janelaDePaginas } from '@/lib/paginacao.mjs'

type PaginacaoCatalogoProps = {
  paginaAtual: number
  totalPaginas: number
  primeiroItem: number
  ultimoItem: number
  totalItens: number
  onPaginaChange: (pagina: number) => void
}

/**
 * Paginação do catálogo do cliente.
 *
 * Mesmos primitivos e mesmo desenho da paginação do Admin
 * (`features/pedidos/components/PaginacaoPedidos`), e a mesma janela de páginas,
 * agora compartilhada em `src/lib/paginacao.mjs`.
 *
 * **Sem seletor de itens por página**, ao contrário do Admin: o catálogo tem um
 * tamanho fixo escolhido para fechar linha na grade (24 divide por 2, 3 e 4 —
 * as colunas de mobile, md e lg). Deixar a pessoa escolher 100 reabriria
 * exatamente o problema que a paginação veio resolver.
 *
 * Spec: specs/paginacao-catalogo-cliente.md
 */
export default function PaginacaoCatalogo({
  paginaAtual,
  totalPaginas,
  primeiroItem,
  ultimoItem,
  totalItens,
  onPaginaChange,
}: PaginacaoCatalogoProps) {
  // Uma página só não precisa de controle nenhum.
  if (totalPaginas <= 1) return null

  const itens = janelaDePaginas(paginaAtual, totalPaginas)

  return (
    <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/70 pt-6">
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationFirst disabled={paginaAtual === 1} onClick={() => onPaginaChange(1)} />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              disabled={paginaAtual === 1}
              onClick={() => onPaginaChange(paginaAtual - 1)}
            />
          </PaginationItem>

          {itens.map((item) =>
            typeof item === 'number' ? (
              <PaginationItem key={item}>
                <PaginationButton
                  isActive={item === paginaAtual}
                  onClick={() => onPaginaChange(item)}
                  aria-label={`Ir para a página ${item}`}
                >
                  {item}
                </PaginationButton>
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationEllipsis />
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              disabled={paginaAtual === totalPaginas}
              onClick={() => onPaginaChange(paginaAtual + 1)}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLast
              disabled={paginaAtual === totalPaginas}
              onClick={() => onPaginaChange(totalPaginas)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <p className="text-xs tabular-nums text-muted-foreground">
        {primeiroItem}–{ultimoItem} de {totalItens} produtos
      </p>
    </div>
  )
}
