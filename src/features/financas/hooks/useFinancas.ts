'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { obterDiaTrabalhoReferencia } from '@/lib/utils'
import type { CategoriaCaixa, Funcionario, MovimentacaoCaixa } from '@/lib/tipos-caixa'
import type {
  ComposicaoReceita,
  ContaCrediarioResumo,
  FiltroFinancas,
  LucroProduto,
  PagamentoPedido,
  PedidoFinanceiro,
  PontoFluxoCaixa,
  ResumoMensal,
  ResumoPeriodo,
  TipoMovimentacao,
} from '../types'
import { CORES_GRAFICOS, rotularFormaPagamento } from '../lib/formatadores'

// As colunas e filtros destas consultas agora vivem em `/api/admin/financas`.

/** Resposta de `/api/admin/financas` — os mesmos conjuntos que o hook lia direto. */
type RespostaFinancas = {
  sucesso?: boolean
  erro?: string
  categorias?: CategoriaCaixa[]
  funcionarios?: Funcionario[]
  pedidosPagos?: PedidoFinanceiro[]
  pedidosNaoPagos?: PedidoFinanceiro[]
  movimentacoes?: MovimentacaoCaixa[]
  crediarios?: ContaCrediarioResumo[]
  janela?: { total: number; created_at: string }[]
  movsJanela?: {
    tipo: TipoMovimentacao
    valor: number
    created_at: string
    pedido_id: string | null
  }[]
  pagamentos?: PagamentoPedido[]
  lucroPeriodo?: LinhaLucroProdutoRpc[]
  lucroJanela?: LinhaLucroProdutoRpc[]
}

interface DadosFinancas {
  movimentacoes: MovimentacaoCaixa[]
  pedidos: PedidoFinanceiro[]
  pedidosNaoPagos: PedidoFinanceiro[]
  crediarios: ContaCrediarioResumo[]
  resumoMensal: ResumoMensal[]
  pagamentos: PagamentoPedido[]
  lucroProdutos: LucroProduto[]
}

const DADOS_VAZIO: DadosFinancas = {
  movimentacoes: [],
  pedidos: [],
  pedidosNaoPagos: [],
  crediarios: [],
  resumoMensal: [],
  pagamentos: [],
  lucroProdutos: [],
}

type LinhaLucroProdutoRpc = {
  mes: string
  produto_id: string | null
  nome_produto: string
  quantidade: number | string | null
  receita_com_custo: number | string | null
  custo_mercadorias: number | string | null
  lucro_bruto: number | string | null
  receita_sem_custo: number | string | null
  itens_sem_custo: number | string | null
}

const ehEntradaManual = (m: Pick<MovimentacaoCaixa, 'tipo' | 'pedido_id'>) =>
  m.tipo === 'entrada' && !m.pedido_id

const ehSaida = (m: Pick<MovimentacaoCaixa, 'tipo'>) => m.tipo === 'saida'

