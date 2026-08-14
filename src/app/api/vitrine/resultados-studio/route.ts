import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVE_RESULTADOS_STUDIO,
  normalizarConfiguracaoResultadosStudio,
} from '@/lib/vitrineResultadosStudio'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Credencial administrativa não configurada no servidor.')
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_RESULTADOS_STUDIO)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json(
      {
        sucesso: true,
        configuracao: normalizarConfiguracaoResultadosStudio(data?.valor),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Não foi possível carregar os resultados do studio.',
      },
      { status: 500 },
    )
  }
}
