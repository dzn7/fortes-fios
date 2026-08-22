import { notFound } from 'next/navigation'
import ModalProduto from '@/components/produto/ModalProduto'
import { buscarProdutoPublico } from '@/lib/server/produto-publico'

type Parametros = { params: Promise<{ slug: string }> }

/**
 * Rota interceptada.
 *
 * Clicando no catálogo, o Next serve **isto** em vez de `/produto/[slug]`: o
 * produto abre por cima da lista, a URL muda (então dá para copiar e o voltar do
 * celular fecha) e o catálogo continua montado atrás — a página e a rolagem
 * ficam onde estavam.
 *
 * Recarregar ou abrir o link direto ignora a interceptação e cai na página
 * inteira. Mesmo endereço, mesmo conteúdo, moldura diferente.
 *
 * Spec: specs/pagina-publica-produto.md
 */
export default async function ModalProdutoInterceptado({ params }: Parametros) {
  const { slug } = await params
  const produto = await buscarProdutoPublico(slug)

  if (!produto) notFound()

  return <ModalProduto produto={produto} />
}
