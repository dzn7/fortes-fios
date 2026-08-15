'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Loader2,
  Minus,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalItemPedidoAdmin, { ItemPedidoModalDadosAdmin } from '@/components/admin/pedidos/novo/ModalItemPedidoAdmin'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { buscarProximoNumeroPedidoDiario, normalizarNumeroPedido, sincronizarNumeroPedidoDiario } from '@/lib/pedidos/numero-diario'
import { registrarClientePedido } from '@/lib/registrar-cliente-pedido'
import { cn } from '@/lib/utils'
import { avaliarCompraProduto, produtoBloqueadoPorEstoque } from '@/lib/estoque-produto.mjs'

type Produto = {
  id: string
  nome: string
  preco: number
  categoria: string | null
  descricao: string | null
  disponivel: boolean
  estoque_quantidade: number
  estoque_minimo: number
  bloquear_venda_sem_estoque: boolean
}

type ItemPedido = Produto & {
  linhaId: string
  quantidade: number
  observacoes: string
  descontoManualInput: string
}

type FormaPagamento = {
  id: string
  codigo: string
  nome: string
  ordem: number
}

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  entrega_gratis: boolean
  valor_minimo_pedido: number
}

type ClienteEncontrado = {
  id: string
  nome: string | null
  telefone: string
  endereco: string | null
  bairro: string | null
  cidade: string | null
}

type TipoEntrega = 'retirada' | 'entrega'
type PersonalizacaoAberta = { produto: Produto; linhaId?: string }
type OrigemCatalogo = 'desktop' | 'mobile'

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

const paraNumeroSeguro = (valor: string) => {
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) && numero > 0 ? numero : 0
}

const arredondarMoeda = (valor: number) => Number(valor.toFixed(2))

const calcularDescontoItem = (item: ItemPedido) => {
  const subtotalBrutoItem = item.preco * item.quantidade
  return arredondarMoeda(Math.min(subtotalBrutoItem, paraNumeroSeguro(item.descontoManualInput)))
}

const calcularSubtotalItem = (item: ItemPedido) =>
  arredondarMoeda(Math.max(0, item.preco * item.quantidade - calcularDescontoItem(item)))

const criarLinhaId = () => crypto.randomUUID()

const criarItemPedido = (
  produto: Produto,
  personalizado: Pick<ItemPedido, 'quantidade' | 'observacoes' | 'descontoManualInput'>,
): ItemPedido => ({
  ...produto,
  linhaId: criarLinhaId(),
  ...personalizado,
})

const normalizarTexto = (valor: string | null | undefined) =>
  (valor || '').trim().toLocaleLowerCase('pt-BR')

