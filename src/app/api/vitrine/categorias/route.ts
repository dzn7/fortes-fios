import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Credencial administrativa não configurada no servidor.')
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('categorias_cardapio')
      .select('id, nome, ordem')
      .eq('tipo', 'produto')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true })

    if (error) throw error

    return NextResponse.json(
      { sucesso: true, categorias: data || [] },
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
