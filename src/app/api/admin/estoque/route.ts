import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'

export const dynamic = 'force-dynamic'

/**
 * Ajuste de estoque atrás de `estoque.ajustar`.
 *
 * As RPCs `ajustar_estoque_produto` e `definir_estoque_produto` continuam
 * executáveis por `anon` porque a tela chamava direto — e enquanto for assim,
 * dá para zerar o estoque de qualquer produto com a anon key, que é pública.
 * Esta rota é o caminho autorizado; fechar as RPCs depende de nenhuma tela
 * chamá-las mais (ver migration 202608150007).
 *
 * Spec: specs/rbac-admin.md §7 · fase 6
 */

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

export async function PATCH(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'estoque.ajustar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json()) as {
      produtoId?: unknown
      delta?: unknown
      quantidade?: unknown
    }

    const produtoId = typeof corpo.produtoId === 'string' ? corpo.produtoId : ''
    if (!UUID_VALIDO.test(produtoId)) return erro('Produto inválido.', 400)

    const supabase = obterSupabaseAdmin()

    if (typeof corpo.delta === 'number' && Number.isInteger(corpo.delta)) {
      const { data, error } = await supabase.rpc('ajustar_estoque_produto', {
        p_produto_id: produtoId,
        p_delta: corpo.delta,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ sucesso: true, quantidade: Number(data) })
    }

    if (typeof corpo.quantidade === 'number' && Number.isInteger(corpo.quantidade)) {
      if (corpo.quantidade < 0) return erro('Quantidade não pode ser negativa.', 400)
      const { data, error } = await supabase.rpc('definir_estoque_produto', {
        p_produto_id: produtoId,
        p_quantidade: corpo.quantidade,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ sucesso: true, quantidade: Number(data) })
    }

    return erro('Informe delta ou quantidade, em número inteiro.', 400)
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao ajustar estoque.', 500)
  }
}
