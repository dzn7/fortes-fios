import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVE_MAIS_VENDIDOS_VITRINE,
  normalizarConfiguracaoMaisVendidos,
} from '@/lib/vitrineMaisVendidos'

export const dynamic = 'force-dynamic'

type ItemVendido = {
  produto_id: string | null
  quantidade: number | null
  subtotal: number | null
  pedido:
    | {
        status: string | null
        tipo_entrega: string | null
      }
    | Array<{
        status: string | null
        tipo_entrega: string | null
      }>
    | null
}

const TAMANHO_PAGINA = 1000
const DURACAO_CACHE_RANKING_MS = 60_000
let cacheRanking:
  | {
      expiraEm: number
      dados: Array<{ produtoId: string; quantidade: number; receita: number }>
    }
  | undefined

const carregarRankingAutomatico = async () => {
  if (cacheRanking && cacheRanking.expiraEm > Date.now()) {
    return cacheRanking.dados
  }

  const supabase = obterSupabaseAdmin()
  const totais = new Map<
    string,
    { quantidade: number; receita: number }
  >()
  let inicio = 0

  while (true) {
    const { data, error } = await supabase
      .from('itens_pedido')
      .select(
        'produto_id, quantidade, subtotal, pedido:pedidos!inner(status, tipo_entrega)',
      )
      .not('produto_id', 'is', null)
      .in('pedidos.tipo_entrega', ['entrega', 'retirada'])
      .neq('pedidos.status', 'cancelado')
      .neq('pedidos.status', 'aguardando_pagamento')
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error) throw error

    const itens = (data || []) as unknown as ItemVendido[]
    for (const item of itens) {
      if (!item.produto_id || !item.pedido) continue
      const atual = totais.get(item.produto_id) || {
        quantidade: 0,
        receita: 0,
      }
      atual.quantidade += Math.max(0, Number(item.quantidade) || 0)
      atual.receita += Math.max(0, Number(item.subtotal) || 0)
      totais.set(item.produto_id, atual)
    }

    if (itens.length < TAMANHO_PAGINA) break
    inicio += TAMANHO_PAGINA
  }

  const ranking = Array.from(totais.entries())
    .map(([produtoId, totaisProduto]) => ({ produtoId, ...totaisProduto }))
    .filter((produto) => produto.quantidade > 0)
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        b.receita - a.receita ||
        a.produtoId.localeCompare(b.produtoId),
    )

  cacheRanking = {
    expiraEm: Date.now() + DURACAO_CACHE_RANKING_MS,
    dados: ranking,
  }

  return ranking
}

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Credencial administrativa não configurada no servidor.')
    }

    const supabase = obterSupabaseAdmin()
    const { data: registro, error: erroConfiguracao } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_MAIS_VENDIDOS_VITRINE)
      .maybeSingle()

    if (erroConfiguracao) throw erroConfiguracao
    const configuracao = normalizarConfiguracaoMaisVendidos(registro?.valor)
    const rankingAutomatico =
      configuracao.ativo && configuracao.modo === 'automatico'
        ? await carregarRankingAutomatico()
        : []

    return NextResponse.json({
      sucesso: true,
      configuracao,
      rankingAutomatico,
    })
  } catch {
    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Não foi possível carregar os produtos mais vendidos.',
      },
      { status: 500 },
    )
  }
}
