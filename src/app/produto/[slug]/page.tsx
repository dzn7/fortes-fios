import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BarraProduto from '@/components/produto/BarraProduto'
import DetalheProduto from '@/components/produto/DetalheProduto'
import { buscarProdutoPublico } from '@/lib/server/produto-publico'
import { caminhoDoProduto } from '@/lib/link-produto.mjs'

type Parametros = { params: Promise<{ slug: string }> }

/**
 * O que faz o link virar cartão no WhatsApp.
 *
 * Sem `openGraph`, o link compartilhado aparece como texto cru — que é
 * exatamente o oposto do objetivo desta funcionalidade.
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
 * Página pública do produto.
 *
 * Server component: a consulta não passa pelo browser (§3.9). Produto
 * indisponível cai em `notFound` — `disponivel` é o interruptor com que o Admin
 * tira o produto do catálogo, e manter a página viva o contradiria. Esgotado é
 * outra coisa: a página existe e mostra "Esgotado".
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default async function PaginaProduto({ params }: Parametros) {
  const { slug } = await params
  const produto = await buscarProdutoPublico(slug)

  if (!produto) notFound()

  return (
    <div className="min-h-screen bg-background">
      <BarraProduto />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <DetalheProduto produto={produto} variante="pagina" />
      </main>
    </div>
  )
}
