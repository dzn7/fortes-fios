import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVE_OFERTAS_VITRINE,
  normalizarConfiguracaoOfertas,
} from '@/lib/vitrineOfertas'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error('Credencial administrativa não configurada no servidor.')
    }

    const supabase = obterSupabaseAdmin()
    const { data: registro, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_OFERTAS_VITRINE)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      sucesso: true,
      configuracao: normalizarConfiguracaoOfertas(registro?.valor),
    })
  } catch {
    return NextResponse.json(
      {
        sucesso: false,
        erro: 'Não foi possível carregar as ofertas.',
      },
      { status: 500 },
    )
  }
}
