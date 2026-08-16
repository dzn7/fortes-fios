import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'

export const dynamic = 'force-dynamic'

/**
 * Diárias — lançamento de pagamento avulso, que nasce como despesa no caixa.
 *
 * Mesma razão de `/api/admin/financas`: `financas_diarias` e
 * `movimentacoes_caixa` saíram do alcance de `anon`. Aqui há um motivo extra
 * para o servidor mandar — a criação escreve em DUAS tabelas, e o desfazer da
 * segunda falha precisa acontecer onde o cliente não pode desistir no meio.
 *
 * Spec: specs/rbac-admin.md §7 · fase 4
 */

const COLUNAS_DIARIA =
  'id, data_referencia, nome_pessoa, funcionario_id, valor, forma_pagamento, observacoes, movimentacao_id, created_at'

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const DATA_SIMPLES = /^\d{4}-\d{2}-\d{2}$/

/** Meio-dia evita que fuso horário jogue o lançamento para o dia anterior. */
const dataIsoMeioDia = (yyyyMmDd: string) => {
  const [ano, mes, dia] = yyyyMmDd.split('-').map(Number)
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0).toISOString()
}

export async function GET(request: NextRequest) {
  const autorizacao = await exigirPermissao(request, 'financas.ver')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  const inicio = request.nextUrl.searchParams.get('inicio')
  const fim = request.nextUrl.searchParams.get('fim')
  if (!inicio || !fim || !DATA_SIMPLES.test(inicio) || !DATA_SIMPLES.test(fim)) {
    return erro('Período inválido.', 400)
  }

  try {
    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('financas_diarias')
      .select(COLUNAS_DIARIA)
      .gte('data_referencia', inicio)
      .lte('data_referencia', fim)
      .order('data_referencia', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ sucesso: true, diarias: data || [] })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao carregar diárias.', 500)
  }
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'financas.criar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json()) as {
      nome_pessoa?: unknown
      valor?: unknown
      data_referencia?: unknown
      funcionario_id?: unknown
      forma_pagamento?: unknown
      observacoes?: unknown
    }

    const nome = typeof corpo.nome_pessoa === 'string' ? corpo.nome_pessoa.trim() : ''
    const valor = typeof corpo.valor === 'number' ? corpo.valor : NaN
    const dataRef =
      typeof corpo.data_referencia === 'string' ? corpo.data_referencia.slice(0, 10) : ''

    if (!nome) return erro('Informe o nome da pessoa.', 400)
    if (!Number.isFinite(valor) || valor <= 0) {
      return erro('Informe um valor válido maior que zero.', 400)
    }
    if (!DATA_SIMPLES.test(dataRef)) return erro('Data de referência inválida.', 400)

    const funcionarioId =
      typeof corpo.funcionario_id === 'string' && corpo.funcionario_id ? corpo.funcionario_id : null
    const formaPagamento =
      typeof corpo.forma_pagamento === 'string' && corpo.forma_pagamento
        ? corpo.forma_pagamento
        : null
    const observacoes =
      typeof corpo.observacoes === 'string' && corpo.observacoes.trim()
        ? corpo.observacoes.trim()
        : null

    const supabase = obterSupabaseAdmin()

    const [{ data: categoria }, { data: caixaAberto }] = await Promise.all([
      supabase
        .from('categorias_caixa')
        .select('id')
        .eq('tipo', 'saida')
        .ilike('nome', 'diária')
        .eq('ativo', true)
        .maybeSingle(),
      supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const descricao = observacoes
      ? `Diária – ${nome} (${observacoes})`
      : `Diária – ${nome}`

    const { data: movimentacao, error: erroMov } = await supabase
      .from('movimentacoes_caixa')
      .insert({
        tipo: 'saida',
        valor,
        descricao,
        categoria_id: categoria?.id ?? null,
        funcionario_id: funcionarioId,
        forma_pagamento: formaPagamento,
        caixa_id: caixaAberto?.id ?? null,
        created_at: dataIsoMeioDia(dataRef),
      })
      .select('id')
      .single()

    if (erroMov || !movimentacao?.id) {
      return erro(erroMov?.message || 'Não foi possível lançar a despesa da diária.', 500)
    }

    const { data: diaria, error: erroDiaria } = await supabase
      .from('financas_diarias')
      .insert({
        data_referencia: dataRef,
        nome_pessoa: nome,
        funcionario_id: funcionarioId,
        valor,
        forma_pagamento: formaPagamento,
        observacoes,
        movimentacao_id: movimentacao.id,
      })
      .select(COLUNAS_DIARIA)
      .single()

    // Compensação: sem isso, a despesa ficaria no caixa sem a diária que a
    // explica, e o total do mês passaria a mentir.
    if (erroDiaria || !diaria) {
      await supabase.from('movimentacoes_caixa').delete().eq('id', movimentacao.id)
      return erro(erroDiaria?.message || 'Não foi possível salvar a diária.', 500)
    }

    return NextResponse.json({ sucesso: true, diaria })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao lançar diária.', 500)
  }
}

export async function DELETE(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'financas.excluir')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const movimentacaoId = request.nextUrl.searchParams.get('movimentacaoId')
    if (!movimentacaoId) return erro('Diária inválida.', 400)

    // A diária cai junto por cascade da FK; apagar a movimentação é o suficiente.
    const supabase = obterSupabaseAdmin()
    const { error } = await supabase
      .from('movimentacoes_caixa')
      .delete()
      .eq('id', movimentacaoId)

    if (error) throw new Error(error.message)
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao excluir diária.', 500)
  }
}
