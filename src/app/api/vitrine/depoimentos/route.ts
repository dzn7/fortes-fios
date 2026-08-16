import { NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVE_DEPOIMENTOS,
  CONFIGURACAO_DEPOIMENTOS_PADRAO,
  normalizarConfiguracaoDepoimentos,
} from '@/lib/vitrineDepoimentos.mjs'

export const dynamic = 'force-dynamic'

/**
 * Configuração pública dos depoimentos.
 *
 * Mesmo desenho da rota do Estúdio: uma linha de `configuracoes_loja`, lida com
 * `service_role` e devolvida já normalizada, para o componente do site não
 * precisar validar nada.
 *
 * `select('valor')` e não `select('*')`: a linha tem descrição e metadados que
 * a vitrine não usa.
 */
export async function GET() {
  try {
    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_DEPOIMENTOS)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json(
      { sucesso: true, configuracao: normalizarConfiguracaoDepoimentos(data?.valor) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    // Falha de leitura devolve a seção desligada: melhor a vitrine sem
    // depoimentos do que uma faixa quebrada no meio da home.
    return NextResponse.json(
      { sucesso: false, configuracao: CONFIGURACAO_DEPOIMENTOS_PADRAO },
      { status: 500 },
    )
  }
}