const chaveDiaTrabalho = (isoOuDate: string | Date) => {
  const d = typeof isoOuDate === 'string' ? new Date(isoOuDate) : isoOuDate
  const ref = obterDiaTrabalhoReferencia(d)
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`
}

/**
 * Envia lançamento para a rota autorizada. Devolve a mensagem de erro, ou
 * `null` em caso de sucesso — 403 vira texto de permissão, não erro genérico.
 */
const enviarLancamento = async (
  metodo: 'POST' | 'PATCH',
  corpo: Record<string, unknown>,
): Promise<string | null> => {
  const resposta = await fetch('/api/admin/financas', {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(corpo),
  })
  const json = (await resposta.json()) as { sucesso?: boolean; erro?: string }

  if (resposta.status === 403) return 'Seu acesso não inclui esta operação.'
  if (!resposta.ok || !json.sucesso) return json.erro || 'Falha ao salvar'
  return null
}

export function useFinancas(filtro: FiltroFinancas) {
  const [dados, setDados] = useState<DadosFinancas>(DADOS_VAZIO)
  const [categorias, setCategorias] = useState<CategoriaCaixa[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  const carregarDados = useCallback(async (alvo: FiltroFinancas) => {
    const id = ++fetchIdRef.current
    setCarregando(true)
    setErro(null)

    try {
      const parametros = new URLSearchParams({ inicio: alvo.inicio, fim: alvo.fim })
      const resposta = await fetch(`/api/admin/financas?${parametros}`, {
        credentials: 'same-origin',
      })
      const json = (await resposta.json()) as RespostaFinancas

      if (id !== fetchIdRef.current) return

      if (!resposta.ok || !json.sucesso) {
        throw new Error(
          resposta.status === 403
            ? 'Seu acesso não inclui os dados financeiros.'
            : json.erro || 'Falha ao carregar dados financeiros',
        )
      }

      const fimFiltro = new Date(alvo.fim)

      setCategorias(json.categorias ?? [])
      setFuncionarios(json.funcionarios ?? [])

      const resumoMensal = construirResumoMensal(
        json.janela ?? [],
        json.movsJanela ?? [],
        json.lucroJanela ?? [],
        fimFiltro,
      )

      setDados({
        pedidos: json.pedidosPagos ?? [],
        pedidosNaoPagos: json.pedidosNaoPagos ?? [],
        movimentacoes: json.movimentacoes ?? [],
        crediarios: json.crediarios ?? [],
        resumoMensal,
        pagamentos: json.pagamentos ?? [],
        lucroProdutos: agruparLucroPorProduto(json.lucroPeriodo ?? []),
      })
    } catch (err) {
      if (id !== fetchIdRef.current) return
      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados financeiros'
      console.error('[useFinancas]', err)
      setErro(msg)
      setDados(DADOS_VAZIO)
    } finally {
      if (id === fetchIdRef.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarDados(filtro)
  }, [filtro.inicio, filtro.fim, carregarDados, filtro])

  const resumo = useMemo<ResumoPeriodo>(() => {
    const receitaPedidos = dados.pedidos.reduce((acc, p) => acc + Number(p.total ?? 0), 0)
    const receitaExtra = dados.movimentacoes
      .filter(ehEntradaManual)
      .reduce((acc, m) => acc + Number(m.valor ?? 0), 0)
    const despesas = dados.movimentacoes
      .filter(ehSaida)
      .reduce((acc, m) => acc + Number(m.valor ?? 0), 0)
    const receitaTotal = receitaPedidos + receitaExtra
    const resultadoCaixa = receitaTotal - despesas
    const receitaProdutosComCusto = dados.lucroProdutos.reduce((acc, item) => acc + item.receitaComCusto, 0)
    const custoMercadorias = dados.lucroProdutos.reduce((acc, item) => acc + item.custoMercadorias, 0)
    const lucroBrutoProdutos = dados.lucroProdutos.reduce((acc, item) => acc + item.lucroBruto, 0)
    const receitaSemCusto = dados.lucroProdutos.reduce((acc, item) => acc + item.receitaSemCusto, 0)
    const itensSemCusto = dados.lucroProdutos.reduce((acc, item) => acc + item.itensSemCusto, 0)
    const pedidosCount = dados.pedidos.length
    const ticketMedio = pedidosCount > 0 ? receitaPedidos / pedidosCount : 0
    const pedidosNaoPagosTotal = dados.pedidosNaoPagos.reduce((acc, p) => acc + Number(p.total ?? 0), 0)
    const crediarioAberto = dados.crediarios.reduce((acc, c) => acc + Number(c.saldo_atual ?? 0), 0)

    return {
      receitaPedidos,
      receitaExtra,
      receitaTotal,
      despesas,
      resultadoCaixa,
      receitaProdutosComCusto,
      custoMercadorias,
      lucroBrutoProdutos,
      margemBrutaProdutos: receitaProdutosComCusto > 0 ? (lucroBrutoProdutos / receitaProdutosComCusto) * 100 : null,
      receitaSemCusto,
      itensSemCusto,
      pedidosCount,
      ticketMedio,
      pedidosNaoPagosTotal,
      pedidosNaoPagosCount: dados.pedidosNaoPagos.length,
      crediarioAberto,
      crediarioCount: dados.crediarios.length,
      aReceberTotal: pedidosNaoPagosTotal + crediarioAberto,
    }
  }, [dados])

  const fluxoCaixa = useMemo<PontoFluxoCaixa[]>(
    () => construirFluxoCaixa(filtro, dados.pedidos, dados.movimentacoes),
    [filtro.inicio, filtro.fim, filtro.tipo, dados.pedidos, dados.movimentacoes],
  )

  const composicaoReceita = useMemo<ComposicaoReceita[]>(() => {
    const paidIds = new Set(dados.pedidos.map((p) => p.id))
    const porForma = new Map<string, number>()

    const somar = (formaBruta: string, valor: number) => {
      const rotulo = rotularFormaPagamento(formaBruta)
      porForma.set(rotulo, (porForma.get(rotulo) ?? 0) + valor)
    }

    for (const pg of dados.pagamentos) {
      if (!paidIds.has(pg.pedido_id)) continue
      somar(pg.forma_pagamento ?? 'outros', Number(pg.valor ?? 0))
    }

    const pedidosComPagamento = new Set(dados.pagamentos.map((pg) => pg.pedido_id))
    for (const p of dados.pedidos) {
      if (pedidosComPagamento.has(p.id)) continue
      somar(
        (p.forma_pagamento ?? (p.pagamento_online ? 'online' : 'outros')).toString(),
        Number(p.total ?? 0),
      )
    }

    for (const m of dados.movimentacoes) {
      if (!ehEntradaManual(m)) continue
      somar(m.forma_pagamento ?? 'outros', Number(m.valor ?? 0))
    }

    return Array.from(porForma.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([nome, valor], i) => ({
        nome,
        valor,
        cor: CORES_GRAFICOS.paleta[i % CORES_GRAFICOS.paleta.length],
      }))
  }, [dados.pedidos, dados.pagamentos, dados.movimentacoes])

  const refetch = useCallback(() => carregarDados(filtro), [carregarDados, filtro])

  const adicionarMovimentacao = useCallback(
    async (entrada: {
      tipo: TipoMovimentacao
      valor: number
      descricao?: string | null
      categoria_id?: string | null
      funcionario_id?: string | null
      forma_pagamento?: string | null
      data?: string
    }) => {
      // O caixa aberto e a gravação ficam no servidor: `movimentacoes_caixa`
      // não é mais alcançável pela anon key.
      const erroSalvar = await enviarLancamento('POST', entrada)
      if (erroSalvar) {
        toast.error('Não foi possível salvar a movimentação. ' + erroSalvar)
        throw new Error(erroSalvar)
      }
      toast.success(entrada.tipo === 'entrada' ? 'Receita lançada' : 'Despesa lançada')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  const atualizarMovimentacao = useCallback(
    async (
      id: string,
      entrada: {
        tipo: TipoMovimentacao
        valor: number
        descricao?: string | null
        categoria_id?: string | null
        forma_pagamento?: string | null
        data?: string
      },
    ) => {
      const erroAtualizar = await enviarLancamento('PATCH', { ...entrada, id })
      if (erroAtualizar) {
        toast.error('Não foi possível atualizar. ' + erroAtualizar)
        throw new Error(erroAtualizar)
      }
      toast.success('Lançamento atualizado')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  const removerMovimentacao = useCallback(
    async (id: string) => {
      const resposta = await fetch(`/api/admin/financas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const json = (await resposta.json()) as { sucesso?: boolean; erro?: string }
      if (!resposta.ok || !json.sucesso) {
        const mensagem = json.erro || 'Falha ao excluir'
        toast.error('Não foi possível excluir. ' + mensagem)
        throw new Error(mensagem)
      }
      toast.success('Lançamento removido')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  return {
    carregando,
    erro,
    resumo,
    fluxoCaixa,
    composicaoReceita,
    resumoMensal: dados.resumoMensal,
    lucroProdutos: dados.lucroProdutos,
    movimentacoes: dados.movimentacoes,
    pagamentos: dados.pagamentos,
    pedidos: dados.pedidos,
    pedidosNaoPagos: dados.pedidosNaoPagos,
    crediarios: dados.crediarios,
    categorias,
    funcionarios,
    refetch,
    adicionarMovimentacao,
    atualizarMovimentacao,
    removerMovimentacao,
  }
}

