import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVE_ROTULO_CATEGORIA_TODOS,
  normalizarRotuloCategoriaTodos,
} from '@/lib/categorias-publicas.mjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Credencial administrativa não configurada no servidor.')
    }

    const supabase = obterSupabaseAdmin()
    const [categorias, configuracaoRotulo] = await Promise.all([
      supabase
        .from('categorias_cardapio')
        .select('id, nome, ordem, icone')
        .eq('tipo', 'produto')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true }),
      supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_ROTULO_CATEGORIA_TODOS)
        .maybeSingle(),
    ])

    if (categorias.error) throw categorias.error
    if (configuracaoRotulo.error) throw configuracaoRotulo.error

    return NextResponse.json(
      {
        sucesso: true,
        categorias: categorias.data || [],
        rotuloTodos: normalizarRotuloCategoriaTodos(
          configuracaoRotulo.data?.valor,
        ),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Não foi possível carregar as categorias do catálogo.',
      },
      { status: 500 },
    )
  }
}
