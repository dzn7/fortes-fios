'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { Produto } from '@/lib/supabase'
import DetalheProduto from '@/components/produto/DetalheProduto'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer'

type ModalProdutoProps = {
  produto: Produto
  /**
   * Para onde fechar.
   *
   * `historico` é o caso da rota interceptada: o catálogo está atrás na pilha,
   * então voltar devolve exatamente onde a pessoa estava. `catalogo` é o caso
   * do link direto — aí não há nada atrás, e `router.back()` jogaria a pessoa
   * para fora do site (o WhatsApp, por exemplo).
   */
  aoFechar?: 'historico' | 'catalogo'
}

/**
 * O produto expandido.
 *
 * **Drawer em toda tela, e não o `Dialog variant="responsive"`.** Aquele troca
 * para diálogo centrado acima de 768px, o que dava duas telas diferentes para o
 * mesmo conteúdo. Aqui existe uma superfície só: sobe de baixo, com a mesma
 * transição do vaul em qualquer largura.
 *
 * **A altura é resolvida em um lugar só.** A versão anterior empilhava
 * `max-h-[96dvh]` do `DrawerContent`, o `overflow-y-auto p-6` do branch drawer
 * do `DialogContent` e um `max-h-[92dvh] overflow-y-auto` meu por cima: três
 * limites brigando e dois containers de rolagem aninhados. O resultado era o
 * conteúdo cortado sem rolar e o botão de comprar fora de alcance. Agora o
 * `DrawerContent` é só a moldura (`p-0`), e quem rola é um único container
 * dentro do `DetalheProduto`.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default function ModalProduto({
  produto,
  aoFechar = 'historico',
}: ModalProdutoProps) {
  const router = useRouter()

  const fechar = () => {
    if (aoFechar === 'catalogo') {
      router.push('/')
      return
    }
    router.back()
  }

  return (
    <Drawer
      open
      onOpenChange={(aberto) => {
        if (!aberto) fechar()
      }}
    >
      <DrawerContent
        className={
          // `p-0`: o preenchimento é de quem rola, senão o conteúdo encosta na
          // borda ao rolar.
          //
          // Centralizar no desktop com `mx-auto`, e NÃO com `-translate-x-1/2`:
          // o vaul escreve `transform` inline para animar e arrastar, e estilo
          // inline vence classe — a folha ficaria deslocada meia largura. Com
          // `inset-x-0` + `max-w`, a margem automática centraliza sem tocar no
          // transform.
          'max-h-[92dvh] gap-0 p-0 sm:mx-auto sm:max-w-lg'
        }
      >
        {/* Anuncia o que abriu; o texto visível vem do próprio detalhe. */}
        <DrawerTitle className="sr-only">{produto.nome}</DrawerTitle>
        <DrawerDescription className="sr-only">
          Detalhes e quantidade do produto
        </DrawerDescription>

        <DrawerClose
          aria-label="Fechar"
          className="absolute right-2 top-2 z-20 inline-flex size-11 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </DrawerClose>

        <DetalheProduto produto={produto} />
      </DrawerContent>
    </Drawer>
  )
}
