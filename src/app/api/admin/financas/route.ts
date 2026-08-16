import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'

export const dynamic = 'force-dynamic'

/**
 * Finanças — leitura e lançamentos, sempre atrás de permissão.
 *
 * Existe porque `financas_diarias`, `movimentacoes_caixa`, `caixas` e
 * `categorias_caixa` saíram do alcance de `anon` na migration
 * `202608150005`. Antes disso, esconder o item "Finanças" da sidebar não
 * protegia nada: a anon key vai no bundle da **loja pública**, então saldo,
 * despesa, salário e lucro estavam a uma requisição REST de distância de
 * qualquer pessoa na internet — não só de um atendente.
 *
 * As consultas são as mesmas que o hook fazia; o que mudou é quem as executa
 * (service_role) e quem tem direito de pedir (`financas.ver`). A agregação
 * continua no cliente, que só recebe os dados depois de autorizado.
 *
 * Spec: specs/rbac-admin.md §7 · fase 4
 */

const STATUS_PEDIDO_NAO_PAGO = ['aguardando_pagamento', 'pendente']

const COLUNAS_CATEGORIA = 'id, nome, tipo, cor, icone, ativo, ordem'
const COLUNAS_FUNCIONARIO = 'id, nome, cargo, ativo, tipo'
const COLUNAS_MOVIMENTACAO =
  'id, caixa_id, categoria_id, funcionario_id, pedido_id, tipo, valor, descricao, forma_pagamento, created_at, categoria:categorias_caixa(id, nome, tipo, cor, icone, ativo, ordem), funcionario:funcionarios(id, nome, cargo, ativo)'
const COLUNAS_PEDIDO =
  'id, numero_pedido, nome_cliente, total, taxa_entrega, taxa_servico, taxa_pagamento, status, pagamento_online, pagamento_online_status, forma_pagamento, created_at'

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const dataValida = (valor: string | null): valor is string => {
  if (!valor) return false
  const data = new Date(valor)
  return !Number.isNaN(data.getTime())
}

export async function GET(request: NextRequest) {
  const autorizacao = await exigirPermissao(request, 'financas.ver')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  const inicio = request.nextUrl.searchParams.get('inicio')
  const fim = request.nextUrl.searchParams.get('fim')
  if (!dataValida(inicio) || !dataValida(fim)) {
    return erro('Período inválido.', 400)
  }

  try {
    const supabase = obterSupabaseAdmin()
    const fimFiltro = new Date(fim)
    const inicioJanela = new Date(
      fimFiltro.getFullYear(),
      fimFiltro.getMonth() - 11,
      1,
      0, 0, 0, 0,
    ).toISOString()

    const [
      categorias,
      funcionarios,
      pedidosPagos,
      pedidosNaoPagos,
      movimentacoes,
      crediarios,
      janela,
      movsJanela,
      pagamentos,
      lucroPeriodo,
      lucroJanela,
    ] = await Promise.all([
      supabase.from('categorias_caixa').select(COLUNAS_CATEGORIA).eq('ativo', true).order('nome'),
      supabase.from('funcionarios').select(COLUNAS_FUNCIONARIO).eq('ativo', true).order('nome'),

      supabase
        .from('pedidos')
        .select(COLUNAS_PEDIDO)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')
        .neq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(2000),

      supabase
        .from('pedidos')
        .select(COLUNAS_PEDIDO)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .or(
          `status.in.(${STATUS_PEDIDO_NAO_PAGO.join(',')}),pagamento_online_status.eq.aguardando_pagamento`,
        )
        .order('created_at', { ascending: false })
        .limit(500),

      supabase
        .from('movimentacoes_caixa')
        .select(COLUNAS_MOVIMENTACAO)
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .order('created_at', { ascending: false })
        .limit(1000),

      supabase
        .from('crediario_contas')
        .select('id, cliente_nome, telefone, saldo_atual, status, atualizado_em')
        .eq('status', 'aberto')
        .gt('saldo_atual', 0)
        .order('saldo_atual', { ascending: false })
        .limit(300),

      supabase
        .from('pedidos')
        .select('total, created_at')
        .gte('created_at', inicioJanela)
        .lte('created_at', fim)
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')
        .neq('status', 'pendente')
        .limit(20000),

      supabase
        .from('movimentacoes_caixa')
        .select('tipo, valor, created_at, pedido_id')
        .gte('created_at', inicioJanela)
        .lte('created_at', fim)
        .limit(20000),

      supabase
        .from('pagamentos_pedido')
        .select('id, pedido_id, forma_pagamento, valor, bandeira, created_at')
        .gte('created_at', inicio)
        .lte('created_at', fim)
        .order('created_at', { ascending: false })
        .limit(5000),

      supabase.rpc('obter_lucro_produtos', { p_inicio: inicio, p_fim: fim }),
      supabase.rpc('obter_lucro_produtos', { p_inicio: inicioJanela, p_fim: fim }),
    ])

    const falhas = [
      categorias.error, funcionarios.error, pedidosPagos.error, pedidosNaoPagos.error,
      movimentacoes.error, crediarios.error, janela.error, movsJanela.error,
      pagamentos.error, lucroPeriodo.error, lucroJanela.error,
    ].filter(Boolean)

    if (falhas.length) {
      throw new Error(falhas.map((e) => e?.message).join(' | '))
    }

    return NextResponse.json({
      sucesso: true,
      categorias: categorias.data || [],
      funcionarios: funcionarios.data || [],
      pedidosPagos: pedidosPagos.data || [],
      pedidosNaoPagos: pedidosNaoPagos.data || [],
      movimentacoes: movimentacoes.data || [],
      crediarios: crediarios.data || [],
      janela: janela.data || [],
      movsJanela: movsJanela.data || [],
      pagamentos: pagamentos.data || [],
      lucroPeriodo: lucroPeriodo.data || [],
      lucroJanela: lucroJanela.data || [],
    })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao carregar finanças.', 500)
  }
}

