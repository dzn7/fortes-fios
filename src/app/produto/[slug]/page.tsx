import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Home from '@/app/page'
import ModalProduto from '@/components/produto/ModalProduto'
import { buscarProdutoPublico } from '@/lib/server/produto-publico'
import { caminhoDoProduto } from '@/lib/link-produto.mjs'

type Parametros = { params: Promise<{ slug: string }> }

/**
 * O que faz o link virar cartão no WhatsApp.
 *
 * Sem `openGraph`, o link compartilhado aparece como texto cru — que é
 * exatamente o oposto do objetivo desta funcionalidade. Mora aqui, no servidor,
 * porque o robô que monta a prévia não executa JavaScript.
 */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { slug } = await params
  const produto = await buscarProdutoPublico(slug)

  if (!produto) {
    return { title: 'Produto não encontrado | Fortes Fios' }
  }

  const preco = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(produto.preco)

  const descricao =
    produto.descricao?.trim() || `${produto.nome} por ${preco} na Fortes Fios.`
  const imagem = produto.imagem_url?.trim()

  return {
    title: `${produto.nome} | Fortes Fios`,
    description: descricao,
    // Canônica sempre recalculada a partir do id: link antigo com o nome velho
    // continua abrindo, e aponta para a forma atual.
    alternates: { canonical: caminhoDoProduto(produto) },
    openGraph: {
      type: 'website',
      title: produto.nome,
      description: descricao,
      images: imagem ? [{ url: imagem, alt: produto.nome }] : undefined,
    },
    twitter: {
      card: imagem ? 'summary_large_image' : 'summary',
      title: produto.nome,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
  }
}

/**
 * Link direto do produto.
 *
 * **Renderiza o catálogo com o produto aberto por cima**, e não uma tela
 * separada. Foi a correção pedida: uma página solta tirava a pessoa da loja —
 * ela caía num cartão de produto sem vitrine atrás, sem busca e sem as outras
 * categorias, e "voltar ao catálogo" virava um segundo clique obrigatório.
 *
 * Assim o link compartilhado entrega o mesmo que o clique dentro do site: a
 * loja aberta, com aquele produto em destaque. A rota interceptada
 * (`@modal/(.)produto`) continua servindo o caso do clique, em que o catálogo
 * já está montado e não precisa remontar.
 *
 * Fechar aqui vai para `/`, e não `router.back()`: quem chegou pelo WhatsApp
 * não tem catálogo na pilha, e voltar o jogaria para fora do site.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default async function PaginaProduto({ params }: Parametros) {
  const { slug } = await params
  const produto = await buscarProdutoPublico(slug)

  if (!produto) notFound()

  return (
    <>
      <Home />
      <ModalProduto produto={produto} aoFechar="catalogo" />
    </>
  )
}
