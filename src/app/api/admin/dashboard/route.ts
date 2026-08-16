import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'
import { podeExecutar } from '@/lib/rbac.mjs'

export const dynamic = 'force-dynamic'

/**
 * Indicadores da Visão geral.
 *
 * Aqui mora a distinção que o pedido chama de operacional × estratégico:
 * "15 pedidos hoje" é o que o atendente precisa para trabalhar; "R$ 4.580 de
 * faturamento" é informação do negócio. São a mesma consulta no banco, então
 * separá-las só no componente não protegeria nada — a receita vinha junto no
 * JSON e bastava abrir a aba Network.
 *
 * Por isso o corte acontece **aqui**: sem `dashboard.ver_receita`, os campos de
 * receita não são calculados nem enviados.
 *
 * Spec: specs/rbac-admin.md §7 · fase 4
 */

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

type LinhaEstatisticas = {
  total_pedidos: number | string | null
  receita: number | string | null
}

const dataValida = (valor: string | null): valor is string => {
  if (!valor) return false
  return !Number.isNaN(new Date(valor).getTime())
}

export async function GET(request: NextRequest) {
  const autorizacao = await exigirPermissao(request, 'dashboard.ver')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  const parametros = request.nextUrl.searchParams
  const inicioMes = parametros.get('inicioMes')
  const fimMes = parametros.get('fimMes')
  const inicioHoje = parametros.get('inicioHoje')
  const fimHoje = parametros.get('fimHoje')

  if (
    !dataValida(inicioMes) || !dataValida(fimMes) ||
    !dataValida(inicioHoje) || !dataValida(fimHoje)
  ) {
    return erro('Período inválido.', 400)
  }

  try {
    const supabase = obterSupabaseAdmin()

    const [mes, hoje] = await Promise.all([
      supabase.rpc('estatisticas_pedidos_periodo', { p_inicio: inicioMes, p_fim: fimMes }),
      supabase.rpc('estatisticas_pedidos_periodo', { p_inicio: inicioHoje, p_fim: fimHoje }),
    ])

    if (mes.error) throw new Error(mes.error.message)
    if (hoje.error) throw new Error(hoje.error.message)

    const linhaMes = (Array.isArray(mes.data) ? mes.data[0] : mes.data) as LinhaEstatisticas | null
    const linhaHoje = (Array.isArray(hoje.data) ? hoje.data[0] : hoje.data) as LinhaEstatisticas | null

    const podeVerReceita = podeExecutar(autorizacao.usuario.permissoes, 'dashboard.ver_receita')

    return NextResponse.json({
      sucesso: true,
      podeVerReceita,
      totalPedidos: Number(linhaMes?.total_pedidos || 0),
      pedidosHoje: Number(linhaHoje?.total_pedidos || 0),
      // Ausentes, não zerados: zero seria um faturamento de zero reais, que é
      // uma informação diferente de "você não tem acesso a este número".
      ...(podeVerReceita
        ? {
            receitaTotal: Number(linhaMes?.receita || 0),
            receitaHoje: Number(linhaHoje?.receita || 0),
          }
        : {}),
    })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao carregar indicadores.', 500)
  }
}
