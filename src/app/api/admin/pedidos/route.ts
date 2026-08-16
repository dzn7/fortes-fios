import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'

export const dynamic = 'force-dynamic'

/**
 * Ações destrutivas sobre pedidos.
 *
 * Existe por um defeito real encontrado em uso: um atendente **sem**
 * `pedidos.excluir` conseguia excluir pedido. As telas do Admin escreviam
 * direto no Supabase com a anon key e nenhuma verificava permissão — as caixas
 * da tela de Acessos configuravam algo que ninguém lia.
 *
 * Aqui a verificação acontece antes de tocar no banco, e é a mesma para o botão
 * da tela e para quem chamar a rota na mão.
 *
 * Spec: specs/rbac-admin.md §7 · fase 6
 */

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Um lote grande demais é engano de uso ou abuso; nos dois casos, recusar. */
const LIMITE_LOTE = 100

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const normalizarIds = (valor: unknown): string[] => {
  const bruto = Array.isArray(valor) ? valor : [valor]
  const ids = bruto.filter(
    (item): item is string => typeof item === 'string' && UUID_VALIDO.test(item),
  )
  return Array.from(new Set(ids))
}

export async function DELETE(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'pedidos.excluir')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const ids = normalizarIds(corpo.ids ?? request.nextUrl.searchParams.get('id'))

    if (ids.length === 0) return erro('Nenhum pedido informado.', 400)
    if (ids.length > LIMITE_LOTE) {
      return erro(`Máximo de ${LIMITE_LOTE} pedidos por vez.`, 400)
    }

    const supabase = obterSupabaseAdmin()
    const { error } = await supabase.from('pedidos').delete().in('id', ids)
    if (error) throw new Error(error.message)

    return NextResponse.json({ sucesso: true, excluidos: ids.length })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao excluir pedido.', 500)
  }
}

/**
 * Mudança de status. Cancelar é uma permissão à parte de atualizar: desfazer
 * uma venda não é o mesmo que movê-la de "preparando" para "pronto".
 */
export async function PATCH(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  try {
    const corpo = (await request.json()) as { ids?: unknown; status?: unknown }
    const ids = normalizarIds(corpo.ids)
    const status = typeof corpo.status === 'string' ? corpo.status.trim() : ''

    if (ids.length === 0) return erro('Nenhum pedido informado.', 400)
    if (ids.length > LIMITE_LOTE) {
      return erro(`Máximo de ${LIMITE_LOTE} pedidos por vez.`, 400)
    }
    if (!status) return erro('Status inválido.', 400)

    const autorizacao = await exigirPermissao(
      request,
      status === 'cancelado' ? 'pedidos.cancelar' : 'pedidos.mudar_status',
    )
    if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

    const supabase = obterSupabaseAdmin()
    const { error } = await supabase
      .from('pedidos')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) throw new Error(error.message)
    return NextResponse.json({ sucesso: true, atualizados: ids.length })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao atualizar pedido.', 500)
  }
}
