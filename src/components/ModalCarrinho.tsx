'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Trash2, Minus, Plus, ShoppingBag, ChevronLeft, ChevronRight, MapPin, User, CreditCard, Check, Send, Phone, ChevronDown, CheckCircle2, AlertCircle, AlertTriangle, Info, QrCode, Banknote, Wallet } from 'lucide-react'
import Image from 'next/image'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import type { ItemCarrinho } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { usePreviewMode } from '@/contexts/PreviewContext'
import { registrarUsoCupom, removerUsoCupomPorPedido, TipoDescontoCupom, validarCupomParaCarrinho } from '@/lib/cupons'
import { buscarProximoNumeroPedidoDiario, normalizarNumeroPedido, sincronizarNumeroPedidoDiario } from '@/lib/pedidos/numero-diario'
import { registrarClientePedido } from '@/lib/registrar-cliente-pedido'
import { nomeClienteParaPedido, nomeClienteParaPontoSalao } from '@/lib/nome-cliente-local.mjs'
import { TEMPO_PADRAO_MESA_MINUTOS, calcularLiberacaoMesa } from '@/lib/mesas-tempo'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerNested, DrawerTitle } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { useAjusteTecladoVirtual } from '@/hooks/useAjusteTecladoVirtual'
import {
  CHAVE_TEMPO_ENTREGA,
  CHAVE_TEMPO_RETIRADA,
  TEMPO_ENTREGA_PADRAO,
  TEMPO_RETIRADA_PADRAO,
  normalizarTempoEstimado,
} from '@/lib/configuracoes-pedidos'
import {
  calcularProximaDataEntrega,
  descreverAgendaEntrega,
  formatarDataPrevistaEntrega,
  normalizarDiasEntrega,
  type DiaSemanaEntrega,
} from '@/lib/agenda-entrega'
import ModalAlerta from './ModalAlerta'

type ModalCarrinhoProps = {
  aberto: boolean
  onFechar: () => void
  lojaFechada?: boolean
}

type Alerta = {
  aberto: boolean
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info'
  titulo: string
  mensagem: string
}

type FeedbackCupom = {
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info'
  titulo: string
  mensagem: string
}

type TipoCatalogoItemCheckout = 'produto' | 'bebida' | 'combo'

type ItemCarrinhoCatalogado = {
  item: ItemCarrinho
  tipoCatalogo: TipoCatalogoItemCheckout
}

const ETAPAS = [
  { numero: 1, titulo: 'Carrinho', descricao: 'Itens', icone: ShoppingBag },
  { numero: 2, titulo: 'Dados', descricao: 'Entrega', icone: User },
  { numero: 3, titulo: 'Pagamento', descricao: 'Confirmar', icone: CreditCard },
]

type TipoTaxaPagamento = 'nenhuma' | 'percentual' | 'fixa'

type FormaPagamentoCheckout = {
  id: string
  codigo: string
  nome: string
  descricao?: string | null
  tipo_taxa: TipoTaxaPagamento
  valor_taxa: number
  ativo: boolean
  visivel_cliente: boolean
  aceita_troco: boolean
  ordem: number
}

const FORMAS_PAGAMENTO_PADRAO: FormaPagamentoCheckout[] = [
  {
    id: 'padrao-pix-online',
    codigo: 'pix_online',
    nome: 'PIX Online',
    tipo_taxa: 'nenhuma',
    valor_taxa: 0,
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: 1,
  },
  {
    id: 'padrao-pix',
    codigo: 'pix',
    nome: 'PIX',
    tipo_taxa: 'nenhuma',
    valor_taxa: 0,
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: 2,
  },
  {
    id: 'padrao-dinheiro',
    codigo: 'dinheiro',
    nome: 'Dinheiro',
    tipo_taxa: 'nenhuma',
    valor_taxa: 0,
    ativo: true,
    visivel_cliente: true,
    aceita_troco: true,
    ordem: 3,
  },
  {
    id: 'padrao-credito',
    codigo: 'credito',
    nome: 'Cartão de Crédito',
    tipo_taxa: 'nenhuma',
    valor_taxa: 0,
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: 4,
  },
  {
    id: 'padrao-debito',
    codigo: 'debito',
    nome: 'Cartão de Débito',
    tipo_taxa: 'nenhuma',
    valor_taxa: 0,
    ativo: true,
    visivel_cliente: true,
    aceita_troco: false,
    ordem: 5,
  },
]

type PedidoEnviado = {
  id: string
  numeroPedido: number
  nomeCliente: string
  tipoEntrega: 'entrega' | 'retirada' | 'local'
  total: number
  mesa?: number
  pagamentoOnlineAprovado?: boolean
  dataPrevistaEntrega?: string | null
}

type PontoLocalSelecionado = {
  id: string
  numero: number
  tipo: 'mesa' | 'local_externo'
  identificador: string | null
}

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  ativo: boolean
  entrega_gratis: boolean
  valor_minimo_pedido: number
  dias_entrega: DiaSemanaEntrega[]
}

type CupomAplicadoCheckout = {
  id: string
  codigo: string
  nome: string
  tipoDesconto: TipoDescontoCupom
  valorDesconto: number
  valorDescontoFrete: number
  totalComDesconto: number
}

type StatusPagamentoOnline =
  | 'nao_aplicavel'
  | 'aguardando_pagamento'
  | 'pago'
  | 'rejeitado'
  | 'cancelado'
  | 'expirado'
  | 'em_analise'

type PagamentoPixOnline = {
  pedidoId: string
  numeroPedido: number
  nomeCliente: string
  tipoEntrega: 'entrega' | 'retirada' | 'local'
  total: number
  mesa?: number | null
  pagamentoOnlineId: string
  mercadoPagoPaymentId?: string | null
  status: StatusPagamentoOnline
  qrCode: string | null
  qrCodeBase64: string | null
  qrCodeTicketUrl: string | null
  expiraEm: string | null
  pagamentoAprovadoProcessado?: boolean
  dataPrevistaEntrega?: string | null
}

const CHAVE_PAGAMENTO_PIX_PENDENTE = 'fortes-fios:pagamento_pix_pendente'
const CHAVE_DADOS_CLIENTE = 'fortes-fios:dados_cliente'
const CHAVE_ENTREGAS_ONLINE = 'entregas_online_ativas'

const obterRotuloPontoLocal = (ponto: PontoLocalSelecionado | null, mesa: number | null) => {
  const nome = ponto?.identificador?.trim()
  if (nome) return nome
  if (ponto?.tipo === 'local_externo') return `Local ${ponto.numero}`
  return mesa ? `Mesa ${mesa}` : 'Selecione sua mesa ou local'
}