function NovoPedidoLoja() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true)
  const [catalogoAberto, setCatalogoAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos')
  const [salvando, setSalvando] = useState(false)
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefone, setTelefone] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEncontrado | null>(null)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteEncontrado[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [erroBuscaClientes, setErroBuscaClientes] = useState(false)
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('retirada')
  const [bairroId, setBairroId] = useState('')
  const [bairroEndereco, setBairroEndereco] = useState('')
  const [endereco, setEndereco] = useState('')
  const [referencia, setReferencia] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [personalizacaoAberta, setPersonalizacaoAberta] = useState<PersonalizacaoAberta | null>(null)
  const [personalizacaoPendente, setPersonalizacaoPendente] = useState<PersonalizacaoAberta | null>(null)

  useEffect(() => {
    let ativo = true

    const carregarDados = async () => {
      const [produtosResposta, bairrosResposta, pagamentosResposta] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, preco, categoria, descricao, disponivel, estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque')
          .eq('disponivel', true)
          .order('nome'),
        supabase
          .from('bairros')
          .select('id, nome, taxa_entrega, entrega_gratis, valor_minimo_pedido')
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('formas_pagamento')
          .select('id, codigo, nome, ordem')
          .eq('ativo', true)
          .eq('visivel_cliente', true)
          .order('ordem'),
      ])

      if (!ativo) return
      if (produtosResposta.error || bairrosResposta.error || pagamentosResposta.error) {
        toast.error('Não foi possível carregar os dados da venda.')
      }

      const pagamentos = (pagamentosResposta.data || []) as FormaPagamento[]
      setProdutos((produtosResposta.data || []) as Produto[])
      setBairros(
        (bairrosResposta.data || []).map((cidade) => ({
          id: String(cidade.id),
          nome: String(cidade.nome),
          taxa_entrega: Number(cidade.taxa_entrega || 0),
          entrega_gratis: Boolean(cidade.entrega_gratis),
          valor_minimo_pedido: Number(cidade.valor_minimo_pedido || 0),
        })),
      )
      setFormasPagamento(pagamentos)
      setFormaPagamento((atual) => atual || pagamentos[0]?.codigo || '')
      setCarregandoCatalogo(false)
    }

    void carregarDados()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    if (catalogoAberto || !personalizacaoPendente) return

    const timer = window.setTimeout(() => {
      setPersonalizacaoAberta(personalizacaoPendente)
      setPersonalizacaoPendente(null)
    }, 180)

    return () => window.clearTimeout(timer)
  }, [catalogoAberto, personalizacaoPendente])

  useEffect(() => {
    const termo = nomeCliente.trim()
    if (clienteSelecionado && normalizarTexto(clienteSelecionado.nome) === normalizarTexto(termo)) {
      setClientesEncontrados([])
      setBuscandoClientes(false)
      setErroBuscaClientes(false)
      return
    }
    if (termo.length < 2) {
      setClientesEncontrados([])
      setBuscandoClientes(false)
      setErroBuscaClientes(false)
      return
    }

    let ativo = true
    const timer = window.setTimeout(async () => {
      setBuscandoClientes(true)
      setErroBuscaClientes(false)
      try {
        const { data, error } = await supabase
          .from('usuarios_cliente')
          .select('id, nome, telefone, endereco, bairro, cidade')
          .ilike('nome', `%${termo}%`)
          .order('updated_at', { ascending: false })
          .limit(5)

        if (error) throw error
        if (ativo) setClientesEncontrados((data || []) as ClienteEncontrado[])
      } catch {
        if (ativo) {
          setClientesEncontrados([])
          setErroBuscaClientes(true)
        }
      } finally {
        if (ativo) setBuscandoClientes(false)
      }
    }, 260)

    return () => {
      ativo = false
      window.clearTimeout(timer)
    }
  }, [clienteSelecionado, nomeCliente])

  const categorias = useMemo(
    () => Array.from(new Set(produtos.map((produto) => produto.categoria?.trim()).filter(Boolean))) as string[],
    [produtos],
  )

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos.filter((produto) => {
      const correspondeCategoria = categoriaAtiva === 'todos' || produto.categoria === categoriaAtiva
      const correspondeBusca = !termo || [produto.nome, produto.categoria, produto.descricao]
        .filter(Boolean)
        .some((campo) => campo?.toLocaleLowerCase('pt-BR').includes(termo))
      return correspondeCategoria && correspondeBusca
    })
  }, [busca, categoriaAtiva, produtos])

  const bairroSelecionado = useMemo(
    () => bairros.find((bairro) => bairro.id === bairroId) || null,
    [bairroId, bairros],
  )

  const itemEmPersonalizacao = useMemo<ItemPedidoModalDadosAdmin | null>(() => {
    if (!personalizacaoAberta) return null

    const itemExistente = personalizacaoAberta.linhaId
      ? itens.find((item) => item.linhaId === personalizacaoAberta.linhaId)
      : null

    if (itemExistente) return itemExistente

    return {
      ...personalizacaoAberta.produto,
      quantidade: 1,
      observacoes: '',
      descontoManualInput: '',
    }
  }, [itens, personalizacaoAberta])

  const subtotalBruto = useMemo(
    () => arredondarMoeda(itens.reduce((total, item) => total + item.preco * item.quantidade, 0)),
    [itens],
  )
  const descontoItensTotal = useMemo(
    () => arredondarMoeda(itens.reduce((total, item) => total + calcularDescontoItem(item), 0)),
    [itens],
  )
  const subtotal = useMemo(
    () => arredondarMoeda(Math.max(0, subtotalBruto - descontoItensTotal)),
    [subtotalBruto, descontoItensTotal],
  )
  const quantidadeItens = useMemo(
    () => itens.reduce((total, item) => total + item.quantidade, 0),
    [itens],
  )
  const taxaEntrega = tipoEntrega === 'entrega' ? Number(bairroSelecionado?.taxa_entrega || 0) : 0
  const valorMinimoEntrega = Number(bairroSelecionado?.valor_minimo_pedido || 0)
  const atingiuMinimoEntrega = subtotal >= valorMinimoEntrega
  const total = arredondarMoeda(subtotal + taxaEntrega)

  const adicionarProduto = (produto: Produto) => {
    const quantidadeAtual = itens
      .filter((item) => item.id === produto.id)
      .reduce((total, item) => total + item.quantidade, 0)
    const avaliacao = avaliarCompraProduto(produto, quantidadeAtual, 1)
    if (!avaliacao.permitido) {
      toast.warning(avaliacao.motivo || 'Produto indisponível')
      return
    }
    setItens((itensAtuais) => {
      const itemExistente = itensAtuais.find((item) => (
        item.id === produto.id
        && !item.observacoes
        && paraNumeroSeguro(item.descontoManualInput) === 0
      ))
      if (!itemExistente) {
        return [...itensAtuais, criarItemPedido(produto, {
          quantidade: 1,
          observacoes: '',
          descontoManualInput: '',
        })]
      }
      return itensAtuais.map((item) => item.linhaId === itemExistente.linhaId
        ? { ...item, quantidade: item.quantidade + 1 }
        : item)
    })
  }

  const alterarQuantidade = (linhaId: string, variacao: number) => {
    const itemAtual = itens.find((item) => item.linhaId === linhaId)
    if (itemAtual && variacao > 0) {
      const quantidadeAtual = itens
        .filter((item) => item.id === itemAtual.id)
        .reduce((total, item) => total + item.quantidade, 0)
      const avaliacao = avaliarCompraProduto(itemAtual, quantidadeAtual, variacao)
      if (!avaliacao.permitido) {
        toast.warning(avaliacao.motivo || 'Quantidade indisponível')
        return
      }
    }
    setItens((itensAtuais) => itensAtuais.flatMap((item) => {
      if (item.linhaId !== linhaId) return [item]
      const quantidade = item.quantidade + variacao
      return quantidade > 0 ? [{ ...item, quantidade }] : []
    }))
  }

  const abrirPersonalizacao = (produto: Produto, origem: OrigemCatalogo, linhaId?: string) => {
    const proximaPersonalizacao = { produto, linhaId }

    if (origem === 'mobile' && catalogoAberto) {
      setPersonalizacaoPendente(proximaPersonalizacao)
      setCatalogoAberto(false)
      return
    }

    setPersonalizacaoAberta(proximaPersonalizacao)
  }

  const selecionarCliente = (cliente: ClienteEncontrado) => {
    setClienteSelecionado(cliente)
    setNomeCliente(cliente.nome || '')
    setTelefone(cliente.telefone || '')
    if (cliente.endereco) setEndereco(cliente.endereco)
    if (cliente.bairro) setBairroEndereco(cliente.bairro)

    if (cliente.cidade) {
      const cidadeCorrespondente = bairros.find((cidade) => normalizarTexto(cidade.nome) === normalizarTexto(cliente.cidade))
      if (cidadeCorrespondente) setBairroId(cidadeCorrespondente.id)
    }

    setClientesEncontrados([])
    setErroBuscaClientes(false)
  }

  const alterarNomeCliente = (valor: string) => {
    setNomeCliente(valor)
    if (clienteSelecionado && normalizarTexto(valor) !== normalizarTexto(clienteSelecionado.nome)) {
      setClienteSelecionado(null)
    }
  }

  const alterarTelefoneCliente = (valor: string) => {
    setTelefone(valor)
    if (clienteSelecionado && valor.replace(/\D/g, '') !== clienteSelecionado.telefone.replace(/\D/g, '')) {
      setClienteSelecionado(null)
    }
  }

  const confirmarPersonalizacao = (atualizado: {
    quantidade: number
    observacoes: string
    descontoManualInput: string
  }) => {
    if (!personalizacaoAberta) return

    const quantidadeOutrasLinhas = itens
      .filter((item) => item.id === personalizacaoAberta.produto.id && item.linhaId !== personalizacaoAberta.linhaId)
      .reduce((total, item) => total + item.quantidade, 0)
    const avaliacao = avaliarCompraProduto(
      personalizacaoAberta.produto,
      quantidadeOutrasLinhas,
      atualizado.quantidade,
    )
    if (!avaliacao.permitido) {
      toast.warning(avaliacao.motivo || 'Quantidade indisponível')
      return
    }

    if (personalizacaoAberta.linhaId) {
      setItens((itensAtuais) => itensAtuais.map((item) => item.linhaId === personalizacaoAberta.linhaId
        ? { ...item, ...atualizado }
        : item))
    } else {
      setItens((itensAtuais) => [...itensAtuais, criarItemPedido(personalizacaoAberta.produto, atualizado)])
    }

    toast.success('Produto personalizado no pedido.')
    setPersonalizacaoAberta(null)
  }

  const limparPedido = () => {
    setItens([])
    setNomeCliente('')
    setTelefone('')
    setClienteSelecionado(null)
    setClientesEncontrados([])
    setErroBuscaClientes(false)
    setTipoEntrega('retirada')
    setBairroId('')
    setBairroEndereco('')
    setEndereco('')
    setReferencia('')
    setObservacoes('')
  }

  const criarPedido = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (itens.length === 0) {
      toast.error('Adicione ao menos um produto.')
      setCatalogoAberto(true)
      return
    }
    if (!nomeCliente.trim() || !telefone.trim()) {
      toast.error('Informe nome e telefone do cliente.')
      return
    }
    if (tipoEntrega === 'entrega' && (!bairroSelecionado || !bairroEndereco.trim() || !endereco.trim())) {
      toast.error('Informe a cidade, o bairro e o endereço de entrega.')
      return
    }
    if (tipoEntrega === 'entrega' && !atingiuMinimoEntrega) {
      toast.error(`A compra mínima para ${bairroSelecionado?.nome} é ${formatarMoeda(valorMinimoEntrega)}.`)
      return
    }
    if (!formaPagamento) {
      toast.error('Selecione a forma de pagamento.')
      return
    }

    let pedidoCriadoId: string | null = null
    setSalvando(true)
    try {
      const numeroPedido = await buscarProximoNumeroPedidoDiario(supabase)
      const cliente = await registrarClientePedido({
        nome: nomeCliente,
        telefone,
        endereco: tipoEntrega === 'entrega' ? endereco : null,
        bairro: tipoEntrega === 'entrega' ? bairroEndereco : null,
        cidade: tipoEntrega === 'entrega' ? bairroSelecionado?.nome || null : null,
      })
      const pagamento = formasPagamento.find((forma) => forma.codigo === formaPagamento)
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero_pedido: numeroPedido,
          nome_cliente: nomeCliente.trim(),
          telefone: cliente.telefone,
          cliente_id: cliente.id,
          endereco: tipoEntrega === 'entrega' ? endereco.trim() : null,
          bairro: tipoEntrega === 'entrega' ? bairroEndereco.trim() : null,
          cidade: tipoEntrega === 'entrega' ? bairroSelecionado?.nome || null : null,
          referencia: tipoEntrega === 'entrega' ? referencia.trim() || null : null,
          tipo_entrega: tipoEntrega,
          forma_pagamento: pagamento?.nome || formaPagamento,
          subtotal_original: subtotalBruto,
          subtotal,
          desconto_itens_total: descontoItensTotal,
          desconto_manual: 0,
          desconto_cupom: 0,
          desconto_frete: 0,
          taxa_entrega: taxaEntrega,
          taxa_pagamento: 0,
          total_original: subtotalBruto + taxaEntrega,
          total,
          observacoes: observacoes.trim() || null,
          status: 'pendente',
        })
        .select('id, numero_pedido, created_at')
        .single()
      if (pedidoError) throw pedidoError
      pedidoCriadoId = pedido.id

      const { error: itensError } = await supabase.from('itens_pedido').insert(
        itens.map((item) => ({
          pedido_id: pedido.id,
          produto_id: item.id,
          nome_item: item.nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          subtotal_original: item.preco * item.quantidade,
          desconto_manual: calcularDescontoItem(item),
          subtotal: calcularSubtotalItem(item),
          observacoes: item.observacoes || null,
        })),
      )
      if (itensError) throw itensError

      const { error: pagamentoError } = await supabase.from('pagamentos_pedido').insert({
        pedido_id: pedido.id,
        forma_pagamento: formaPagamento,
        valor: total,
      })
      if (pagamentoError) throw pagamentoError

      const numeroExibicao = await sincronizarNumeroPedidoDiario(supabase, pedido)
        .catch(() => normalizarNumeroPedido(pedido.numero_pedido))
      toast.success(`Pedido #${numeroExibicao || numeroPedido} criado.`)
      limparPedido()
    } catch (erro) {
      if (pedidoCriadoId) await supabase.from('pedidos').delete().eq('id', pedidoCriadoId)
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível criar o pedido.')
    } finally {
      setSalvando(false)
    }
  }

  const impedirSubmitNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') evento.preventDefault()
  }

  const renderCatalogo = (origem: OrigemCatalogo) => (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          onKeyDown={impedirSubmitNaBusca}
          placeholder="Buscar por nome, marca ou categoria"
          className="pl-9"
        />
      </div>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setCategoriaAtiva('todos')}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            categoriaAtiva === 'todos'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-accent',
          )}
        >
          Todos
        </button>
        {categorias.map((categoria) => (
          <button
            key={categoria}
            type="button"
            onClick={() => setCategoriaAtiva(categoria)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              categoriaAtiva === categoria
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            {categoria}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {produtosFiltrados.map((produto) => {
          const quantidadeNoPedido = itens
            .filter((item) => item.id === produto.id)
            .reduce((totalItensProduto, item) => totalItensProduto + item.quantidade, 0)
          const esgotado = produtoBloqueadoPorEstoque(produto)

          return (
            <article
              key={produto.id}
              className={cn('flex min-w-0 flex-col rounded-xl border border-border/70 bg-background p-3 transition-colors hover:border-primary/45', esgotado && 'opacity-65')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  {produto.categoria ? (
                    <span className="truncate text-xs text-muted-foreground">{produto.categoria}</span>
                  ) : <span />}
                  {quantidadeNoPedido > 0 ? (
                    <span className="shrink-0 text-xs font-medium tabular-nums text-primary">
                      {quantidadeNoPedido} no pedido
                    </span>
                  ) : null}
                  {esgotado ? <span className="shrink-0 text-xs font-medium text-muted-foreground">Esgotado</span> : null}
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                  {produto.nome}
                </h3>
                <p className="mt-2 font-mono text-base font-bold tabular-nums text-foreground">
                  {formatarMoeda(Number(produto.preco || 0))}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 px-2 shadow-none"
                  onClick={() => abrirPersonalizacao(produto, origem)}
                  disabled={esgotado}
                >
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                  Personalizar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-10 px-2 shadow-none"
                  onClick={() => adicionarProduto(produto)}
                  disabled={esgotado}
                >
                  <Plus className="size-4" strokeWidth={1.8} />
                  {esgotado ? 'Esgotado' : 'Adicionar'}
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      {!carregandoCatalogo && produtosFiltrados.length === 0 ? (
        <div className="grid place-items-center py-12 text-center">
          <PackageSearch className="mb-3 size-7 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-medium text-foreground">Nenhum produto encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outra busca ou categoria.</p>
        </div>
      ) : null}
    </>
  )

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin/pedidos')}
            className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Pedidos
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Nova venda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monte o pedido, identifique o cliente e registre o pagamento.</p>
        </div>
        <Button type="button" onClick={() => setCatalogoAberto(true)} className="h-11 gap-2 lg:hidden">
          <Plus className="size-4" strokeWidth={1.8} />
          Adicionar produtos
        </Button>
      </div>

      <form onSubmit={criarPedido} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start">
        <section className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 text-card-foreground shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Produtos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Adicione diretamente ou personalize antes de incluir no pedido.</p>
            </div>
            <span className="hidden rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:block">
              {produtos.length} produtos
            </span>
          </div>

          <div className="mt-5 hidden lg:block">
            {carregandoCatalogo ? (
              <div className="grid place-items-center py-20 text-sm text-muted-foreground">
                <Loader2 className="mb-3 size-5 animate-spin text-primary" />
                Carregando produtos...
              </div>
            ) : renderCatalogo('desktop')}
          </div>

          <button
            type="button"
            onClick={() => setCatalogoAberto(true)}
            className="mt-5 flex min-h-16 w-full items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 p-4 text-left transition-colors hover:bg-accent lg:hidden"
          >
            <span>
              <span className="block font-medium text-foreground">Abrir catálogo</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">Busque, adicione ou personalize produtos.</span>
            </span>
            <Plus className="size-5 shrink-0 text-primary" strokeWidth={1.8} />
          </button>
        </section>

        <aside className="min-w-0 lg:sticky lg:top-5">
          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-semibold text-foreground">Pedido atual</h2>
                <p aria-live="polite" className="mt-0.5 text-xs text-muted-foreground">
                  {quantidadeItens === 0 ? 'Nenhum item adicionado' : `${quantidadeItens} ${quantidadeItens === 1 ? 'item' : 'itens'} no pedido`}
                </p>
              </div>
              {itens.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setItens([])}
                  className="min-h-10 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="max-h-[22rem] overflow-y-auto px-4 sm:px-5">
              {itens.length === 0 ? (
                <div className="grid place-items-center py-10 text-center">
                  <ShoppingCart className="mb-3 size-7 text-muted-foreground" strokeWidth={1.5} />
                  <p className="font-medium text-foreground">Seu pedido está vazio</p>
                  <p className="mt-1 text-sm text-muted-foreground">Escolha produtos no catálogo.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {itens.map((item) => {
                    const descontoItem = calcularDescontoItem(item)
                    const totalItem = calcularSubtotalItem(item)

                    return (
                      <li key={item.linhaId} className="py-3.5">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatarMoeda(item.preco)} cada
                              {descontoItem > 0 ? ` · desconto de ${formatarMoeda(descontoItem)}` : ''}
                            </p>
                            {item.observacoes ? (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.observacoes}</p>
                            ) : null}
                          </div>
                          <strong className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                            {formatarMoeda(totalItem)}
                          </strong>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => abrirPersonalizacao(item, 'desktop', item.linhaId)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            <Pencil className="size-3.5" strokeWidth={1.8} />
                            Personalizar
                          </button>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-10 items-center rounded-lg border border-border bg-background p-0.5">
                              <button
                                type="button"
                                onClick={() => alterarQuantidade(item.linhaId, -1)}
                                className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                aria-label={`Diminuir quantidade de ${item.nome}`}
                              >
                                <Minus className="size-3.5" strokeWidth={1.8} />
                              </button>
                              <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantidade}</span>
                              <button
                                type="button"
                                onClick={() => alterarQuantidade(item.linhaId, 1)}
                                className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                aria-label={`Aumentar quantidade de ${item.nome}`}
                              >
                                <Plus className="size-3.5" strokeWidth={1.8} />
                              </button>
                            </span>
                            <button
                              type="button"
                              onClick={() => setItens((itensAtuais) => itensAtuais.filter((produto) => produto.linhaId !== item.linhaId))}
                              className="grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Remover ${item.nome}`}
                            >
                              <Trash2 className="size-4" strokeWidth={1.8} />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-5 border-t border-border/70 p-4 sm:p-5">
              <section aria-labelledby="cliente-title">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 id="cliente-title" className="text-sm font-semibold text-foreground">Cliente</h3>
                  <span className="text-xs text-muted-foreground">Obrigatório</span>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Nome
                    <Input
                      value={nomeCliente}
                      onChange={(evento) => alterarNomeCliente(evento.target.value)}
                      placeholder="Digite para buscar ou criar"
                      autoComplete="name"
                      required
                    />
                  </label>

                  {nomeCliente.trim().length >= 2 && !clienteSelecionado ? (
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-1.5" aria-live="polite">
                      {buscandoClientes ? (
                        <div className="flex min-h-11 items-center gap-2 px-2.5 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin text-primary" />
                          Buscando clientes...
                        </div>
                      ) : erroBuscaClientes ? (
                        <p className="px-2.5 py-2 text-sm text-muted-foreground">
                          Não foi possível consultar clientes agora. Você ainda pode concluir a venda e criar o cadastro.
                        </p>
                      ) : clientesEncontrados.length > 0 ? (
                        <div className="space-y-1">
                          <p className="px-2.5 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">Clientes encontrados</p>
                          {clientesEncontrados.map((cliente) => (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => selecionarCliente(cliente)}
                              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">{cliente.nome || 'Cliente sem nome'}</span>
                                <span className="block truncate text-xs text-muted-foreground">{cliente.telefone}</span>
                              </span>
                              <span className="shrink-0 text-xs font-medium text-primary">Usar</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="px-2.5 py-2 text-sm text-muted-foreground">
                          Nenhum cliente encontrado. Ao concluir, um novo cadastro será criado com estes dados.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {clienteSelecionado ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground" aria-live="polite">
                      Cliente selecionado: <span className="font-medium">{clienteSelecionado.nome || clienteSelecionado.telefone}</span>
                    </div>
                  ) : null}

                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Telefone
                    <Input
                      value={telefone}
                      onChange={(evento) => alterarTelefoneCliente(evento.target.value)}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="border-t border-border/70 pt-5" aria-labelledby="entrega-title">
                <h3 id="entrega-title" className="text-sm font-semibold text-foreground">Recebimento</h3>
                <div className="mt-3 grid grid-cols-2 rounded-lg border border-border bg-muted/20 p-1">
                  <button
                    type="button"
                    onClick={() => setTipoEntrega('retirada')}
                    aria-pressed={tipoEntrega === 'retirada'}
                    className={cn(
                      'min-h-10 rounded-md px-3 text-sm font-medium transition-colors',
                      tipoEntrega === 'retirada' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Retirada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoEntrega('entrega')}
                    aria-pressed={tipoEntrega === 'entrega'}
                    className={cn(
                      'min-h-10 rounded-md px-3 text-sm font-medium transition-colors',
                      tipoEntrega === 'entrega' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Entrega
                  </button>
                </div>

                {tipoEntrega === 'entrega' ? (
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Cidade
                      <select
                        value={bairroId}
                        onChange={(evento) => setBairroId(evento.target.value)}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                      >
                        <option value="">Selecione a cidade</option>
                        {bairros.map((bairro) => (
                          <option key={bairro.id} value={bairro.id}>
                            {bairro.nome} — {bairro.entrega_gratis ? 'Grátis' : formatarMoeda(Number(bairro.taxa_entrega || 0))} · mín. {formatarMoeda(Number(bairro.valor_minimo_pedido || 0))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Bairro
                      <Input value={bairroEndereco} onChange={(evento) => setBairroEndereco(evento.target.value)} placeholder="Ex.: Centro" autoComplete="address-level3" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Endereço
                      <Input value={endereco} onChange={(evento) => setEndereco(evento.target.value)} placeholder="Rua, número e complemento" autoComplete="street-address" />
                    </label>
                    {bairroSelecionado && !atingiuMinimoEntrega ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Faltam {formatarMoeda(valorMinimoEntrega - subtotal)} em produtos para entrega nesta cidade.
                      </p>
                    ) : null}
                    <label className="grid gap-1.5 text-sm font-medium text-foreground">
                      Referência <span className="font-normal text-muted-foreground">(opcional)</span>
                      <Input value={referencia} onChange={(evento) => setReferencia(evento.target.value)} placeholder="Próximo a..." />
                    </label>
                  </div>
                ) : null}
              </section>

              <section className="border-t border-border/70 pt-5" aria-labelledby="pagamento-title">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  <span id="pagamento-title">Pagamento</span>
                  <select
                    value={formaPagamento}
                    onChange={(evento) => setFormaPagamento(evento.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                  >
                    <option value="">Selecione</option>
                    {formasPagamento.map((forma) => <option key={forma.id} value={forma.codigo}>{forma.nome}</option>)}
                  </select>
                </label>
              </section>

              <section className="border-t border-border/70 pt-5" aria-labelledby="observacao-title">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  <span id="observacao-title">Observação do pedido <span className="font-normal text-muted-foreground">(opcional)</span></span>
                  <Textarea value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} placeholder="Informações gerais deste pedido" className="min-h-20 resize-y" />
                </label>
              </section>
            </div>

            <div className="border-t border-border/70 bg-muted/30 p-4 sm:p-5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Produtos</span>
                  <span className="font-mono tabular-nums">{formatarMoeda(subtotalBruto)}</span>
                </div>
                {descontoItensTotal > 0 ? (
                  <div className="flex justify-between gap-4 text-primary">
                    <span>Descontos nos itens</span>
                    <span className="font-mono tabular-nums">− {formatarMoeda(descontoItensTotal)}</span>
                  </div>
                ) : null}
                {tipoEntrega === 'entrega' ? (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Entrega</span>
                    <span className="font-mono tabular-nums">{taxaEntrega === 0 ? 'Grátis' : formatarMoeda(taxaEntrega)}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="font-semibold text-foreground">Total</span>
                <strong className="font-mono text-2xl font-bold tabular-nums text-primary">{formatarMoeda(total)}</strong>
              </div>
              <Button type="submit" size="lg" disabled={salvando || carregandoCatalogo || itens.length === 0} className="mt-4 h-11 w-full gap-2 shadow-none">
                {salvando ? <Loader2 className="size-4 animate-spin" /> : <ReceiptText className="size-4" strokeWidth={1.8} />}
                {salvando ? 'Salvando venda...' : 'Concluir venda'}
              </Button>
            </div>
          </section>
        </aside>
      </form>

      <Drawer open={catalogoAberto} onOpenChange={setCatalogoAberto} repositionInputs={false}>
        <DrawerContent className="mx-auto h-[92dvh] max-h-[92dvh] w-full max-w-3xl overflow-hidden p-0 lg:hidden">
          <DrawerHeader className="border-b border-border px-4 pb-4 pt-3">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <DrawerTitle>Produtos</DrawerTitle>
                <DrawerDescription className="mt-1">Adicione itens sem perder o pedido em construção.</DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  onClick={() => setCatalogoAberto(false)}
                  className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label="Fechar catálogo"
                >
                  <X className="size-4" strokeWidth={1.8} />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {carregandoCatalogo ? (
              <div className="grid place-items-center py-16 text-sm text-muted-foreground">
                <Loader2 className="mb-3 size-5 animate-spin text-primary" />
                Carregando produtos...
              </div>
            ) : renderCatalogo('mobile')}
          </div>
          <DrawerFooter className="border-t border-border bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
            <Button type="button" onClick={() => setCatalogoAberto(false)} className="h-11 w-full shadow-none">
              Voltar ao pedido{quantidadeItens > 0 ? ` · ${quantidadeItens}` : ''}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ModalItemPedidoAdmin
        aberto={Boolean(personalizacaoAberta)}
        modoEdicao={Boolean(personalizacaoAberta?.linhaId)}
        dados={itemEmPersonalizacao}
        descontosAtivos
        onFechar={() => setPersonalizacaoAberta(null)}
        onConfirmar={confirmarPersonalizacao}
        onRemover={personalizacaoAberta?.linhaId
          ? () => setItens((itensAtuais) => itensAtuais.filter((item) => item.linhaId !== personalizacaoAberta.linhaId))
          : undefined}
      />
    </main>
  )
}

export default function NovoPedidoPage() {
  return <ProtectedRoute><AdminLayout><NovoPedidoLoja /></AdminLayout></ProtectedRoute>
}