type CorpoMovimentacao = {
  id?: unknown
  tipo?: unknown
  valor?: unknown
  descricao?: unknown
  categoria_id?: unknown
  funcionario_id?: unknown
  forma_pagamento?: unknown
  data?: unknown
}

const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null)

const normalizarLancamento = (corpo: CorpoMovimentacao) => {
  const tipo = corpo.tipo === 'entrada' || corpo.tipo === 'saida' ? corpo.tipo : null
  const valor = typeof corpo.valor === 'number' && Number.isFinite(corpo.valor) ? corpo.valor : null

  if (!tipo || valor === null || valor <= 0) return null

  return {
    tipo,
    valor,
    descricao: texto(corpo.descricao),
    categoria_id: texto(corpo.categoria_id),
    funcionario_id: texto(corpo.funcionario_id),
    forma_pagamento: texto(corpo.forma_pagamento),
    data: texto(corpo.data),
  }
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'financas.criar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const dados = normalizarLancamento((await request.json()) as CorpoMovimentacao)
    if (!dados) return erro('Lançamento inválido.', 400)

    const supabase = obterSupabaseAdmin()
    const { data: caixaAberto } = await supabase
      .from('caixas')
      .select('id')
      .eq('status', 'aberto')
      .order('data_abertura', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('movimentacoes_caixa').insert({
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao,
      categoria_id: dados.categoria_id,
      funcionario_id: dados.funcionario_id,
      forma_pagamento: dados.forma_pagamento,
      caixa_id: caixaAberto?.id ?? null,
      created_at: dados.data ?? new Date().toISOString(),
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao lançar.', 500)
  }
}

export async function PATCH(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'financas.editar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json()) as CorpoMovimentacao
    const id = texto(corpo.id)
    if (!id) return erro('Lançamento inválido.', 400)

    const dados = normalizarLancamento(corpo)
    if (!dados) return erro('Lançamento inválido.', 400)

    const payload: Record<string, unknown> = {
      tipo: dados.tipo,
      valor: dados.valor,
      descricao: dados.descricao,
      categoria_id: dados.categoria_id,
      forma_pagamento: dados.forma_pagamento,
    }
    if (dados.data) payload.created_at = dados.data

    const supabase = obterSupabaseAdmin()
    const { error } = await supabase.from('movimentacoes_caixa').update(payload).eq('id', id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao atualizar.', 500)
  }
}

export async function DELETE(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'financas.excluir')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return erro('Lançamento inválido.', 400)

    const supabase = obterSupabaseAdmin()
    const { error } = await supabase.from('movimentacoes_caixa').delete().eq('id', id)
    if (error) throw new Error(error.message)

    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao excluir.', 500)
  }
}