export default function ModalCarrinho({ aberto, onFechar, lojaFechada = false }: ModalCarrinhoProps) {
  const { itens, removerItem, atualizarQuantidade, limparCarrinho, total, quantidadeTotal } = useCarrinho()
  const { modoSimulacao } = usePreviewMode()
  const [etapaAtual, setEtapaAtual] = useState(1)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [bairro, setBairro] = useState('')
  const [enderecoEntrega, setEnderecoEntrega] = useState('')
  const [pontoReferencia, setPontoReferencia] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada' | 'local'>('retirada')
  const [mesaSelecionada, setMesaSelecionada] = useState<number | null>(null)
  const [pontoLocalSelecionado, setPontoLocalSelecionado] = useState<PontoLocalSelecionado | null>(null)
  const [formaPagamento, setFormaPagamento] = useState('')
  const [formasPagamentoDisponiveis, setFormasPagamentoDisponiveis] = useState<FormaPagamentoCheckout[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [alerta, setAlerta] = useState<Alerta>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
  })
  const [precisaTroco, setPrecisaTroco] = useState(false)
  const [trocoPara, setTrocoPara] = useState('')
  const [pedidoEnviado, setPedidoEnviado] = useState<PedidoEnviado | null>(null)
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [bairroSelecionado, setBairroSelecionado] = useState<Bairro | null>(null)
  const [mostrarSeletorBairro, setMostrarSeletorBairro] = useState(false)
  const [carregandoBairros, setCarregandoBairros] = useState(false)
  const [codigoCupom, setCodigoCupom] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicadoCheckout | null>(null)
  const [validandoCupom, setValidandoCupom] = useState(false)
  const [feedbackCupom, setFeedbackCupom] = useState<FeedbackCupom | null>(null)
  const [pagamentoPixOnline, setPagamentoPixOnline] = useState<PagamentoPixOnline | null>(null)
  const [modalPagamentoPixAberto, setModalPagamentoPixAberto] = useState(false)
  const [sincronizandoPagamentoPix, setSincronizandoPagamentoPix] = useState(false)
  const [copiandoCodigoPix, setCopiandoCodigoPix] = useState(false)
  const [tempoRestanteSegundos, setTempoRestanteSegundos] = useState<number | null>(null)
  const expiracaoPixJaProcessada = useRef(false)
  const [tempoEntregaEstimado, setTempoEntregaEstimado] = useState(TEMPO_ENTREGA_PADRAO)
  const [tempoRetiradaEstimado, setTempoRetiradaEstimado] = useState(TEMPO_RETIRADA_PADRAO)
  const [entregasOnlineAtivas, setEntregasOnlineAtivas] = useState(true)

  // O Drawer do checkout tem formulário longo; medimos o teclado por conta própria
  // (ver `repositionInputs={false}` abaixo) para o painel encolher e voltar sozinho.
  const ajusteTeclado = useAjusteTecladoVirtual(aberto && !pedidoEnviado)
  const alturaTecladoAberto = ajusteTeclado?.altura ?? null

  const taxaEntrega = tipoEntrega === 'entrega' && bairroSelecionado
    ? (bairroSelecionado.entrega_gratis ? 0 : bairroSelecionado.taxa_entrega)
    : 0
  const valorMinimoEntrega = bairroSelecionado?.valor_minimo_pedido || 0
  const faltaParaMinimoEntrega = Math.max(0, valorMinimoEntrega - total)
  const atingiuMinimoEntrega = faltaParaMinimoEntrega <= 0
  const dataPrevistaEntrega = tipoEntrega === 'entrega' && bairroSelecionado
    ? calcularProximaDataEntrega(bairroSelecionado.dias_entrega)
    : null
  const textoAgendaEntrega = bairroSelecionado
    ? descreverAgendaEntrega(bairroSelecionado.dias_entrega)
    : null
  const textoDataPrevistaEntrega = dataPrevistaEntrega
    ? formatarDataPrevistaEntrega(dataPrevistaEntrega)
    : null
  const totalSemDesconto = total + taxaEntrega
  const descontoCupom = cupomAplicado ? cupomAplicado.valorDesconto + cupomAplicado.valorDescontoFrete : 0
  const totalFinal = cupomAplicado ? cupomAplicado.totalComDesconto : totalSemDesconto

  const formaPagamentoSelecionada = useMemo(
    () => formasPagamentoDisponiveis.find((forma) => forma.codigo === formaPagamento) || null,
    [formasPagamentoDisponiveis, formaPagamento]
  )

  const calcularTaxaPagamento = (totalBase: number) => {
    if (!formaPagamentoSelecionada) return 0

    const valorTaxa = Number(formaPagamentoSelecionada.valor_taxa || 0)
    if (!Number.isFinite(valorTaxa) || valorTaxa <= 0) return 0

    if (formaPagamentoSelecionada.tipo_taxa === 'percentual') {
      return totalBase * (valorTaxa / 100)
    }

    if (formaPagamentoSelecionada.tipo_taxa === 'fixa') {
      return valorTaxa
    }

    return 0
  }

  const taxaPagamentoAtual = useMemo(() => {
    return calcularTaxaPagamento(totalFinal)
  }, [formaPagamentoSelecionada, totalFinal])

  const totalFinalComTaxaPagamento = totalFinal + taxaPagamentoAtual
  const etapaAtualConfig = ETAPAS.find((etapa) => etapa.numero === etapaAtual) || ETAPAS[0]
  const progressoCheckout = Math.round((etapaAtual / ETAPAS.length) * 100)
  const usandoFallbackPagamentos =
    formasPagamentoDisponiveis.length > 0 &&
    formasPagamentoDisponiveis.every((forma) => forma.id.startsWith('padrao-'))
  const dadosClientePreenchidos = Boolean(nomeCliente.trim() && telefone.trim())
  const dadosEntregaPreenchidos =
    tipoEntrega === 'entrega'
      ? Boolean(bairroSelecionado && bairro.trim() && enderecoEntrega.trim() && atingiuMinimoEntrega)
      : tipoEntrega === 'local'
        ? Boolean(mesaSelecionada)
        : true
  const textoPendenciaEtapa = (() => {
    if (etapaAtual === 1) {
      return quantidadeTotal > 0
        ? `${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'} · R$ ${total.toFixed(2)}`
        : 'Adicione itens para continuar'
    }

    if (etapaAtual === 2) {
      if (!dadosClientePreenchidos) return 'Informe nome e telefone'
      if (tipoEntrega === 'entrega' && !bairroSelecionado) return 'Selecione a cidade'
      if (tipoEntrega === 'entrega' && !atingiuMinimoEntrega) return `Faltam R$ ${faltaParaMinimoEntrega.toFixed(2)}`
      if (tipoEntrega === 'entrega' && !bairro.trim()) return 'Informe o bairro'
      if (tipoEntrega === 'entrega' && !enderecoEntrega.trim()) return 'Informe o endereço'
      if (tipoEntrega === 'local' && !mesaSelecionada) return 'Selecione a mesa'
      return 'Dados prontos'
    }

    return formaPagamento ? `Pagamento: ${formaPagamentoSelecionada?.nome || formaPagamento}` : 'Escolha uma forma de pagamento'
  })()

  const calcularTempoRestantePagamentoPix = (expiraEm?: string | null) => {
    if (!expiraEm) return null
    const fim = new Date(expiraEm).getTime()
    if (!Number.isFinite(fim)) return null
    const restanteEmSegundos = Math.ceil((fim - Date.now()) / 1000)
    return Math.max(0, restanteEmSegundos)
  }

  const textoTempoRestantePagamentoPix = useMemo(() => {
    if (tempoRestanteSegundos === null) return null
    const minutos = Math.floor(tempoRestanteSegundos / 60)
      .toString()
      .padStart(2, '0')
    const segundos = (tempoRestanteSegundos % 60).toString().padStart(2, '0')
    return `${minutos}:${segundos}`
  }, [tempoRestanteSegundos])

  const salvarPagamentoPixPendente = (dados: PagamentoPixOnline | null) => {
    if (typeof window === 'undefined') return
    if (!dados) {
      localStorage.removeItem(CHAVE_PAGAMENTO_PIX_PENDENTE)
      return
    }
    localStorage.setItem(CHAVE_PAGAMENTO_PIX_PENDENTE, JSON.stringify(dados))
  }

  const normalizarTipoTaxa = (tipo: unknown): TipoTaxaPagamento => {
    if (tipo === 'percentual' || tipo === 'fixa') return tipo
    return 'nenhuma'
  }

  const normalizarFormaPagamento = (forma: Partial<FormaPagamentoCheckout>): FormaPagamentoCheckout => ({
    id: String(forma.id || crypto.randomUUID()),
    codigo: String(forma.codigo || '').toLowerCase().trim(),
    nome: String(forma.nome || '').trim(),
    descricao: forma.descricao ? String(forma.descricao) : null,
    tipo_taxa: normalizarTipoTaxa(forma.tipo_taxa),
    valor_taxa: Number(forma.valor_taxa || 0),
    ativo: Boolean(forma.ativo),
    visivel_cliente: Boolean(forma.visivel_cliente),
    aceita_troco: Boolean(forma.aceita_troco),
    ordem: Number.isFinite(Number(forma.ordem)) ? Number(forma.ordem) : 0,
  })

  const carregarFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('id, codigo, nome, descricao, tipo_taxa, valor_taxa, ativo, visivel_cliente, aceita_troco, ordem')
        .eq('ativo', true)
        .eq('visivel_cliente', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error

      const formasNormalizadas = (data || [])
        .map((forma) => normalizarFormaPagamento(forma as Partial<FormaPagamentoCheckout>))
        .filter((forma) => forma.codigo && forma.nome)

      if (formasNormalizadas.length > 0) {
        setFormasPagamentoDisponiveis(formasNormalizadas)
        return
      }

      setFormasPagamentoDisponiveis(FORMAS_PAGAMENTO_PADRAO)
    } catch (error) {
      console.error('[Pagamento] Erro ao carregar formas de pagamento:', error)
      setFormasPagamentoDisponiveis(FORMAS_PAGAMENTO_PADRAO)
    }
  }

  // Restaurar dados do cliente e carregar os prazos exibidos no checkout.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_DADOS_CLIENTE)
      if (salvo) {
        const dados = JSON.parse(salvo)
        if (dados.nome && !nomeCliente) setNomeCliente(dados.nome)
        if (dados.telefone && !telefone) setTelefone(dados.telefone)
      }
    } catch {}

    let ativo = true
    const aplicarTempo = (chave: string, valor: unknown) => {
      if (!ativo) return
      if (chave === CHAVE_TEMPO_ENTREGA) {
        setTempoEntregaEstimado(normalizarTempoEstimado(valor, TEMPO_ENTREGA_PADRAO))
      }
      if (chave === CHAVE_TEMPO_RETIRADA) {
        setTempoRetiradaEstimado(normalizarTempoEstimado(valor, TEMPO_RETIRADA_PADRAO))
      }
    }

    supabase
      .from('configuracoes_loja')
      .select('chave, valor')
      .in('chave', [CHAVE_TEMPO_ENTREGA, CHAVE_TEMPO_RETIRADA])
      .then(({ data }) => {
        for (const configuracao of data || []) {
          aplicarTempo(configuracao.chave, configuracao.valor)
        }
      })

    const canal = supabase
      .channel('config-tempos-pedidos-cliente')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_loja' },
        (payload) => {
          const configuracao = payload.new as { chave?: string; valor?: string } | null
          if (configuracao?.chave) aplicarTempo(configuracao.chave, configuracao.valor)
        },
      )
      .subscribe()

    return () => {
      ativo = false
      void supabase.removeChannel(canal)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ativo = true

    const aplicarStatusEntregas = (valor?: string | null) => {
      const entregasAtivas = (valor ?? 'true') !== 'false'
      if (!ativo) return

      setEntregasOnlineAtivas(entregasAtivas)
      if (!entregasAtivas) {
        setTipoEntrega((tipoAtual) => tipoAtual === 'entrega' ? 'retirada' : tipoAtual)
        setBairroSelecionado(null)
        setBairro('')
        setEnderecoEntrega('')
        setPontoReferencia('')
        setMostrarSeletorBairro(false)
      }
    }

    supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_ENTREGAS_ONLINE)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[Checkout] Erro ao carregar status das entregas:', error)
          return
        }
        aplicarStatusEntregas(data?.valor)
      })

    const canal = supabase
      .channel('config-entregas-online-cliente')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_loja',
          filter: `chave=eq.${CHAVE_ENTREGAS_ONLINE}`,
        },
        (payload) => {
          const novaConfig = payload.new as { valor?: string } | null
          aplicarStatusEntregas(novaConfig?.valor)
        }
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(canal)
    }
  }, [])

  useEffect(() => {
    // Ao encolher o painel para caber acima do teclado, o campo em foco pode sair
    // da área rolável; o browser só o alinha antes do redimensionamento.
    if (alturaTecladoAberto === null) return

    const campo = document.activeElement
    if (!(campo instanceof HTMLInputElement) && !(campo instanceof HTMLTextAreaElement)) return

    const id = window.setTimeout(() => campo.scrollIntoView({ block: 'center' }), 120)
    return () => window.clearTimeout(id)
  }, [alturaTecladoAberto])

  useEffect(() => {
    if (!aberto) {
      setEtapaAtual(1)
      setPedidoEnviado(null)
      removerCupomAplicado({ silencioso: true })
    } else {
      carregarBairros()
      carregarFormasPagamento()

      if (typeof window === 'undefined') return

      let ativo = true
      const reidratarPagamentoPixPendente = async () => {
        const pagamentoSalvo = localStorage.getItem(CHAVE_PAGAMENTO_PIX_PENDENTE)
        if (!pagamentoSalvo) return

        try {
          const dados = JSON.parse(pagamentoSalvo) as PagamentoPixOnline
          if (!dados?.pedidoId || !dados?.pagamentoOnlineId) {
            localStorage.removeItem(CHAVE_PAGAMENTO_PIX_PENDENTE)
            return
          }

          const pagamentoFinalizado = statusPagamentoFinalizado(dados.status)
          const pagamentoExpiradoLocalmente =
            calcularTempoRestantePagamentoPix(dados.expiraEm) !== null &&
            (calcularTempoRestantePagamentoPix(dados.expiraEm) || 0) <= 0

          if (pagamentoFinalizado || pagamentoExpiradoLocalmente || !dados.expiraEm) {
            const pagamentoAtualizado = await consultarStatusPagamentoPixPorId(dados.pagamentoOnlineId, true)
            if (!ativo) return

            if (pagamentoAtualizado) {
              aplicarAtualizacaoPagamentoPix(pagamentoAtualizado)
            }

            const deveAbrirModal =
              pagamentoAtualizado &&
              !statusPagamentoFinalizado(pagamentoAtualizado.status) &&
              (!pagamentoAtualizado.expiraEm ||
                (calcularTempoRestantePagamentoPix(pagamentoAtualizado.expiraEm) || 0) > 0)

            if (deveAbrirModal) {
              setPagamentoPixOnline(pagamentoAtualizado)
              setModalPagamentoPixAberto(true)
            } else {
              setPagamentoPixOnline(null)
              setModalPagamentoPixAberto(false)
              localStorage.removeItem(CHAVE_PAGAMENTO_PIX_PENDENTE)
            }
            return
          }

          setPagamentoPixOnline(dados)
          setModalPagamentoPixAberto(true)
        } catch {
          localStorage.removeItem(CHAVE_PAGAMENTO_PIX_PENDENTE)
        }
      }

      void reidratarPagamentoPixPendente()

      return () => {
        ativo = false
      }
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return

    const canalFormasPagamento = supabase
      .channel('formas-pagamento-cliente')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'formas_pagamento' },
        () => {
          carregarFormasPagamento()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalFormasPagamento)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return

    if (formasPagamentoDisponiveis.length === 0) {
      if (formaPagamento) {
        setFormaPagamento('')
      }
      return
    }

    const formaExiste = formasPagamentoDisponiveis.some((forma) => forma.codigo === formaPagamento)
    if (formaExiste) return

    const formaPadrao =
      formasPagamentoDisponiveis.find((forma) => forma.codigo === 'pix_online') || formasPagamentoDisponiveis[0]
    setFormaPagamento(formaPadrao.codigo)
  }, [aberto, formaPagamento, formasPagamentoDisponiveis])

  useEffect(() => {
    if (formaPagamentoSelecionada?.aceita_troco) return
    if (!precisaTroco && !trocoPara) return
    setPrecisaTroco(false)
    setTrocoPara('')
  }, [formaPagamentoSelecionada?.aceita_troco, precisaTroco, trocoPara])

  useEffect(() => {
    if (!cupomAplicado) return
    if (!codigoCupom) return

    let ativo = true

    const revalidarCupom = async () => {
      const resultado = await validarCupomAtual(codigoCupom)
      if (!ativo) return

      if (!resultado.valido || !resultado.cupom) {
        removerCupomAplicado({ silencioso: true })
        mostrarFeedbackCupom('info', 'Cupom removido', resultado.mensagem)
        return
      }

      const estadoAtualizado = montarEstadoCupomAplicado(resultado)
      setCupomAplicado(estadoAtualizado)
    }

    void revalidarCupom()

    return () => {
      ativo = false
    }
  }, [codigoCupom, cupomAplicado?.id, itens, taxaEntrega, tipoEntrega, total, telefone])

  // Realtime para cidades - atualiza taxa e compra mínima em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('bairros-cliente')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bairros' },
        () => {
          carregarBairros()
          // Atualiza cidade selecionada se houver mudança
          if (bairroSelecionado) {
            supabase
              .from('bairros')
              .select('*')
              .eq('id', bairroSelecionado.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setBairroSelecionado({
                    ...data,
                    taxa_entrega: Number(data.taxa_entrega || 0),
                    valor_minimo_pedido: Number(data.valor_minimo_pedido || 0),
                    entrega_gratis: Boolean(data.entrega_gratis),
                    dias_entrega: normalizarDiasEntrega(data.dias_entrega),
                  })
                }
              })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bairroSelecionado])

  async function carregarBairros() {
    setCarregandoBairros(true)
    try {
      const { data, error } = await supabase
        .from('bairros')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setBairros(
        (data || []).map((cidade) => ({
          ...cidade,
          taxa_entrega: Number(cidade.taxa_entrega || 0),
          valor_minimo_pedido: Number(cidade.valor_minimo_pedido || 0),
          entrega_gratis: Boolean(cidade.entrega_gratis),
          dias_entrega: normalizarDiasEntrega(cidade.dias_entrega),
        })),
      )
    } catch (error) {
      console.error('Erro ao carregar cidades:', error)
    } finally {
      setCarregandoBairros(false)
    }
  }


  const mostrarAlerta = (tipo: 'sucesso' | 'erro' | 'aviso' | 'info', titulo: string, mensagem: string) => {
    setAlerta({ aberto: true, tipo, titulo, mensagem })
  }

  const mostrarFeedbackCupom = (
    tipo: FeedbackCupom['tipo'],
    titulo: string,
    mensagem: string
  ) => {
    setFeedbackCupom({ tipo, titulo, mensagem })
  }

  const montarEstadoCupomAplicado = (resultado: {
    cupom: { id: string; codigo: string; nome: string; tipo_desconto: TipoDescontoCupom } | null
    valorDesconto: number
    valorDescontoFrete: number
    totalComDesconto: number
  }): CupomAplicadoCheckout | null => {
    if (!resultado.cupom) return null
    return {
      id: resultado.cupom.id,
      codigo: resultado.cupom.codigo,
      nome: resultado.cupom.nome,
      tipoDesconto: resultado.cupom.tipo_desconto,
      valorDesconto: resultado.valorDesconto,
      valorDescontoFrete: resultado.valorDescontoFrete,
      totalComDesconto: resultado.totalComDesconto,
    }
  }

  const validarCupomAtual = async (codigo: string) => {
    return validarCupomParaCarrinho({
      codigo,
      itens,
      subtotal: total,
      taxaEntrega,
      tipoEntrega,
      telefoneCliente: telefone,
    })
  }

  const removerCupomAplicado = (opcoes?: { silencioso?: boolean }) => {
    setCupomAplicado(null)
    setCodigoCupom('')
    if (opcoes?.silencioso) {
      setFeedbackCupom(null)
      return
    }
    mostrarFeedbackCupom('info', 'Cupom removido', 'Você pode inserir outro cupom quando quiser.')
  }

  const aplicarCupom = async () => {
    if (!codigoCupom.trim()) {
      mostrarFeedbackCupom('aviso', 'Cupom vazio', 'Informe um código de cupom.')
      return
    }

    if (itens.length === 0) {
      mostrarFeedbackCupom('aviso', 'Carrinho vazio', 'Adicione itens antes de aplicar um cupom.')
      return
    }

    setValidandoCupom(true)
    try {
      const resultado = await validarCupomAtual(codigoCupom)
      if (!resultado.valido || !resultado.cupom) {
        mostrarFeedbackCupom('aviso', 'Cupom inválido', resultado.mensagem)
        return
      }

      const estadoCupom = montarEstadoCupomAplicado(resultado)
      setCupomAplicado(estadoCupom)
      setCodigoCupom(resultado.cupom.codigo)
      const economia = resultado.valorDesconto + resultado.valorDescontoFrete
      const mensagemEconomia = economia > 0
        ? `${resultado.cupom.codigo} aplicado. Você economizou R$ ${economia.toFixed(2)} neste pedido.`
        : `${resultado.cupom.codigo} aplicado com sucesso.`
      mostrarFeedbackCupom('sucesso', 'Cupom aplicado', mensagemEconomia)
    } catch (erro) {
      console.error('[Cupom] Erro ao aplicar cupom:', erro)
      mostrarFeedbackCupom('erro', 'Erro no cupom', 'Não foi possível validar o cupom. Tente novamente.')
    } finally {
      setValidandoCupom(false)
    }
  }

  const statusPagamentoFinalizado = (status: StatusPagamentoOnline) => {
    return status === 'pago' || status === 'rejeitado' || status === 'cancelado' || status === 'expirado'
  }

  const limparFormularioCheckout = () => {
    limparCarrinho()
    // Restaurar nome e telefone do localStorage em vez de limpar
    try {
      const salvo = localStorage.getItem(CHAVE_DADOS_CLIENTE)
      if (salvo) {
        const dados = JSON.parse(salvo)
        setNomeCliente(dados.nome || '')
        setTelefone(dados.telefone || '')
      } else {
        setNomeCliente('')
        setTelefone('')
      }
    } catch {
      setNomeCliente('')
      setTelefone('')
    }
    setBairro('')
    setBairroSelecionado(null)
    setEnderecoEntrega('')
    setPontoReferencia('')
    setTipoEntrega('retirada')
    setMesaSelecionada(null)
    setPontoLocalSelecionado(null)
    setFormaPagamento('')
    setObservacoes('')
    setPrecisaTroco(false)
    setTrocoPara('')
    removerCupomAplicado({ silencioso: true })
    setEtapaAtual(1)
  }

  const aplicarAtualizacaoPagamentoPix = (dadosAtualizados: PagamentoPixOnline) => {
    setPagamentoPixOnline(dadosAtualizados)

    if (dadosAtualizados.status === 'pago') {
      salvarPagamentoPixPendente(null)

      if (!pedidoEnviado || pedidoEnviado.id !== dadosAtualizados.pedidoId) {
        setPedidoEnviado({
          id: dadosAtualizados.pedidoId,
          numeroPedido: dadosAtualizados.numeroPedido,
          nomeCliente: dadosAtualizados.nomeCliente,
          tipoEntrega: dadosAtualizados.tipoEntrega,
          total: dadosAtualizados.total,
          mesa: dadosAtualizados.mesa || undefined,
          pagamentoOnlineAprovado: true,
          dataPrevistaEntrega: dadosAtualizados.dataPrevistaEntrega,
        })
        limparFormularioCheckout()
      }

      return
    }

    if (statusPagamentoFinalizado(dadosAtualizados.status)) {
      salvarPagamentoPixPendente(null)
    } else {
      salvarPagamentoPixPendente(dadosAtualizados)
    }
  }

  const consultarStatusPagamentoPixPorId = async (
    pagamentoOnlineId: string,
    forcar = false
  ): Promise<PagamentoPixOnline> => {
    const parametros = new URLSearchParams({ pagamentoOnlineId })
    if (forcar) {
      parametros.set('force', '1')
    }

    const resposta = await fetch(`/api/pagamentos/mercado-pago/status?${parametros.toString()}`)
    const corpo = await resposta.json()

    if (!resposta.ok || !corpo?.sucesso || !corpo?.pagamento) {
      throw new Error(corpo?.erro || 'Não foi possível atualizar o status do pagamento.')
    }

    return corpo.pagamento as PagamentoPixOnline
  }

  const consultarStatusPagamentoPix = async (forcar = false) => {
    if (!pagamentoPixOnline) return

    setSincronizandoPagamentoPix(true)
    try {
      const pagamento = await consultarStatusPagamentoPixPorId(pagamentoPixOnline.pagamentoOnlineId, forcar)
      aplicarAtualizacaoPagamentoPix(pagamento)
    } catch (erro) {
      console.error('[Pagamento PIX Online] Erro ao consultar status:', erro)
    } finally {
      setSincronizandoPagamentoPix(false)
    }
  }

  useEffect(() => {
    if (!modalPagamentoPixAberto || !pagamentoPixOnline) return
    if (statusPagamentoFinalizado(pagamentoPixOnline.status)) return

    let ativo = true

    const verificar = async () => {
      if (!ativo) return
      await consultarStatusPagamentoPix()
    }

    void verificar()
    const intervalo = window.setInterval(verificar, 5000)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
    }
  }, [modalPagamentoPixAberto, pagamentoPixOnline?.pagamentoOnlineId, pagamentoPixOnline?.status])

  useEffect(() => {
    if (!modalPagamentoPixAberto || !pagamentoPixOnline?.pagamentoOnlineId) {
      setTempoRestanteSegundos(null)
      expiracaoPixJaProcessada.current = false
      return
    }

    expiracaoPixJaProcessada.current = false

    const atualizarTempoRestante = () => {
      const restante = calcularTempoRestantePagamentoPix(pagamentoPixOnline.expiraEm)
      setTempoRestanteSegundos(restante)
      if (restante !== null && restante > 0) {
        expiracaoPixJaProcessada.current = false
      }
    }

    atualizarTempoRestante()
    const intervalo = window.setInterval(atualizarTempoRestante, 1000)

    return () => {
      window.clearInterval(intervalo)
    }
  }, [modalPagamentoPixAberto, pagamentoPixOnline?.expiraEm, pagamentoPixOnline?.pagamentoOnlineId])

  useEffect(() => {
    if (!modalPagamentoPixAberto || !pagamentoPixOnline) return
    if (statusPagamentoFinalizado(pagamentoPixOnline.status)) return
    if (tempoRestanteSegundos === null || tempoRestanteSegundos > 0) return
    if (expiracaoPixJaProcessada.current) return

    expiracaoPixJaProcessada.current = true
    void consultarStatusPagamentoPix(true)
  }, [modalPagamentoPixAberto, pagamentoPixOnline, tempoRestanteSegundos])

  const copiarCodigoPix = async () => {
    if (!pagamentoPixOnline?.qrCode) return
    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    setCopiandoCodigoPix(true)
    try {
      await navigator.clipboard.writeText(pagamentoPixOnline.qrCode)
      mostrarAlerta('sucesso', 'Código PIX copiado', 'O código PIX foi copiado para a área de transferência.')
    } catch {
      mostrarAlerta('erro', 'Falha ao copiar', 'Não foi possível copiar o código PIX.')
    } finally {
      setCopiandoCodigoPix(false)
    }
  }

  const fecharModalPagamentoPix = () => {
    if (pagamentoPixOnline && pagamentoPixOnline.status !== 'pago' && statusPagamentoFinalizado(pagamentoPixOnline.status)) {
      setPagamentoPixOnline(null)
      salvarPagamentoPixPendente(null)
    }
    setModalPagamentoPixAberto(false)
  }

  const validarEtapa = (etapa: number): boolean => {
    if (etapa === 1) {
      if (itens.length === 0) {
        mostrarAlerta('aviso', 'Carrinho vazio', 'Adicione itens ao carrinho para continuar')
        return false
      }
      return true
    }

    if (etapa === 2) {
      if (!nomeCliente.trim()) {
        mostrarAlerta('aviso', 'Nome obrigatório', 'Por favor, informe seu nome')
        return false
      }
      if (!telefone.trim()) {
        mostrarAlerta('aviso', 'Telefone obrigatório', 'Por favor, informe seu telefone para contato')
        return false
      }
      if (tipoEntrega === 'entrega') {
        if (!entregasOnlineAtivas) {
          mostrarAlerta('aviso', 'Entrega indisponível', 'No momento estamos aceitando apenas retirada.')
          setTipoEntrega('retirada')
          setBairroSelecionado(null)
          setBairro('')
          return false
        }
        if (!bairroSelecionado) {
          mostrarAlerta('aviso', 'Cidade obrigatória', 'Selecione a cidade para entrega')
          return false
        }
        if (!atingiuMinimoEntrega) {
          mostrarAlerta(
            'aviso',
            'Compra mínima não atingida',
            `Para entrega em ${bairroSelecionado.nome}, adicione mais R$ ${faltaParaMinimoEntrega.toFixed(2)} em produtos.`,
          )
          return false
        }
        if (!bairro.trim()) {
          mostrarAlerta('aviso', 'Bairro obrigatório', 'Informe o bairro do endereço de entrega')
          return false
        }
        if (!enderecoEntrega.trim()) {
          mostrarAlerta('aviso', 'Endereço obrigatório', 'Informe o endereço da entrega')
          return false
        }
      }
      return true
    }

    if (etapa === 3) {
      if (!formaPagamento) {
        mostrarAlerta('aviso', 'Forma de pagamento', 'Selecione a forma de pagamento')
        return false
      }
      return true
    }

    return true
  }

  const avancarEtapa = () => {
    if (validarEtapa(etapaAtual)) {
      setEtapaAtual((prev) => Math.min(prev + 1, 3))
    }
  }

  const classificarItensCarrinho = async (): Promise<ItemCarrinhoCatalogado[]> => {
    const itensCarrinho = itens as ItemCarrinho[]
    const idsCatalogo = Array.from(
      new Set(
        itensCarrinho
          .map((item) => item.produto.id)
          .filter((id): id is string => Boolean(id))
      )
    )

    if (idsCatalogo.length === 0) {
      return itensCarrinho.map((item) => ({ item, tipoCatalogo: 'produto' }))
    }

    const [resProdutos, resBebidas, resCombos] = await Promise.all([
      supabase.from('produtos').select('id').in('id', idsCatalogo),
      supabase.from('bebidas').select('id').in('id', idsCatalogo),
      supabase.from('combos').select('id').in('id', idsCatalogo),
    ])

    if (resProdutos.error) throw resProdutos.error
    if (resBebidas.error) throw resBebidas.error
    if (resCombos.error) throw resCombos.error

    const idsProdutos = new Set((resProdutos.data || []).map((registro) => String((registro as { id: string }).id)))
    const idsBebidas = new Set((resBebidas.data || []).map((registro) => String((registro as { id: string }).id)))
    const idsCombos = new Set((resCombos.data || []).map((registro) => String((registro as { id: string }).id)))

    return itensCarrinho.map((item) => {
      const idItem = item.produto.id

      if (idItem && idsCombos.has(idItem)) {
        return { item, tipoCatalogo: 'combo' as const }
      }

      if (idItem && idsBebidas.has(idItem) && !idsProdutos.has(idItem)) {
        return { item, tipoCatalogo: 'bebida' as const }
      }

      return { item, tipoCatalogo: 'produto' as const }
    })
  }

  const voltarEtapa = () => {
    setEtapaAtual((prev) => Math.max(prev - 1, 1))
  }

  const iniciarPagamentoPixOnline = async (
    cupomConfirmado: CupomAplicadoCheckout | null,
    itensCatalogados: ItemCarrinhoCatalogado[]
  ) => {
    const totalComPossivelCupom = cupomConfirmado ? cupomConfirmado.totalComDesconto : totalSemDesconto
    const taxaPagamento = Number(calcularTaxaPagamento(totalComPossivelCupom).toFixed(2))
    const totalComTaxaPagamento = Number((totalComPossivelCupom + taxaPagamento).toFixed(2))
    const ehParceiroCarrinho = pontoLocalSelecionado?.tipo === 'local_externo'
    const nomeClientePedido = nomeClienteParaPedido({
      nomeCliente,
      tipoEntrega,
      localParceiro: ehParceiroCarrinho,
    })

    const payload = {
      nomeCliente: nomeClientePedido,
      telefone,
      tipoEntrega,
      cidadeId: tipoEntrega === 'entrega' ? bairroSelecionado?.id : undefined,
      cidade: tipoEntrega === 'entrega' ? bairroSelecionado?.nome : undefined,
      bairro: tipoEntrega === 'entrega' ? bairro.trim() : undefined,
      endereco: tipoEntrega === 'entrega' ? enderecoEntrega.trim() : undefined,
      pontoReferencia: tipoEntrega === 'entrega' ? pontoReferencia.trim() || undefined : undefined,
      mesaSelecionada: tipoEntrega === 'local' ? mesaSelecionada : undefined,
      pontoLocalId: tipoEntrega === 'local' ? pontoLocalSelecionado?.id || null : null,
      observacoes,
      subtotal: total,
      taxaEntrega,
      taxaPagamento,
      totalFinal: totalComTaxaPagamento,
      formaPagamentoCodigo: formaPagamentoSelecionada?.codigo || 'pix_online',
      formaPagamentoNome: formaPagamentoSelecionada?.nome || 'PIX Online',
      itens: itensCatalogados.map(({ item, tipoCatalogo }) => ({
        produto: {
          id: item.produto.id,
          nome: item.produto.nome,
          preco: item.produto.preco,
        },
        origemItem: tipoCatalogo,
        quantidade: item.quantidade,
        subtotal: item.subtotal,
        observacoes: item.observacoes,
        adicionais: item.adicionais.map((adicional) => ({
          id: adicional.id,
          nome: adicional.nome,
          preco: adicional.preco,
        })),
      })),
      cupom: cupomConfirmado
        ? {
            id: cupomConfirmado.id,
            codigo: cupomConfirmado.codigo,
            tipoDesconto: cupomConfirmado.tipoDesconto,
            valorDesconto: cupomConfirmado.valorDesconto,
            valorDescontoFrete: cupomConfirmado.valorDescontoFrete,
            totalComDesconto: cupomConfirmado.totalComDesconto,
          }
        : null,
    }

    const resposta = await fetch('/api/pagamentos/mercado-pago/criar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const corpo = await resposta.json()

    if (!resposta.ok || !corpo?.sucesso || !corpo?.pagamento) {
      throw new Error(corpo?.erro || 'Não foi possível iniciar o PIX online.')
    }

    const pagamento = corpo.pagamento as PagamentoPixOnline
    setPagamentoPixOnline(pagamento)
    salvarPagamentoPixPendente(pagamento)
    setModalPagamentoPixAberto(true)
  }

  const enviarPedido = async () => {
    if (!validarEtapa(3)) return
    if (tipoEntrega === 'entrega' && !dadosEntregaPreenchidos) {
      if (!validarEtapa(2)) setEtapaAtual(2)
      return
    }
    if (lojaFechada) {
      mostrarAlerta('aviso', 'Loja fechada', 'No momento não estamos aceitando pedidos online.')
      return
    }
    if (tipoEntrega === 'entrega' && !entregasOnlineAtivas) {
      mostrarAlerta('aviso', 'Entrega indisponível', 'No momento estamos aceitando apenas retirada.')
      setTipoEntrega('retirada')
      setBairroSelecionado(null)
      setBairro('')
      return
    }

    let cupomConfirmado: CupomAplicadoCheckout | null = cupomAplicado
    if (cupomAplicado) {
      setValidandoCupom(true)
      try {
        const resultadoRevalidacao = await validarCupomAtual(cupomAplicado.codigo)
        if (!resultadoRevalidacao.valido || !resultadoRevalidacao.cupom) {
          removerCupomAplicado({ silencioso: true })
          mostrarFeedbackCupom('aviso', 'Cupom inválido', resultadoRevalidacao.mensagem)
          return
        }

        cupomConfirmado = montarEstadoCupomAplicado(resultadoRevalidacao)
        setCupomAplicado(cupomConfirmado)
      } catch (erro) {
        console.error('[Cupom] Falha na revalidação do cupom:', erro)
        mostrarFeedbackCupom('erro', 'Erro no cupom', 'Não foi possível confirmar o cupom. Tente novamente.')
        return
      } finally {
        setValidandoCupom(false)
      }
    }

    setEnviando(true)

    let itensCatalogados: ItemCarrinhoCatalogado[] = []
    try {
      itensCatalogados = await classificarItensCarrinho()
    } catch (erroClassificacao) {
      console.error('[Checkout] Erro ao classificar itens do carrinho:', erroClassificacao)
      mostrarAlerta('erro', 'Erro ao enviar pedido', 'Não foi possível validar os itens do pedido. Tente novamente.')
      setEnviando(false)
      return
    }

    if (formaPagamentoSelecionada?.codigo === 'pix_online' && !modoSimulacao) {
      try {
        await iniciarPagamentoPixOnline(cupomConfirmado, itensCatalogados)
      } catch (error) {
        console.error('[Pagamento PIX Online] Erro ao iniciar pagamento:', error)
        mostrarAlerta(
          'erro',
          'Erro no pagamento',
          error instanceof Error ? error.message : 'Não foi possível iniciar o PIX online. Tente novamente.',
        )
      } finally {
        setEnviando(false)
      }
      return
    }

    // Se estiver em modo simulação, apenas finge o envio
    if (modoSimulacao) {
      const totalComPossivelCupom = cupomConfirmado ? cupomConfirmado.totalComDesconto : totalSemDesconto
      const taxaPagamentoConfirmada = Number(calcularTaxaPagamento(totalComPossivelCupom).toFixed(2))
      const totalComTaxaPagamentoConfirmado = Number((totalComPossivelCupom + taxaPagamentoConfirmada).toFixed(2))
      setTimeout(() => {
        const numeroAleatorio = Math.floor(Math.random() * 9000) + 1000
        setPedidoEnviado({
          id: 'simulacao-' + numeroAleatorio,
          numeroPedido: numeroAleatorio,
          nomeCliente,
          tipoEntrega,
          total: totalComTaxaPagamentoConfirmado,
          pagamentoOnlineAprovado: false,
          dataPrevistaEntrega,
        })
        limparCarrinho()
        removerCupomAplicado({ silencioso: true })
        setEnviando(false)
      }, 1500)
      return
    }

    let pedidoCriadoId: string | null = null
    let mesaFoiOcupada = false
    try {
      const valorTrocoPara = (formaPagamentoSelecionada?.aceita_troco && precisaTroco && trocoPara)
        ? parseFloat(trocoPara)
        : null
      const totalComPossivelCupom = cupomConfirmado ? cupomConfirmado.totalComDesconto : totalSemDesconto
      const taxaPagamentoConfirmada = Number(calcularTaxaPagamento(totalComPossivelCupom).toFixed(2))
      const totalComTaxaPagamentoConfirmado = Number((totalComPossivelCupom + taxaPagamentoConfirmada).toFixed(2))
      const descontoCupomAplicado = cupomConfirmado ? cupomConfirmado.valorDesconto : 0
      const descontoFreteAplicado = cupomConfirmado ? cupomConfirmado.valorDescontoFrete : 0
      const proximoNumeroPedido = await buscarProximoNumeroPedidoDiario(supabase)
      const ehParceiroCarrinho = pontoLocalSelecionado?.tipo === 'local_externo'
      const nomeClientePedido = nomeClienteParaPedido({
        nomeCliente,
        tipoEntrega,
        localParceiro: ehParceiroCarrinho,
      })
      const nomeClienteSalao = nomeClienteParaPontoSalao({
        nomeCliente,
        localParceiro: ehParceiroCarrinho,
      })
      const cliente = await registrarClientePedido({
        nome: nomeClientePedido,
        telefone,
        endereco: tipoEntrega === 'entrega' ? enderecoEntrega.trim() : null,
        bairro: tipoEntrega === 'entrega' ? bairro : null,
        cidade: tipoEntrega === 'entrega' ? bairroSelecionado?.nome || null : null,
      })

      // 1. Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero_pedido: proximoNumeroPedido,
          nome_cliente: nomeClientePedido,
          telefone: cliente.telefone,
          cliente_id: cliente.id,
          endereco: tipoEntrega === 'entrega' ? enderecoEntrega.trim() : null,
          bairro: tipoEntrega === 'entrega' ? bairro.trim() : null,
          cidade: tipoEntrega === 'entrega' ? bairroSelecionado?.nome || null : null,
          referencia: tipoEntrega === 'entrega' ? pontoReferencia.trim() || null : null,
          tipo_entrega: tipoEntrega,
          forma_pagamento: formaPagamentoSelecionada?.nome || formaPagamento,
          subtotal: total,
          taxa_entrega: taxaEntrega,
          taxa_pagamento: taxaPagamentoConfirmada,
          total: totalComTaxaPagamentoConfirmado,
          observacoes: observacoes || null,
          status: 'confirmado',
          troco_para: valorTrocoPara,
          mesa: tipoEntrega === 'local' ? mesaSelecionada : null,
          mesa_id: tipoEntrega === 'local' ? pontoLocalSelecionado?.id || null : null,
          cupom_id: cupomConfirmado ? cupomConfirmado.id : null,
          cupom_codigo: cupomConfirmado ? cupomConfirmado.codigo : null,
          tipo_desconto_cupom: cupomConfirmado ? cupomConfirmado.tipoDesconto : null,
          desconto_cupom: descontoCupomAplicado,
          desconto_frete: descontoFreteAplicado,
          data_prevista_entrega: tipoEntrega === 'entrega' ? dataPrevistaEntrega : null,
        })
        .select()
        .single()

      if (pedidoError) throw pedidoError
      pedidoCriadoId = pedido.id
      const numeroPedidoFinal = await sincronizarNumeroPedidoDiario(supabase, pedido).catch((erro) => {
        console.error('[Checkout] Falha ao sincronizar número diário do pedido:', erro)
        return normalizarNumeroPedido(pedido.numero_pedido)
      })

      // 2. Ocupar mesa somente apos criacao efetiva do pedido — locais parceiros nunca bloqueiam
      if (tipoEntrega === 'local' && mesaSelecionada && !ehParceiroCarrinho) {
        const agora = new Date()
        const liberarEm = calcularLiberacaoMesa(agora)

        let consultaOcuparPonto = supabase
          .from('mesas')
          .update({
            status: 'ocupada',
            nome_cliente: nomeClienteSalao,
            ocupada_em: agora.toISOString(),
            liberar_em: liberarEm.toISOString(),
            tempo_limite_minutos: TEMPO_PADRAO_MESA_MINUTOS,
            pedido_id: pedido.id,
          })
          .eq('status', 'livre')

        consultaOcuparPonto = pontoLocalSelecionado?.id
          ? consultaOcuparPonto.eq('id', pontoLocalSelecionado.id)
          : consultaOcuparPonto.eq('tipo', 'mesa').eq('numero', mesaSelecionada)

        const { data: mesasAtualizadas, error: mesaError } = await consultaOcuparPonto
          .select('id')

        if (mesaError) throw mesaError

        if (!mesasAtualizadas || mesasAtualizadas.length === 0) {
          throw new Error(`Mesa ${mesaSelecionada} acabou de ser ocupada. Escolha outra mesa.`)
        }

        mesaFoiOcupada = true
      }

      // 3. Inserir todos os itens em batch (otimizado)
      const itensParaInserir = itensCatalogados.map(({ item, tipoCatalogo }) => ({
        pedido_id: pedido.id,
        produto_id: tipoCatalogo === 'produto' ? (item.produto.id || null) : null,
        bebida_id: tipoCatalogo === 'bebida' ? (item.produto.id || null) : null,
        combo_id: tipoCatalogo === 'combo' ? (item.produto.id || null) : null,
        nome_item: item.produto.nome,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco,
        subtotal: item.subtotal,
        observacoes: item.observacoes || null,
      }))

      const { data: itensInseridos, error: itensError } = await supabase
        .from('itens_pedido')
        .insert(itensParaInserir)
        .select()

      if (itensError) throw itensError

      // 4. Inserir adicionais em batch (se houver)
      const adicionaisParaInserir: any[] = []
      itensCatalogados.forEach(({ item }, index) => {
        const itemInserido = itensInseridos?.[index]
        if (itemInserido && item.adicionais.length > 0) {
          item.adicionais.forEach(adicional => {
            adicionaisParaInserir.push({
              item_pedido_id: itemInserido.id,
              adicional_id: adicional.id,
              nome: adicional.nome,
              preco: adicional.preco,
            })
          })
        }
      })

      if (adicionaisParaInserir.length > 0) {
        const { error: adicionaisError } = await supabase.from('item_adicionais').insert(adicionaisParaInserir)
        if (adicionaisError) throw adicionaisError
      }

      // 5. Registra o uso do cupom após persistir os itens com sucesso
      if (cupomConfirmado) {
        const resultadoUsoCupom = await registrarUsoCupom({
          cupomId: cupomConfirmado.id,
          pedidoId: pedido.id,
          telefoneCliente: telefone,
          valorDesconto: cupomConfirmado.valorDesconto,
          valorDescontoFrete: cupomConfirmado.valorDescontoFrete,
        })

        if (!resultadoUsoCupom.sucesso) {
          throw new Error(resultadoUsoCupom.mensagem)
        }
      }

      // 6. Criar entrega (não bloqueante)
      if (tipoEntrega === 'entrega' && bairroSelecionado) {
        supabase.from('entregas').upsert({
          pedido_id: pedido.id,
          endereco_entrega: enderecoEntrega.trim(),
          bairro: bairro.trim(),
          cidade: bairroSelecionado.nome,
          taxa_entrega: taxaEntrega,
          data_prevista_entrega: dataPrevistaEntrega,
          status: 'pendente',
          observacoes: observacoes || null
        }, {
          onConflict: 'pedido_id',
          ignoreDuplicates: true
        }).then(({ error: erroEntrega }) => {
          if (erroEntrega) {
            console.error('[Entrega] Falha ao criar entrega:', erroEntrega.message)
          }
        })
      }

      // Salva dados do pedido enviado para mostrar tela de sucesso
      setPedidoEnviado({
        id: pedido.id,
        numeroPedido: numeroPedidoFinal ?? proximoNumeroPedido,
        nomeCliente: nomeClientePedido,
        tipoEntrega: tipoEntrega,
        total: totalComTaxaPagamentoConfirmado,
        mesa: mesaSelecionada || undefined,
        pagamentoOnlineAprovado: false,
        dataPrevistaEntrega,
      })

      // Salvar nome e telefone no localStorage para próximos pedidos
      try {
        localStorage.setItem(CHAVE_DADOS_CLIENTE, JSON.stringify({
          nome: nomeClienteParaPontoSalao({ nomeCliente, localParceiro: ehParceiroCarrinho }) || '',
          telefone: telefone.trim(),
        }))
      } catch {}

      // Limpa o carrinho e campos (mantém nome e telefone)
      limparCarrinho()
      setBairro('')
      setBairroSelecionado(null)
      setEnderecoEntrega('')
      setPontoReferencia('')
      setTipoEntrega('retirada')
      setMesaSelecionada(null)
      setPontoLocalSelecionado(null)
      setFormaPagamento('')
      setObservacoes('')
      setPrecisaTroco(false)
      setTrocoPara('')
      removerCupomAplicado({ silencioso: true })
      setEtapaAtual(1)
    } catch (error) {
      console.error('Erro ao enviar pedido:', error)
      if (pedidoCriadoId) {
        if (mesaFoiOcupada) {
          const { error: erroLiberarMesa } = await supabase
            .from('mesas')
            .update({
              status: 'livre',
              nome_cliente: null,
              ocupada_em: null,
              liberar_em: null,
              pedido_id: null,
            })
            .eq('pedido_id', pedidoCriadoId)

          if (erroLiberarMesa) {
            console.error('[Mesa] Falha ao liberar mesa após erro no checkout:', erroLiberarMesa)
          }
        }

        await removerUsoCupomPorPedido(pedidoCriadoId)
        const { error: erroExcluirPedido } = await supabase
          .from('pedidos')
          .delete()
          .eq('id', pedidoCriadoId)

        if (erroExcluirPedido) {
          console.error('[Pedido] Falha ao reverter pedido após erro:', erroExcluirPedido)
        }
      }
      const mensagemErro =
        error instanceof Error &&
        error.message &&
        error.message.toLowerCase().includes('mesa')
          ? error.message
          : 'Não foi possível enviar o pedido. Por favor, tente novamente.'

      mostrarAlerta('erro', 'Erro ao enviar', mensagemErro)
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  const descricaoStatusPagamentoPix: Record<StatusPagamentoOnline, string> = {
    nao_aplicavel: 'Sem pagamento online',
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pagamento aprovado',
    rejeitado: 'Pagamento rejeitado',
    cancelado: 'Pagamento cancelado',
    expirado: 'Pagamento expirado',
    em_analise: 'Pagamento em análise',
  }

  const classeStatusPagamentoPix: Record<StatusPagamentoOnline, string> = {
    nao_aplicavel: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    aguardando_pagamento: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    pago: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    rejeitado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    cancelado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    expirado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    em_analise: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  }

  const obterEstiloFeedbackCupom = (tipo: FeedbackCupom['tipo']) => {
    if (tipo === 'sucesso') {
      return {
        container: 'border-primary/30 bg-primary/10',
        titulo: 'text-foreground',
        texto: 'text-muted-foreground',
        icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      }
    }
    if (tipo === 'erro') {
      return {
        container: 'border-destructive/30 bg-destructive/10',
        titulo: 'text-destructive',
        texto: 'text-muted-foreground',
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
      }
    }
    if (tipo === 'aviso') {
      return {
        container: 'border-primary/30 bg-primary/10',
        titulo: 'text-foreground',
        texto: 'text-muted-foreground',
        icon: <AlertTriangle className="h-4 w-4 text-primary" />,
      }
    }
    return {
      container: 'border-primary/30 bg-primary/10',
      titulo: 'text-foreground',
      texto: 'text-muted-foreground',
      icon: <Info className="h-4 w-4 text-primary" />,
    }
  }

  const estiloFeedbackCupom = feedbackCupom ? obterEstiloFeedbackCupom(feedbackCupom.tipo) : null

  // Tela de Pedido Enviado com Sucesso
  if (pedidoEnviado) {
    return (
      <Drawer
        open={aberto}
        onOpenChange={(open) => {
          if (!open) onFechar()
        }}
      >
        <DrawerContent className="mx-auto h-auto max-h-[92dvh] w-full max-w-md overflow-hidden p-0">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
            {/* Ícone de sucesso animado */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-primary/10 rounded-full flex items-center justify-center shadow-lg shadow-primary/10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-full flex items-center justify-center animate-[scale_0.3s_ease-out] shadow-lg shadow-primary/30">
                  <Check className="w-10 h-10 sm:w-12 sm:h-12 text-primary-foreground" strokeWidth={3} />
                </div>
              </div>
            </div>

            {/* Título */}
            <DrawerTitle className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
              {pedidoEnviado.pagamentoOnlineAprovado ? 'Pagamento aprovado' : 'Pedido enviado'}
            </DrawerTitle>
            <DrawerDescription className="mb-4 text-center text-sm text-muted-foreground">
              {pedidoEnviado.pagamentoOnlineAprovado
                ? 'PIX Online confirmado em tempo real'
                : 'Recebemos seu pedido com sucesso'}
            </DrawerDescription>

            {pedidoEnviado.pagamentoOnlineAprovado && (
              <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Pedido aprovado automaticamente
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seu pedido já entrou no painel administrativo como pago online.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Número do pedido - Destaque */}
            <div className="text-center mb-6">
              <div className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-2xl shadow-lg shadow-primary/25">
                <span className="text-sm font-medium opacity-90">Seu número</span>
                <p className="text-3xl font-extrabold">#{pedidoEnviado.numeroPedido}</p>
              </div>
            </div>

            {/* Mensagem principal */}
            <div className="bg-muted/60 rounded-2xl p-4 sm:p-5 mb-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    Acompanhe pelo WhatsApp
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Você receberá atualizações sobre o status do seu pedido.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    {pedidoEnviado.tipoEntrega === 'entrega' ? (
                      <MapPin className="w-5 h-5 text-primary" />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-primary" />
                    )}
                  </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm sm:text-base">
                    {pedidoEnviado.tipoEntrega === 'entrega' 
                      ? 'Entrega programada'
                      : 'Retirada na loja'}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {pedidoEnviado.tipoEntrega === 'entrega'
                      ? pedidoEnviado.dataPrevistaEntrega
                        ? `Seu pedido tem entrega prevista para ${formatarDataPrevistaEntrega(pedidoEnviado.dataPrevistaEntrega)}.`
                        : 'Seu pedido será entregue no endereço informado.'
                      : 'Retire seu pedido quando estiver pronto.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tempo estimado e Total */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="mb-1 text-xs text-muted-foreground">
                  {pedidoEnviado.tipoEntrega === 'entrega' && pedidoEnviado.dataPrevistaEntrega
                    ? 'Previsão de entrega'
                    : 'Tempo estimado'}
                </p>
                <p className="text-sm font-bold leading-snug text-foreground sm:text-base">
                  {pedidoEnviado.tipoEntrega === 'entrega' && pedidoEnviado.dataPrevistaEntrega
                    ? formatarDataPrevistaEntrega(pedidoEnviado.dataPrevistaEntrega)
                    : `${pedidoEnviado.tipoEntrega === 'retirada' ? tempoRetiradaEstimado : tempoEntregaEstimado} min`}
                </p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-xs text-primary mb-1">Total</p>
                <p className="text-lg font-bold text-primary">
                  R$ {pedidoEnviado.total.toFixed(2)}
                </p>
              </div>
            </div>
            </div>
            <div className="shrink-0 border-t border-border bg-card/95 px-6 pt-4 [padding-bottom:max(env(safe-area-inset-bottom),1.5rem)] sm:px-8">
            {/* Botão de fechar */}
            <Button
              type="button"
              onClick={onFechar}
              className="h-12 w-full text-base font-semibold"
            >
              Entendi
            </Button>

            {/* Mensagem de agradecimento */}
            <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
              Obrigado por escolher a <span className="font-semibold text-primary">Fortes Fios</span>.
            </p>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <>
      <ModalAlerta
        aberto={alerta.aberto}
        tipo={alerta.tipo}
        titulo={alerta.titulo}
        mensagem={alerta.mensagem}
        onFechar={() => setAlerta({ ...alerta, aberto: false })}
      />
      <Drawer
        open={aberto}
        repositionInputs={false}
        onOpenChange={(open) => {
          if (!open) onFechar()
        }}
      >
        <DrawerContent
          className="mx-auto h-[92dvh] max-h-[92dvh] w-full max-w-2xl overflow-hidden p-0"
          style={
            ajusteTeclado
              ? {
                  height: `${ajusteTeclado.altura}px`,
                  maxHeight: `${ajusteTeclado.altura}px`,
                  bottom: `${ajusteTeclado.base}px`,
                }
              : undefined
          }
        >
          <DrawerTitle className="sr-only">Finalizar pedido</DrawerTitle>
          <DrawerDescription className="sr-only">
            Revise os itens, informe seus dados e escolha a forma de pagamento.
          </DrawerDescription>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Header com indicador de etapas */}
          <div className="border-b border-border/70 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground sm:text-xl">Seu pedido</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {etapaAtualConfig.titulo}: {textoPendenciaEtapa}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onFechar}
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressoCheckout}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2" aria-label="Etapas do pedido">
              {ETAPAS.map((etapa) => {
                const Icone = etapa.icone
                const ativo = etapaAtual === etapa.numero
                const completo = etapaAtual > etapa.numero

                return (
                  <button
                    key={etapa.numero}
                    type="button"
                    disabled={etapa.numero > etapaAtual + 1}
                    aria-current={ativo ? 'step' : undefined}
                    onClick={() => {
                      if (etapa.numero < etapaAtual) {
                        setEtapaAtual(etapa.numero)
                        return
                      }
                      if (etapa.numero === etapaAtual + 1 && validarEtapa(etapaAtual)) {
                        setEtapaAtual(etapa.numero)
                      }
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center justify-center gap-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      ativo
                        ? 'text-primary'
                        : completo
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        ativo
                          ? 'bg-primary text-primary-foreground'
                          : completo
                            ? 'bg-emerald-600 text-white'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {completo ? <Check className="h-4 w-4" /> : <Icone className="h-4 w-4" />}
                    </span>
                    <span className="truncate">{etapa.titulo}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conteúdo das etapas */}
          <div className="flex-1 overscroll-contain overflow-y-auto p-4">
            {/* Etapa 1: Carrinho */}
            {etapaAtual === 1 && (
              <div className="space-y-4">
                {itens.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-10 text-center">
                    <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">Seu carrinho está vazio</p>
                    <p className="mt-1 text-sm text-muted-foreground">Escolha um produto para iniciar o pedido.</p>
                  </div>
                ) : (
                  <>
                    {itens.map((item) => {
                      // Garante sempre um src válido para o next/image.
                      const urlImagemProduto =
                        typeof item.produto.imagem_url === 'string' && item.produto.imagem_url.trim().length > 0
                          ? item.produto.imagem_url
                          : '/placeholder-produto.svg'

                      return (
                        <div
                          key={item.id}
                          className="relative flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-card-foreground"
                        >
                          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                            <Image
                              src={urlImagemProduto}
                              alt={item.produto.nome}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="truncate text-sm font-semibold text-foreground">
                              {item.produto.nome}
                            </h4>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                                  className="h-10 w-10 rounded-r-none"
                                  aria-label={`Diminuir quantidade de ${item.produto.nome}`}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantidade}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                                  className="h-10 w-10 rounded-l-none"
                                  aria-label={`Aumentar quantidade de ${item.produto.nome}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                R$ {item.subtotal.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerItem(item.id)}
                            className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remover ${item.produto.nome}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )
                    })}


                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={limparCarrinho}
                      className="mx-auto flex text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Limpar carrinho
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Etapa 2: Dados do cliente */}
            {etapaAtual === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Escolha como vai receber o pedido. Os campos obrigatórios aparecem conforme a opção.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    placeholder="Seu nome completo"
                    className="input-campo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(86) 99999-9999"
                      className="input-campo pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Você receberá atualizações do pedido via WhatsApp
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Como deseja receber? *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setTipoEntrega('retirada'); setMesaSelecionada(null); setPontoLocalSelecionado(null) }}
                      className={cn(
                        'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs transition-colors sm:text-sm',
                        tipoEntrega === 'retirada'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/70 bg-card text-muted-foreground hover:border-border'
                      )}
                    >
                      <ShoppingBag className="w-5 h-5" />
                      Retirada
                      <span className="text-[11px] text-muted-foreground">
                        pronta em {tempoRetiradaEstimado} min
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!entregasOnlineAtivas}
                      onClick={() => {
                        if (!entregasOnlineAtivas) return
                        setTipoEntrega('entrega')
                        setMesaSelecionada(null)
                        setPontoLocalSelecionado(null)
                      }}
                      className={cn(
                        'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm',
                        tipoEntrega === 'entrega'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border/70 bg-card text-muted-foreground hover:border-border'
                      )}
                    >
                      <MapPin className="w-5 h-5" />
                      Entrega
                      <span className="text-[11px] text-muted-foreground">
                        estimada em {tempoEntregaEstimado} min
                      </span>
                      {!entregasOnlineAtivas && (
                        <span className="text-[10px] font-medium text-red-600 dark:text-red-400">indisponível</span>
                      )}
                    </button>
                  </div>
                </div>

                {tipoEntrega === 'entrega' && (
                  <div className="space-y-3">
                    {!entregasOnlineAtivas && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">
                        Entrega desligada no momento. Escolha retirada para continuar.
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cidade *
                      </label>
                      <Button
                        type="button"
                        onClick={() => setMostrarSeletorBairro(true)}
                        variant="outline"
                        aria-haspopup="dialog"
                        aria-expanded={mostrarSeletorBairro}
                        className={cn(
                          'h-auto min-h-14 w-full justify-between border-primary/40 px-4 py-3 text-left hover:border-primary hover:bg-primary/10',
                          bairroSelecionado ? 'bg-card' : 'bg-primary/5 text-primary',
                        )}
                      >
                        <span className={cn('flex min-w-0 items-center gap-2', bairroSelecionado ? 'text-foreground' : 'text-primary')}>
                          <MapPin className="size-5 shrink-0" aria-hidden />
                          {bairroSelecionado ? (
                            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              {bairroSelecionado.nome}
                              <span className="text-sm font-medium text-primary">
                                {bairroSelecionado.entrega_gratis ? '(Grátis!)' : `(R$ ${bairroSelecionado.taxa_entrega.toFixed(2)})`}
                              </span>
                            </span>
                          ) : (
                            <span className="font-semibold">Selecionar cidade de entrega</span>
                          )}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-primary" />
                      </Button>
                      {!carregandoBairros && bairros.length === 0 && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300">
                          Nenhuma cidade disponível agora. Use retirada para continuar.
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor="checkout-bairro" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Bairro *
                      </label>
                      <input
                        id="checkout-bairro"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        placeholder="Ex.: Centro"
                        className="input-campo"
                        autoComplete="address-level3"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Endereço *
                      </label>
                      <input
                        value={enderecoEntrega}
                        onChange={(e) => setEnderecoEntrega(e.target.value)}
                        placeholder="Rua, número e complemento"
                        className="input-campo"
                        autoComplete="street-address"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ponto de referência <span className="font-normal text-gray-500">(opcional)</span>
                      </label>
                      <input
                        value={pontoReferencia}
                        onChange={(e) => setPontoReferencia(e.target.value)}
                        placeholder="Ex.: Próximo ao mercado"
                        className="input-campo"
                      />
                    </div>
                    {bairroSelecionado && (
                      <div className={`space-y-2 rounded-lg border p-3 ${
                        bairroSelecionado.entrega_gratis
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-sm ${bairroSelecionado.entrega_gratis ? 'text-emerald-700 dark:text-emerald-400' : 'text-green-700 dark:text-green-400'}`}>Taxa de entrega</span>
                          <span className={`font-bold ${bairroSelecionado.entrega_gratis ? 'text-emerald-700 dark:text-emerald-400' : 'text-green-700 dark:text-green-400'}`}>
                            {bairroSelecionado.entrega_gratis ? 'GRÁTIS!' : `R$ ${bairroSelecionado.taxa_entrega.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-current/10 pt-2 text-sm text-foreground">
                          <span>Compra mínima</span>
                          <span className="font-semibold">R$ {valorMinimoEntrega.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-current/10 pt-2 text-sm text-foreground">
                          <p className="font-medium">{textoAgendaEntrega}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Próxima entrega: {textoDataPrevistaEntrega}
                          </p>
                        </div>
                        {!atingiuMinimoEntrega && (
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            Adicione mais R$ {faltaParaMinimoEntrega.toFixed(2)} em produtos para receber nesta cidade.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Alguma observação sobre o pedido?"
                    rows={2}
                    className="input-campo resize-none"
                  />
                </div>
              </div>
            )}

            {/* Etapa 3: Pagamento */}
            {etapaAtual === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Forma de pagamento *
                    </label>
                    {usandoFallbackPagamentos && (
                      <Badge variant="outline" className="text-[11px]">
                        opções padrão
                      </Badge>
                    )}
                  </div>
                  {usandoFallbackPagamentos && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-300">
                      As formas cadastradas não carregaram. Mantivemos as opções básicas para não travar o pedido.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {formasPagamentoDisponiveis.map((opcao) => {
                      const ativo = formaPagamento === opcao.codigo
                      const valorTaxa = Number(opcao.valor_taxa || 0)
                      const descricaoTaxa =
                        opcao.tipo_taxa === 'percentual' && valorTaxa > 0
                          ? `Taxa de ${valorTaxa.toFixed(2).replace('.', ',')}%`
                          : opcao.tipo_taxa === 'fixa' && valorTaxa > 0
                            ? `Taxa fixa de R$ ${valorTaxa.toFixed(2)}`
                            : null

                      const icone = opcao.codigo.includes('pix') ? QrCode
                        : opcao.codigo.includes('dinheiro') ? Banknote
                        : opcao.codigo.includes('credito') || opcao.codigo.includes('debito') ? CreditCard
                        : Wallet

                      const IconeComponente = icone

                      return (
                        <button
                          key={opcao.id}
                          type="button"
                          onClick={() => {
                            setFormaPagamento(opcao.codigo)
                            if (!opcao.aceita_troco) {
                              setPrecisaTroco(false)
                              setTrocoPara('')
                            }
                          }}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            ativo
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                              : 'border-border/70 bg-card hover:border-border'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            ativo
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <IconeComponente className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {opcao.nome}
                            </p>
                            {(opcao.descricao || descricaoTaxa) && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {opcao.descricao || descricaoTaxa}
                              </p>
                            )}
                          </div>
                          {ativo && (
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {formaPagamentoSelecionada?.codigo === 'pix_online' && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                      O pedido será aprovado automaticamente após a confirmação do PIX Online.
                    </div>
                  )}
                </div>

                {formaPagamentoSelecionada?.aceita_troco && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={precisaTroco}
                        onChange={(e) => {
                          setPrecisaTroco(e.target.checked)
                          if (!e.target.checked) setTrocoPara('')
                        }}
                        className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">
                        Preciso de troco
                      </span>
                    </label>

                    {precisaTroco && (
                      <div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-medium">
                            R$
                          </span>
                          <input
                            type="number"
                            value={trocoPara}
                            onChange={(e) => setTrocoPara(e.target.value)}
                            placeholder="0,00"
                            min={totalFinalComTaxaPagamento}
                            step="0.01"
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-green-300 dark:border-green-700 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[20, 50, 100, 200].map((valor) => (
                            <button
                              key={valor}
                              type="button"
                              onClick={() => setTrocoPara(valor.toString())}
                              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${trocoPara === valor.toString()
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white dark:bg-gray-800 text-green-700 border border-green-300 hover:bg-green-100'
                                }`}
                            >
                              R$ {valor}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cupom de desconto */}
                <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground break-words">
                      Cupom de desconto
                    </label>
                    {cupomAplicado && (
                      <button
                        type="button"
                        onClick={() => removerCupomAplicado()}
                        className="text-xs font-medium text-destructive hover:text-destructive/80"
                      >
                        Remover cupom
                      </button>
                    )}
                  </div>

                  {!cupomAplicado ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={codigoCupom}
                        onChange={(evento) => setCodigoCupom(evento.target.value.toUpperCase())}
                        placeholder="Digite seu cupom"
                        className="min-w-0 w-full sm:flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      />
                      <button
                        type="button"
                        onClick={aplicarCupom}
                        disabled={validandoCupom || !codigoCupom.trim()}
                        className="w-full sm:w-auto sm:shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90"
                      >
                        {validandoCupom ? 'Validando...' : 'Aplicar'}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-background border border-primary/30 px-3 py-2">
                      <p className="text-sm font-semibold text-primary">
                        {cupomAplicado.codigo} aplicado
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cupomAplicado.nome}
                      </p>
                    </div>
                  )}

                  {feedbackCupom && estiloFeedbackCupom && (
                    <div className={`rounded-lg border p-3 shadow-sm ${estiloFeedbackCupom.container}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {estiloFeedbackCupom.icon}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold leading-tight ${estiloFeedbackCupom.titulo}`}>
                            {feedbackCupom.titulo}
                          </p>
                          <p className={`mt-1 text-xs leading-relaxed break-words ${estiloFeedbackCupom.texto}`}>
                            {feedbackCupom.mensagem}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumo do pedido */}
                <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4 text-card-foreground">
                  <h4 className="mb-3 font-semibold text-foreground">Resumo</h4>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</span>
                    <span className="font-medium">R$ {total.toFixed(2)}</span>
                  </div>

                  {tipoEntrega === 'entrega' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de entrega</span>
                      <span className={`font-medium ${bairroSelecionado?.entrega_gratis ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {bairroSelecionado?.entrega_gratis ? 'GRÁTIS!' : `R$ ${taxaEntrega.toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  {cupomAplicado && cupomAplicado.valorDesconto > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Desconto cupom</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        - R$ {cupomAplicado.valorDesconto.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {cupomAplicado && cupomAplicado.valorDescontoFrete > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete grátis</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        - R$ {cupomAplicado.valorDescontoFrete.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {taxaPagamentoAtual > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de pagamento</span>
                      <span className="font-medium">R$ {taxaPagamentoAtual.toFixed(2)}</span>
                    </div>
                  )}

                  <Separator className="my-2" />
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-lg font-semibold text-foreground">
                      R$ {totalFinalComTaxaPagamento.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer com botões de navegação */}
          <div className="shrink-0 border-t border-border/70 bg-card/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-8px_24px_-18px_hsl(var(--foreground)/0.45)] backdrop-blur">
            {lojaFechada && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                A loja está fechada no momento. Navegação liberada, mas pedidos online indisponíveis.
              </div>
            )}
            {/* Resumo do total em todas as etapas */}
            {etapaAtual < 3 && itens.length > 0 && (
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-sm text-muted-foreground">
                  {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
                </span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  R$ {totalFinal.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              {etapaAtual > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={voltarEtapa}
                  className="h-12 flex-1 gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Voltar
                </Button>
              )}

              {etapaAtual < 3 ? (
                <Button
                  type="button"
                  onClick={avancarEtapa}
                  disabled={itens.length === 0}
                  className="h-12 flex-1 justify-between gap-2 px-4"
                >
                  <span>Continuar</span>
                  <span className="flex items-center gap-2">
                    {etapaAtual === 1 && itens.length > 0 && (
                      <span className="tabular-nums">R$ {totalFinal.toFixed(2)}</span>
                    )}
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={enviarPedido}
                  disabled={enviando || !formaPagamento || lojaFechada}
                  className="h-12 flex-1 gap-2"
                >
                  {lojaFechada ? (
                    <>
                      <X className="w-5 h-5" />
                      Loja fechada
                    </>
                  ) : enviando ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Enviar Pedido
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          </div>
          {/* Seletor de cidades — precisa viver dentro da árvore do Drawer:
              como irmão, o focus trap do Vaul/Radix mata clique e scroll dele. */}
          <DrawerNested
            open={mostrarSeletorBairro}
            onOpenChange={(open) => {
              if (!open) setMostrarSeletorBairro(false)
            }}
          >
            <DrawerContent className="mx-auto max-h-[85dvh] w-full max-w-md overflow-hidden border-primary/30 bg-background p-0">
              <div className="flex shrink-0 items-center justify-between bg-primary px-4 pb-4 pt-3 text-primary-foreground">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <DrawerTitle className="text-lg font-semibold text-primary-foreground">
                      Onde será a entrega?
                    </DrawerTitle>
                    <p className="mt-1 text-xs text-primary-foreground/80">
                      Taxa, valor mínimo e próximo dia variam por cidade.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarSeletorBairro(false)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                  aria-label="Fechar seleção de cidade"
                >
                  <X className="size-5" />
                </button>
              </div>
              <DrawerDescription className="sr-only">
                Escolha a cidade para consultar a taxa e a compra mínima.
              </DrawerDescription>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {carregandoBairros ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="w-8 h-8 border-2 border-bordo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Carregando cidades...
                </div>
              ) : bairros.length === 0 ? (
                <div className="space-y-4 p-8 text-center text-muted-foreground">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <div>
                    <p className="font-medium text-foreground">Nenhuma cidade disponível</p>
                    <p className="mt-1 text-sm">Escolha retirada para continuar o pedido.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTipoEntrega('retirada')
                        setBairroSelecionado(null)
                        setBairro('')
                        setMesaSelecionada(null)
                        setPontoLocalSelecionado(null)
                        setMostrarSeletorBairro(false)
                      }}
                    >
                      Retirada
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {bairros.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      aria-pressed={bairroSelecionado?.id === b.id}
                      onClick={() => {
                        setBairroSelecionado(b)
                        setMostrarSeletorBairro(false)
                      }}
                      className={cn(
                        'flex min-h-20 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        bairroSelecionado?.id === b.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/70 bg-card hover:border-primary/40 hover:bg-accent/50',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg',
                          bairroSelecionado?.id === b.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                        >
                          <MapPin className="size-5" />
                        </div>
                        <span className="min-w-0 font-medium text-foreground">
                          <span className="block">{b.nome}</span>
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {descreverAgendaEntrega(b.dias_entrega)}
                          </span>
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                          b.entrega_gratis
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        }`}>
                          <span className="block">{b.entrega_gratis ? 'Grátis!' : `R$ ${b.taxa_entrega.toFixed(2)}`}</span>
                          <span className="block text-[11px] opacity-80">mín. R$ {b.valor_minimo_pedido.toFixed(2)}</span>
                        </span>
                        {bairroSelecionado?.id === b.id && (
                          <Check className="size-5 text-primary" aria-hidden />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </div>
            </DrawerContent>
          </DrawerNested>
        </DrawerContent>
      </Drawer>

      {modalPagamentoPixAberto && pagamentoPixOnline && (
        <div className={`${modoSimulacao ? 'absolute' : 'fixed'} inset-0 z-[1100] bg-black/65 p-4 sm:p-6`}>
          <div className="mx-auto flex h-full w-full max-w-md items-center justify-center">
            <div className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pagamento PIX</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Pedido #{pagamentoPixOnline.numeroPedido}</p>
                </div>
                <button
                  type="button"
                  onClick={fecharModalPagamentoPix}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Fechar modal de pagamento"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-300">Status</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classeStatusPagamentoPix[pagamentoPixOnline.status]}`}>
                    {descricaoStatusPagamentoPix[pagamentoPixOnline.status]}
                  </span>
                </div>

                {(pagamentoPixOnline.status === 'aguardando_pagamento' || pagamentoPixOnline.status === 'em_analise') &&
                  textoTempoRestantePagamentoPix && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                      Tempo restante para pagamento: {textoTempoRestantePagamentoPix}
                    </div>
                  )}

                {pagamentoPixOnline.status === 'pago' && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Pagamento confirmado. Pedido atualizado em tempo real no admin.
                  </div>
                )}

                {(pagamentoPixOnline.status === 'expirado' || pagamentoPixOnline.status === 'cancelado') && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    Tempo de pagamento encerrado. O pedido foi cancelado automaticamente.
                  </div>
                )}

                {pagamentoPixOnline.qrCodeBase64 && (
                  <div className="flex justify-center rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                    <img
                      src={`data:image/png;base64,${pagamentoPixOnline.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="h-52 w-52 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                    />
                  </div>
                )}

                {pagamentoPixOnline.qrCode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-300">PIX Copia e Cola</span>
                      <button
                        type="button"
                        onClick={copiarCodigoPix}
                        disabled={copiandoCodigoPix}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {copiandoCodigoPix ? 'Copiando...' : 'Copiar'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={pagamentoPixOnline.qrCode}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-zinc-300 bg-zinc-50 p-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => consultarStatusPagamentoPix(true)}
                    disabled={sincronizandoPagamentoPix}
                    className="rounded-xl bg-bordo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-bordo-800 disabled:opacity-60"
                  >
                    {sincronizandoPagamentoPix ? 'Atualizando...' : 'Atualizar status'}
                  </button>

                  {pagamentoPixOnline.qrCodeTicketUrl ? (
                    <a
                      href={pagamentoPixOnline.qrCodeTicketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Abrir app do banco
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={fecharModalPagamentoPix}
                      className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
