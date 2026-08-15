import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { Notificacao, ResumoNotificacoes } from '@/lib/notificacoes.mjs'

export const dynamic = 'force-dynamic'

/**
 * Central de Notificações — leitura e escrita.
 *
 * Vai por route handler com `service_role` em vez de query anon no browser
 * (AGENTS.md §3.9): as tabelas de notificação não têm grant para anon.
 *
 * Egress: `modo=resumo` devolve só quatro inteiros, para a revalidação por
 * foco; `modo=completo` devolve resumo + lista na MESMA resposta, de modo que
 * abrir o sino não gere uma segunda ida ao servidor.
 */

const LIMITE_LISTA = 20
const LIMITE_LISTA_COM_RESOLVIDAS = 50

const normalizarUsuarioChave = (valor: string | null | undefined) => {
  const chave = (valor || '').trim()
  if (!chave || chave.length > 120) return null
  return chave
}

const normalizarIds = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) return []
  const ids = valor
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
  return Array.from(new Set(ids)).slice(0, 200)
}

type LinhaResumo = {
  urgentes: number | null
  normais: number | null
  nao_lidas: number | null
  total: number | null
}

const RESUMO_VAZIO: ResumoNotificacoes = { urgentes: 0, normais: 0, naoLidas: 0, total: 0 }

const lerResumo = async (usuarioChave: string): Promise<ResumoNotificacoes> => {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('resumo_notificacoes', {
    p_usuario_chave: usuarioChave,
  })

  if (error) throw new Error(error.message)

  const linha = (Array.isArray(data) ? data[0] : data) as LinhaResumo | null
  if (!linha) return RESUMO_VAZIO

  return {
    urgentes: Number(linha.urgentes ?? 0),
    normais: Number(linha.normais ?? 0),
    naoLidas: Number(linha.nao_lidas ?? 0),
    total: Number(linha.total ?? 0),
  }
}

const lerPreferenciaModal = async (usuarioChave: string): Promise<boolean> => {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase
    .from('notificacoes_preferencias')
    .select('modal_entrada_ativo')
    .eq('usuario_chave', usuarioChave)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.modal_entrada_ativo !== false
}

export async function GET(request: NextRequest) {
  try {
    const usuarioChave = normalizarUsuarioChave(
      request.nextUrl.searchParams.get('usuarioChave'),
    )
    if (!usuarioChave) {
      return NextResponse.json(
        { sucesso: false, erro: 'usuarioChave inválido.' },
        { status: 400 },
      )
    }

    const modo = request.nextUrl.searchParams.get('modo') === 'completo' ? 'completo' : 'resumo'

    if (modo === 'resumo') {
      const resumo = await lerResumo(usuarioChave)
      return NextResponse.json({ sucesso: true, resumo })
    }

    const incluirResolvidas =
      request.nextUrl.searchParams.get('incluirResolvidas') === 'true'

    const supabase = obterSupabaseAdmin()

    // Uma passada conjunta que corrige estado pré-existente e escala pedido
    // parado. É idempotente e roda no carregamento do painel, não a cada render.
    const { error: erroReconciliar } = await supabase.rpc('reconciliar_notificacoes')
    if (erroReconciliar) throw new Error(erroReconciliar.message)

    const [{ data: lista, error: erroLista }, resumo, modalAtivo] = await Promise.all([
      supabase.rpc('listar_notificacoes', {
        p_usuario_chave: usuarioChave,
        p_limite: incluirResolvidas ? LIMITE_LISTA_COM_RESOLVIDAS : LIMITE_LISTA,
        p_incluir_resolvidas: incluirResolvidas,
      }),
      lerResumo(usuarioChave),
      lerPreferenciaModal(usuarioChave),
    ])

    if (erroLista) throw new Error(erroLista.message)

    return NextResponse.json({
      sucesso: true,
      resumo,
      modalAtivo,
      notificacoes: (lista || []) as Notificacao[],
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar notificações.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

type CorpoPost = {
  usuarioChave?: string
  acao?: string
  ids?: unknown
  ativo?: unknown
}

const marcarLeitura = async (
  usuarioChave: string,
  ids: string[],
  campos: Partial<Record<'visualizada_em' | 'lida_em' | 'silenciada_em', string>>,
) => {
  if (ids.length === 0) return

  const agora = new Date().toISOString()
  const supabase = obterSupabaseAdmin()
  const { error } = await supabase.from('notificacoes_leitura').upsert(
    ids.map((id) => ({
      notificacao_id: id,
      usuario_chave: usuarioChave,
      atualizado_em: agora,
      ...campos,
    })),
    { onConflict: 'notificacao_id,usuario_chave' },
  )

  if (error) throw new Error(error.message)
}

/** Ids das notificações ativas ainda não lidas — para "marcar todas como lidas". */
const idsAtivosNaoLidos = async (usuarioChave: string): Promise<string[]> => {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('listar_notificacoes', {
    p_usuario_chave: usuarioChave,
    p_limite: 200,
    p_incluir_resolvidas: false,
  })

  if (error) throw new Error(error.message)

  return ((data || []) as Notificacao[]).filter((item) => !item.lida_em).map((item) => item.id)
}

export async function POST(request: NextRequest) {
  try {
    const corpo = (await request.json()) as CorpoPost
    const usuarioChave = normalizarUsuarioChave(corpo.usuarioChave)
    if (!usuarioChave) {
      return NextResponse.json(
        { sucesso: false, erro: 'usuarioChave inválido.' },
        { status: 400 },
      )
    }

    const agora = new Date().toISOString()
    const ids = normalizarIds(corpo.ids)

    switch (corpo.acao) {
      case 'visualizadas':
        await marcarLeitura(usuarioChave, ids, { visualizada_em: agora })
        break

      case 'lida':
        await marcarLeitura(usuarioChave, ids, { visualizada_em: agora, lida_em: agora })
        break

      case 'lidas_todas':
        await marcarLeitura(usuarioChave, await idsAtivosNaoLidos(usuarioChave), {
          visualizada_em: agora,
          lida_em: agora,
        })
        break

      case 'silenciada':
        await marcarLeitura(usuarioChave, ids, {
          visualizada_em: agora,
          silenciada_em: agora,
        })
        break

      case 'preferencia_modal': {
        const supabase = obterSupabaseAdmin()
        const { error } = await supabase.from('notificacoes_preferencias').upsert(
          {
            usuario_chave: usuarioChave,
            modal_entrada_ativo: corpo.ativo === true,
            atualizado_em: agora,
          },
          { onConflict: 'usuario_chave' },
        )
        if (error) throw new Error(error.message)
        break
      }

      default:
        return NextResponse.json(
          { sucesso: false, erro: 'Ação desconhecida.' },
          { status: 400 },
        )
    }

    return NextResponse.json({ sucesso: true, resumo: await lerResumo(usuarioChave) })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao atualizar notificações.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}
