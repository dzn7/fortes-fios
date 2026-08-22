'use client'

import { useRouter } from 'next/navigation'
import type { Produto } from '@/lib/supabase'
import DetalheProduto from '@/components/produto/DetalheProduto'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ModalProdutoProps = {
  produto: Produto
}

/**
 * Moldura da rota interceptada.
 *
 * Fechar é `router.back()`, e não um estado local: a URL é quem manda aqui.
 * Assim o botão voltar do navegador, o gesto de voltar do celular e o X do
 * diálogo fazem a mesma coisa — sair de `/produto/…` e voltar ao catálogo.
 *
 * `Dialog` do projeto: vira Radix no desktop e Drawer vaul no mobile sozinho.
 */
export default function ModalProduto({ produto }: ModalProdutoProps) {
  const router = useRouter()

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) router.back()
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        {/*
          Título e descrição existem para o leitor de tela anunciar o que abriu;
          o texto visível vem do próprio `DetalheProduto`.
        */}
        <DialogHeader className="sr-only">
          <DialogTitle>{produto.nome}</DialogTitle>
          <DialogDescription>Detalhes e quantidade do produto</DialogDescription>
        </DialogHeader>
        <DetalheProduto produto={produto} variante="modal" />
      </DialogContent>
    </Dialog>
  )
}