function construirFluxoCaixa(
  filtro: FiltroFinancas,
  pedidos: PedidoFinanceiro[],
  movs: MovimentacaoCaixa[],
): PontoFluxoCaixa[] {
  const inicio = new Date(filtro.inicio)
  const fim = new Date(filtro.fim)
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const agregarPorMes = dias > 60

  const buckets = new Map<string, PontoFluxoCaixa>()
  const fmtRotulo = new Intl.DateTimeFormat(
    'pt-BR',
    agregarPorMes ? { month: 'short' } : { day: '2-digit', month: '2-digit' },
  )

  const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  if (agregarPorMes) {
    const cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
    const limite = new Date(fim.getFullYear(), fim.getMonth(), 1)
    while (cur <= limite) {
      const k = chaveMes(cur)
      buckets.set(k, {
        data: k,
        rotulo: fmtRotulo.format(cur).replace('.', ''),
        receita: 0,
        despesa: 0,
        lucro: 0,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    const cur = new Date(inicio)
    cur.setHours(12, 0, 0, 0)
    const limite = new Date(fim)
    limite.setHours(12, 0, 0, 0)
    while (cur <= limite) {
      const k = chaveDiaTrabalho(cur)
      if (!buckets.has(k)) {
        const ref = obterDiaTrabalhoReferencia(cur)
        buckets.set(k, { data: k, rotulo: fmtRotulo.format(ref), receita: 0, despesa: 0, lucro: 0 })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  for (const p of pedidos) {
    const d = new Date(p.created_at)
    const k = agregarPorMes ? chaveMes(d) : chaveDiaTrabalho(d)
    const b = buckets.get(k)
    if (b) b.receita += Number(p.total ?? 0)
  }
  for (const m of movs) {
    const d = new Date(m.created_at)
    const k = agregarPorMes ? chaveMes(d) : chaveDiaTrabalho(d)
    const b = buckets.get(k)
    if (!b) continue
    if (ehEntradaManual(m)) b.receita += Number(m.valor ?? 0)
    else if (ehSaida(m)) b.despesa += Number(m.valor ?? 0)
  }
  const lista = Array.from(buckets.values())
  for (const b of lista) {
    b.lucro = b.receita - b.despesa
  }
  return lista
}

function construirResumoMensal(
  pedidos: { total: number; created_at: string }[],
  movs: { tipo: TipoMovimentacao; valor: number; created_at: string; pedido_id: string | null }[],
  lucroProdutos: LinhaLucroProdutoRpc[],
  fim: Date,
): ResumoMensal[] {
  const buckets = new Map<string, ResumoMensal>()
  const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

  for (let i = 11; i >= 0; i--) {
    const d = new Date(fim.getFullYear(), fim.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rotulo = fmtMes.format(d).replace('.', '').replace(' de ', '/')
    buckets.set(chave, {
      chave,
      rotulo,
      receita: 0,
      despesa: 0,
      lucro: 0,
      pedidos: 0,
      receitaProdutosComCusto: 0,
      custoMercadorias: 0,
      lucroBrutoProdutos: 0,
      receitaSemCusto: 0,
      itensSemCusto: 0,
    })
  }

  for (const p of pedidos) {
    const d = new Date(p.created_at)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(k)
    if (b) {
      b.receita += Number(p.total ?? 0)
      b.pedidos += 1
    }
  }
  for (const m of movs) {
    const d = new Date(m.created_at)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(k)
    if (!b) continue
    if (ehEntradaManual(m)) b.receita += Number(m.valor ?? 0)
    else if (ehSaida(m)) b.despesa += Number(m.valor ?? 0)
  }
  for (const item of lucroProdutos) {
    const chave = String(item.mes).slice(0, 7)
    const bucket = buckets.get(chave)
    if (!bucket) continue
    bucket.receitaProdutosComCusto += numeroSeguro(item.receita_com_custo)
    bucket.custoMercadorias += numeroSeguro(item.custo_mercadorias)
    bucket.lucroBrutoProdutos += numeroSeguro(item.lucro_bruto)
    bucket.receitaSemCusto += numeroSeguro(item.receita_sem_custo)
    bucket.itensSemCusto += numeroSeguro(item.itens_sem_custo)
  }
  const lista = Array.from(buckets.values())
  for (const b of lista) {
    b.lucro = b.receita - b.despesa
  }
  return lista
}

function agruparLucroPorProduto(linhas: LinhaLucroProdutoRpc[]): LucroProduto[] {
  const agrupados = new Map<string, LucroProduto>()

  for (const linha of linhas) {
    const nome = linha.nome_produto || 'Produto'
    const chave = linha.produto_id || `nome:${nome}`
    const atual = agrupados.get(chave) ?? {
      produtoId: linha.produto_id,
      nome,
      quantidade: 0,
      receitaComCusto: 0,
      custoMercadorias: 0,
      lucroBruto: 0,
      receitaSemCusto: 0,
      itensSemCusto: 0,
      margemBruta: null,
    }

    atual.quantidade += numeroSeguro(linha.quantidade)
    atual.receitaComCusto += numeroSeguro(linha.receita_com_custo)
    atual.custoMercadorias += numeroSeguro(linha.custo_mercadorias)
    atual.lucroBruto += numeroSeguro(linha.lucro_bruto)
    atual.receitaSemCusto += numeroSeguro(linha.receita_sem_custo)
    atual.itensSemCusto += numeroSeguro(linha.itens_sem_custo)
    atual.margemBruta = atual.receitaComCusto > 0
      ? (atual.lucroBruto / atual.receitaComCusto) * 100
      : null
    agrupados.set(chave, atual)
  }

  return Array.from(agrupados.values()).sort((a, b) => b.lucroBruto - a.lucroBruto || b.receitaComCusto - a.receitaComCusto)
}

function numeroSeguro(valor: number | string | null | undefined) {
  const numero = Number(valor ?? 0)
  return Number.isFinite(numero) ? numero : 0
}
