import type { Produto } from '@/lib/supabase'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { idDoSlug } from '@/lib/link-produto.mjs'

/*
  Sem `import 'server-only'`: o pacote não está instalado e acrescentá-lo seria
  dependência nova (§3.2). O projeto marca o limite pela pasta — tudo em
  `src/lib/server/` só é importado por servidor, e `obterSupabaseAdmin` já
  lança se a service role não estiver no ambiente.
*/

/**
 * Colunas do produto que o site do cliente já mostra.
 *
 * A lista é fechada de propósito: `custo_unitario` fica de fora. O §3.9 do
 * AGENTS manda não ampliar o que chega ao cliente, e margem de lucro não é dado
 * de vitrine.
 */
const COLUNAS_PUBLICAS =
  'id, nome, descricao, preco, preco_original, desconto, parcelamento_ativo, parcelas_sem_juros, categoria, imagem_url, disponivel, destaque, ordem, estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque, created_at, updated_at'

/**
 * Busca o produto pelo slug público.
 *
 * A leitura é server-side (§3.9: preferir servidor a mais uma consulta anon no
 * browser). O plano foi medido em produção antes de escrever isto:
 *
 * ```
 * Index Scan using produtos_pkey  (cost=0.27..2.49 rows=1)
 *   Buffers: shared hit=3         Execution Time: 1.305 ms
 * ```
 *
 * Nenhum índice a acrescentar — a regra `query-covering-indexes` da skill mira
 * consulta com heap fetch pesado, e 3 buffers não deixam o que ganhar.
 *
 * `disponivel` entra na consulta, e não num teste depois: produto tirado do
 * catálogo não deve ter página pública.
 */
export async function buscarProdutoPublico(slug: string): Promise<Produto | null> {
  const id = idDoSlug(slug)
  if (!id) return null

  const { data, error } = await obterSupabaseAdmin()
    .from('produtos')
    .select(COLUNAS_PUBLICAS)
    .eq('id', id)
    .eq('disponivel', true)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as Produto
}
