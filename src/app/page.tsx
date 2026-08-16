'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import {
  ArrowRight,
  Baby,
  Droplets,
  Gem,
  Grid2X2,
  MoreHorizontal,
  PackageOpen,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Waves,
  X as XIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CartaoProduto from '@/components/CartaoProduto'
import HeroVitrine from '@/components/HeroVitrine'
import ResultadosStudio from '@/components/ResultadosStudio'
import ModalCarrinho from '@/components/ModalCarrinho'
import ModalComplementos from '@/components/ModalComplementos'
import ModalLojaFechada from '@/components/ModalLojaFechada'
import ModalNotificacao from '@/components/ModalNotificacao'
import ModalPedidosCliente from '@/components/ModalPedidosCliente'
import { LimiteDeErro } from '@/components/LimiteDeErro'
import { AjudaPedidoPublica } from '@/components/AjudaPedidoPublica'
import { Produto, supabase } from '@/lib/supabase'
import { useStatusLoja } from '@/lib/useStatusLoja'
import { useCarrinho } from '@/contexts/CarrinhoContext'
import { produtoDisponivelParaCompra } from '@/lib/estoque-produto.mjs'
import {
  normalizarNomeCategoria,
} from '@/lib/categoriasCardapio'
import {
  CHAVE_ROTULO_CATEGORIA_TODOS,
  ROTULO_CATEGORIA_TODOS_PADRAO,
  normalizarRotuloCategoriaTodos,
} from '@/lib/categorias-publicas.mjs'
import {
  CHAVE_ORDENACAO_PRODUTOS_SITE,
  normalizarTipoOrdenacaoProdutos,
  TipoOrdenacaoProdutosSite,
} from '@/lib/ordenacaoCardapio'
import {
  CHAVE_MAIS_VENDIDOS_VITRINE,
  CONFIGURACAO_MAIS_VENDIDOS_PADRAO,
  ConfiguracaoMaisVendidos,
} from '@/lib/vitrineMaisVendidos'
import {
  CHAVE_OFERTAS_VITRINE,
  CONFIGURACAO_OFERTAS_PADRAO,
  ConfiguracaoOfertas,
} from '@/lib/vitrineOfertas'

type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'

type EstadoModalNotificacao = {
  aberto: boolean
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
}

type RespostaMaisVendidos = {
  sucesso: boolean
  configuracao?: ConfiguracaoMaisVendidos
  rankingAutomatico?: Array<{
    produtoId: string
    quantidade: number
    receita: number
  }>
}

type RespostaOfertas = {
  sucesso: boolean
  configuracao?: ConfiguracaoOfertas
}

type CategoriaPublica = {
  id: string
  nome: string
  ordem: number
}

type RespostaCategorias = {
  sucesso: boolean
  categorias?: CategoriaPublica[]
  rotuloTodos?: string
}

const normalizarCategoriaFortesFios = (categoria: string | null | undefined) =>
  normalizarNomeCategoria(categoria)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

const obterIconeCategoria = (categoria: string): LucideIcon => {
  const categoriaNormalizada = normalizarCategoriaFortesFios(categoria)

  if (categoriaNormalizada.startsWith('todos')) return Grid2X2
  if (categoriaNormalizada.includes('kit')) return PackageOpen
  if (categoriaNormalizada.includes('pos-quimica')) return ShieldCheck
  if (categoriaNormalizada.includes('cachead')) return Waves
  if (categoriaNormalizada.includes('ressecad')) return Droplets
  if (categoriaNormalizada.includes('mary kay')) return Gem
  if (categoriaNormalizada.includes('infantil')) return Baby
  if (categoriaNormalizada.includes('outro')) return MoreHorizontal
  return Tag
}

const calcularProgressoTrilha = (trilha: HTMLDivElement) => {
  if (trilha.scrollWidth <= trilha.clientWidth) return 1
  return Math.min(
    1,
    Math.max(0, (trilha.scrollLeft + trilha.clientWidth) / trilha.scrollWidth),
  )
}

export default function Home() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categoriasBanco, setCategoriasBanco] = useState<CategoriaPublica[]>([])
  const [rotuloCategoriaTodos, setRotuloCategoriaTodos] = useState(
    ROTULO_CATEGORIA_TODOS_PADRAO,
  )
  const rotuloCategoriaTodosRef = useRef(ROTULO_CATEGORIA_TODOS_PADRAO)
  const [modalCarrinhoAberto, setModalCarrinhoAberto] = useState(false)
  const [modalPedidosClienteAberto, setModalPedidosClienteAberto] =
    useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [modalComplementosAberto, setModalComplementosAberto] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(
    null,
  )
  const [temAdicionaisDisponiveis, setTemAdicionaisDisponiveis] =
    useState(false)
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>(
    ROTULO_CATEGORIA_TODOS_PADRAO,
  )
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [tipoOrdenacaoProdutos, setTipoOrdenacaoProdutos] =
    useState<TipoOrdenacaoProdutosSite>('manual')
  const [ordenacaoCliente, setOrdenacaoCliente] = useState<
    'recomendados' | 'menor_preco' | 'maior_preco'
  >('recomendados')
  const [configuracaoMaisVendidos, setConfiguracaoMaisVendidos] =
    useState<ConfiguracaoMaisVendidos>(CONFIGURACAO_MAIS_VENDIDOS_PADRAO)
  const [rankingAutomaticoIds, setRankingAutomaticoIds] = useState<string[]>(
    [],
  )
  const [carregandoMaisVendidos, setCarregandoMaisVendidos] = useState(true)
  const [configuracaoOfertas, setConfiguracaoOfertas] =
    useState<ConfiguracaoOfertas>(CONFIGURACAO_OFERTAS_PADRAO)
  const [carregandoOfertas, setCarregandoOfertas] = useState(true)
  const trilhaCategoriasRef = useRef<HTMLDivElement>(null)
  const trilhaMaisVendidosRef = useRef<HTMLDivElement>(null)
  const trilhaOfertasRef = useRef<HTMLDivElement>(null)
  const barraCategoriasRef = useRef<HTMLDivElement>(null)
  const barraMaisVendidosRef = useRef<HTMLSpanElement>(null)
  const barraOfertasRef = useRef<HTMLSpanElement>(null)
  const quadroProgressoRef = useRef<number | null>(null)
  const [modalNotificacao, setModalNotificacao] =
    useState<EstadoModalNotificacao>({
      aberto: false,
      tipo: 'sucesso',
      titulo: '',
      mensagem: '',
    })

  const { lojaFechada, numeroWhatsApp } = useStatusLoja()
  const { adicionarItem, sincronizarProdutos } = useCarrinho()

  useEffect(() => {
    document.body.classList.add('fortes-fios-public')
    return () => document.body.classList.remove('fortes-fios-public')
  }, [])

  const carregarConfiguracaoOrdenacao = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .eq('chave', CHAVE_ORDENACAO_PRODUTOS_SITE)

      if (error) throw error

      const valorOrdenacao = data?.find(
        (configAtual) => configAtual.chave === CHAVE_ORDENACAO_PRODUTOS_SITE,
      )?.valor
      const tipoOrdenacao = normalizarTipoOrdenacaoProdutos(valorOrdenacao)

      setTipoOrdenacaoProdutos(tipoOrdenacao)

      return tipoOrdenacao
    } catch (error) {
      console.error(
        'Erro ao carregar configuração de ordenação do cardápio:',
        error,
      )
      return 'manual' as TipoOrdenacaoProdutosSite
    }
  }, [])

  const carregarProdutos = useCallback(
    async (
      modoOrdenacao: TipoOrdenacaoProdutosSite = tipoOrdenacaoProdutos,
    ) => {
      setCarregando(true)
      try {
        let consulta = supabase
          .from('produtos')
          .select(
            'id, nome, descricao, preco, preco_original, desconto, parcelamento_ativo, parcelas_sem_juros, categoria, imagem_url, disponivel, destaque, ordem, estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque, created_at, updated_at',
          )
          .eq('disponivel', true)

        if (modoOrdenacao === 'manual') {
          consulta = consulta
            .order('ordem', { ascending: true })
            .order('nome', { ascending: true })
        } else if (modoOrdenacao === 'preco_crescente') {
          consulta = consulta
            .order('preco', { ascending: true })
            .order('nome', { ascending: true })
        } else {
          consulta = consulta
            .order('preco', { ascending: false })
            .order('nome', { ascending: true })
        }

        const { data, error } = await consulta
        if (error) throw error
        setProdutos(data || [])
      } catch (error) {
        console.error('Erro ao carregar produtos:', error)
      } finally {
        setCarregando(false)
      }
    },
    [tipoOrdenacaoProdutos],
  )

  const carregarCategorias = useCallback(async () => {
    try {
      const resposta = await fetch('/api/vitrine/categorias', {
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Falha ao carregar categorias')

      const dados = (await resposta.json()) as RespostaCategorias
      if (!dados.sucesso || !Array.isArray(dados.categorias)) {
        throw new Error('Categorias indisponíveis')
      }

      setCategoriasBanco(dados.categorias)
      const proximoRotulo = normalizarRotuloCategoriaTodos(dados.rotuloTodos)
      const rotuloAnterior = rotuloCategoriaTodosRef.current
      rotuloCategoriaTodosRef.current = proximoRotulo
      setRotuloCategoriaTodos(proximoRotulo)
      setCategoriaAtiva((categoriaAtual) =>
        categoriaAtual === rotuloAnterior ? proximoRotulo : categoriaAtual,
      )
    } catch (error) {
      console.error('Erro ao carregar categorias do catálogo:', error)
      setCategoriasBanco([])
    }
  }, [])

  const carregarDisponibilidadeAdicionais = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('adicionais')
        .select('id', { head: true, count: 'exact' })
        .eq('disponivel', true)

      if (error) throw error
      setTemAdicionaisDisponiveis((count || 0) > 0)
    } catch (error) {
      console.error('Erro ao verificar adicionais:', error)
      setTemAdicionaisDisponiveis(false)
    }
  }, [])

  const carregarMaisVendidos = useCallback(async () => {
    setCarregandoMaisVendidos(true)
    try {
      const resposta = await fetch('/api/vitrine/mais-vendidos', {
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Falha ao carregar mais vendidos')

      const dados = (await resposta.json()) as RespostaMaisVendidos
      if (!dados.sucesso || !dados.configuracao) {
        throw new Error('Configuração de mais vendidos indisponível')
      }

      setConfiguracaoMaisVendidos(dados.configuracao)
      setRankingAutomaticoIds(
        (dados.rankingAutomatico || []).map((produto) => produto.produtoId),
      )
    } catch (error) {
      console.error('Erro ao carregar produtos mais vendidos:', error)
      setRankingAutomaticoIds([])
    } finally {
      setCarregandoMaisVendidos(false)
    }
  }, [])

  const carregarOfertas = useCallback(async () => {
    setCarregandoOfertas(true)
    try {
      const resposta = await fetch('/api/vitrine/ofertas', {
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Falha ao carregar ofertas')

      const dados = (await resposta.json()) as RespostaOfertas
      if (!dados.sucesso || !dados.configuracao) {
        throw new Error('Configuração de ofertas indisponível')
      }

      setConfiguracaoOfertas(dados.configuracao)
    } catch (error) {
      console.error('Erro ao carregar ofertas:', error)
      setConfiguracaoOfertas(CONFIGURACAO_OFERTAS_PADRAO)
    } finally {
      setCarregandoOfertas(false)
    }
  }, [])

  const sincronizarCardapio = useCallback(async () => {
    const tipoOrdenacao = await carregarConfiguracaoOrdenacao()
    await Promise.all([
      carregarProdutos(tipoOrdenacao),
      carregarCategorias(),
      carregarDisponibilidadeAdicionais(),
      carregarMaisVendidos(),
      carregarOfertas(),
    ])
  }, [
    carregarConfiguracaoOrdenacao,
    carregarCategorias,
    carregarDisponibilidadeAdicionais,
    carregarMaisVendidos,
    carregarOfertas,
    carregarProdutos,
  ])

  useEffect(() => {
    sincronizarCardapio()

    const channelProdutos = supabase
      .channel('produtos-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'produtos' },
        (evento) => {
          const atualizado = evento.new as Produto
          setProdutos((estadoAtual) => atualizado.disponivel === false
            ? estadoAtual.filter((produto) => produto.id !== atualizado.id)
            : estadoAtual.map((produto) => produto.id === atualizado.id ? atualizado : produto))
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'produtos' }, () => carregarProdutos())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'produtos' }, (evento) => {
        const removido = evento.old as { id?: string }
        if (removido.id) setProdutos((estadoAtual) => estadoAtual.filter((produto) => produto.id !== removido.id))
      })
      .subscribe()

    const channelAdicionais = supabase
      .channel('adicionais-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adicionais' },
        () => {
          carregarDisponibilidadeAdicionais()
        },
      )
      .subscribe()

    const channelConfiguracoes = supabase
      .channel('configuracoes-cardapio-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_loja' },
        (payload) => {
          const registro = payload.new
          if (!registro || typeof registro !== 'object') return

          const chave = (registro as { chave?: string }).chave
          if (chave === CHAVE_ORDENACAO_PRODUTOS_SITE) {
            sincronizarCardapio()
          } else if (chave === CHAVE_MAIS_VENDIDOS_VITRINE) {
            carregarMaisVendidos()
          } else if (chave === CHAVE_OFERTAS_VITRINE) {
            carregarOfertas()
          } else if (chave === CHAVE_ROTULO_CATEGORIA_TODOS) {
            carregarCategorias()
          }
        },
      )
      .subscribe()

    const channelCategorias = supabase
      .channel('categorias-cardapio-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categorias_cardapio' },
        () => carregarCategorias(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelProdutos)
      supabase.removeChannel(channelAdicionais)
      supabase.removeChannel(channelConfiguracoes)
      supabase.removeChannel(channelCategorias)
    }
  }, [
    carregarDisponibilidadeAdicionais,
    carregarCategorias,
    carregarMaisVendidos,
    carregarOfertas,
    carregarProdutos,
    sincronizarCardapio,
  ])

  useEffect(() => {
    if (!carregando) sincronizarProdutos(produtos)
  }, [carregando, produtos, sincronizarProdutos])

  const mostrarAvisoLojaFechada = () => {
    setModalNotificacao({
      aberto: true,
      tipo: 'aviso',
      titulo: 'Loja fechada',
      mensagem:
        'Estamos fechados no momento. Você pode navegar no catálogo, mas não é possível fazer pedidos agora.',
    })
  }

  const mostrarItemAdicionado = (nomeItem: string) => {
    toast.success(`${nomeItem} adicionado`, {
      description: 'Continue escolhendo ou revise o pedido quando quiser.',
      action: {
        label: 'Ver carrinho',
        onClick: () => setModalCarrinhoAberto(true),
      },
    })
  }

  const adicionarProdutoAoCarrinho = (produto: Produto) => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    if (!produtoDisponivelParaCompra(produto)) {
      toast.warning('Produto esgotado', {
        description: `${produto.nome} não está disponível para compra no momento.`,
      })
      return
    }

    if (!temAdicionaisDisponiveis) {
      if (adicionarItem(produto, 1, [], undefined)) {
        mostrarItemAdicionado(produto.nome)
      } else {
        toast.warning('Quantidade indisponível', {
          description: 'O estoque deste produto foi atualizado. Revise o carrinho.',
        })
      }
      return
    }

    // Abre o modal de complementos apenas quando há adicionais disponíveis
    setProdutoSelecionado(produto)
    setModalComplementosAberto(true)
  }

  const abrirCarrinho = () => {
    if (lojaFechada) {
      mostrarAvisoLojaFechada()
      return
    }

    setModalCarrinhoAberto(true)
  }

  const categorias = useMemo(
    () => [
      rotuloCategoriaTodos,
      ...categoriasBanco.map((categoria) => categoria.nome),
    ],
    [categoriasBanco, rotuloCategoriaTodos],
  )

  const selecionarCategoria = useCallback((categoria: string) => {
    setCategoriaAtiva(categoria)
    window.requestAnimationFrame(() => {
      document
        .getElementById('catalogo')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useEffect(() => {
    if (
      categoriaAtiva !== rotuloCategoriaTodos &&
      !categorias.includes(categoriaAtiva)
    ) {
      setCategoriaAtiva(rotuloCategoriaTodos)
    }
  }, [categoriaAtiva, categorias, rotuloCategoriaTodos])

  const buscaLower = busca.toLowerCase()

  const produtosFiltrados = useMemo(() => {
    const produtosDaCategoria =
      categoriaAtiva === rotuloCategoriaTodos
        ? produtos.filter(
            (p) => !busca || p.nome.toLowerCase().includes(buscaLower),
          )
        : produtos.filter(
            (p) =>
              normalizarCategoriaFortesFios(p.categoria) ===
                normalizarCategoriaFortesFios(categoriaAtiva) &&
              (!busca || p.nome.toLowerCase().includes(buscaLower)),
          )

    if (ordenacaoCliente === 'menor_preco')
      return [...produtosDaCategoria].sort((a, b) => a.preco - b.preco)
    if (ordenacaoCliente === 'maior_preco')
      return [...produtosDaCategoria].sort((a, b) => b.preco - a.preco)
    return produtosDaCategoria
  }, [busca, buscaLower, categoriaAtiva, ordenacaoCliente, produtos, rotuloCategoriaTodos])

  const produtosMaisVendidos = useMemo(() => {
    if (!configuracaoMaisVendidos.ativo) return []

    const produtoIds =
      configuracaoMaisVendidos.modo === 'manual'
        ? configuracaoMaisVendidos.produtoIds
        : rankingAutomaticoIds
    const produtosPorId = new Map(
      produtos.map((produto) => [produto.id, produto] as const),
    )

    return produtoIds
      .flatMap((produtoId) => {
        const produto = produtosPorId.get(produtoId)
        return produto ? [produto] : []
      })
      .slice(0, configuracaoMaisVendidos.quantidade)
  }, [configuracaoMaisVendidos, produtos, rankingAutomaticoIds])

  const produtosEmOferta = useMemo(() => {
    if (!configuracaoOfertas.ativo) return []
    const produtosPorId = new Map(
      produtos.map((produto) => [produto.id, produto] as const),
    )

    return configuracaoOfertas.produtoIds
      .flatMap((produtoId) => {
        const produto = produtosPorId.get(produtoId)
        return produto ? [produto] : []
      })
      .slice(0, configuracaoOfertas.quantidade)
  }, [configuracaoOfertas, produtos])

  const atualizarIndicadores = useCallback(() => {
    const pares = [
      [trilhaCategoriasRef.current, barraCategoriasRef.current],
      [trilhaMaisVendidosRef.current, barraMaisVendidosRef.current],
      [trilhaOfertasRef.current, barraOfertasRef.current],
    ] as const

    pares.forEach(([trilha, barra]) => {
      if (!trilha || !barra) return
      barra.style.transform = `scaleX(${calcularProgressoTrilha(trilha)})`
    })
  }, [])

  const agendarAtualizacaoIndicadores = useCallback(() => {
    if (quadroProgressoRef.current !== null) return
    quadroProgressoRef.current = window.requestAnimationFrame(() => {
      quadroProgressoRef.current = null
      atualizarIndicadores()
    })
  }, [atualizarIndicadores])

  useEffect(() => {
    agendarAtualizacaoIndicadores()
    window.addEventListener('resize', agendarAtualizacaoIndicadores)
    return () => {
      if (quadroProgressoRef.current !== null) {
        window.cancelAnimationFrame(quadroProgressoRef.current)
        quadroProgressoRef.current = null
      }
      window.removeEventListener('resize', agendarAtualizacaoIndicadores)
    }
  }, [
    agendarAtualizacaoIndicadores,
    categorias.length,
    produtosEmOferta.length,
    produtosMaisVendidos.length,
  ])

  const totalResultados = produtosFiltrados.length
  const navegacaoInferiorVisivel = !(
    modalCarrinhoAberto ||
    modalPedidosClienteAberto ||
    ajudaAberta ||
    modalComplementosAberto ||
    modalNotificacao.aberto
  )

  return (
    <div className="fortes-fios-site min-h-screen bg-background text-foreground">
      <Header
        onAbrirAjuda={() => setAjudaAberta(true)}
        onAbrirCarrinho={abrirCarrinho}
        onAbrirPedidos={() => setModalPedidosClienteAberto(true)}
        categorias={categorias}
        categoriaAtiva={categoriaAtiva}
        onSelecionarCategoria={selecionarCategoria}
        ofertasDisponiveis={produtosEmOferta.length > 0}
        onAbrirOfertas={() =>
          document
            .getElementById('ofertas')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      />

      <main className="pb-28 md:pb-10">
        <HeroVitrine />

        <section
          className="border-y border-border/70 bg-secondary/45"
          aria-label="Vantagens da loja"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-border/70 px-4 sm:px-6 lg:px-8">
            {[
              {
                titulo: 'Compra fácil',
                descricao: 'Peça pelo site',
                icone: ShoppingBag,
              },
              {
                titulo: 'Como preferir',
                descricao: 'Entrega ou retirada',
                icone: Truck,
              },
              {
                titulo: 'Acompanhe',
                descricao: 'Consulte seus pedidos',
                icone: PackageCheck,
              },
            ].map(({ titulo, descricao, icone: Icone }) => (
              <div
                key={titulo}
                className="flex min-w-0 items-center justify-center gap-2 px-2 py-3 sm:gap-3 sm:py-4"
              >
                <Icone
                  className="hidden size-5 shrink-0 text-primary sm:block"
                  strokeWidth={1.7}
                  aria-hidden
                />
                <div className="min-w-0 text-center sm:text-left">
                  <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                    {titulo}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                    {descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-border/70 py-9 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="fortes-display text-2xl leading-none text-primary sm:text-3xl">
                Fortes Fios
              </p>
              <h2 className="fortes-display mt-3 text-3xl leading-[0.98] text-foreground sm:text-5xl">
                Tudo o que seu cabelo precisa em um só lugar.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A loja de quem entende de cabelo.
              </p>
            </div>

            <div className="mt-8">
              <h3 className="mb-4 text-sm font-semibold text-foreground">
                Compre por categoria
              </h3>
              <div
                ref={trilhaCategoriasRef}
                className="-mx-4 touch-auto overflow-x-auto overscroll-x-contain px-4 pb-1 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0"
                onScroll={agendarAtualizacaoIndicadores}
              >
                <div className="inline-flex min-w-max gap-3 sm:flex sm:min-w-0 sm:flex-wrap sm:gap-4">
                  {categorias.map((categoria) => {
                    const ativo = categoriaAtiva === categoria
                    const Icone = obterIconeCategoria(categoria)

                    return (
                      <button
                        type="button"
                        key={categoria}
                        onClick={() => selecionarCategoria(categoria)}
                        className="group flex w-[5.25rem] shrink-0 flex-col items-center gap-2 rounded-lg py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-24"
                        aria-pressed={ativo}
                      >
                        <span
                          className={`flex size-14 items-center justify-center rounded-full border transition-colors sm:size-16 ${
                            ativo
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground group-hover:border-primary/50 group-hover:text-primary'
                          }`}
                        >
                          <Icone className="size-6" strokeWidth={1.6} aria-hidden />
                        </span>
                        <span
                          className={`line-clamp-2 min-h-8 text-xs font-medium leading-4 ${
                            ativo ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {categoria}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {categorias.length > 4 ? (
                <div
                  className="mx-4 mt-4 h-0.5 overflow-hidden bg-border sm:hidden"
                  aria-hidden="true"
                >
                  <div
                    ref={barraCategoriasRef}
                    className="h-full origin-left scale-x-0 bg-foreground will-change-transform motion-reduce:will-change-auto"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {(carregandoMaisVendidos || produtosMaisVendidos.length > 0) && (
          <section
            className="border-b border-border/70 bg-secondary/25 py-10 sm:py-14"
            aria-labelledby="titulo-mais-vendidos"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
                <div>
                  <p className="text-[10px] font-medium lowercase tracking-[0.16em] text-primary sm:text-xs">
                    escolhas de quem compra
                  </p>
                  <h2
                    id="titulo-mais-vendidos"
                    className="fortes-display mt-1 text-4xl leading-none text-foreground sm:text-5xl"
                  >
                    Mais vendidos
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('catalogo')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
                >
                  Ver catálogo
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>

              {carregandoMaisVendidos ? (
                <div className="flex gap-4 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, indice) => (
                    <div
                      key={indice}
                      className="w-[72vw] max-w-[19rem] shrink-0 overflow-hidden rounded-lg bg-card sm:w-auto sm:max-w-none"
                    >
                      <div className="aspect-square animate-pulse bg-muted" />
                      <div className="space-y-3 p-4">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                        <div className="h-6 w-2/5 animate-pulse rounded bg-muted" />
                        <div className="h-11 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  ref={trilhaMaisVendidosRef}
                  className="-mx-4 touch-auto overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
                  onScroll={agendarAtualizacaoIndicadores}
                >
                  <div className="flex min-w-max snap-x snap-mandatory gap-4 sm:contents">
                    {produtosMaisVendidos.map((produto) => (
                      <div
                        key={produto.id}
                        className="w-[72vw] max-w-[19rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
                      >
                        <CartaoProduto
                          produto={produto}
                          onAdicionar={adicionarProdutoAoCarrinho}
                          variante="destaque"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!carregandoMaisVendidos && produtosMaisVendidos.length > 1 ? (
                <div
                  className="relative mx-4 mt-5 h-0.5 overflow-hidden bg-border sm:hidden"
                  aria-hidden="true"
                >
                  <span
                    ref={barraMaisVendidosRef}
                    className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-foreground will-change-transform motion-reduce:will-change-auto"
                  />
                </div>
              ) : null}
            </div>
          </section>
        )}

        {(carregandoOfertas || produtosEmOferta.length > 0) &&
        configuracaoOfertas.ativo ? (
          <section
            id="ofertas"
            className="scroll-mt-20 border-b border-border/70 py-10 sm:py-14"
            aria-labelledby="titulo-ofertas"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
                <div>
                  <p className="text-[10px] font-medium lowercase tracking-[0.16em] text-primary sm:text-xs">
                    oportunidades selecionadas
                  </p>
                  <h2
                    id="titulo-ofertas"
                    className="fortes-display mt-1 text-4xl leading-none text-foreground sm:text-5xl"
                  >
                    Ofertas
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('catalogo')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
                >
                  Ver catálogo
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>

              {carregandoOfertas ? (
                <div className="flex gap-4 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, indice) => (
                    <div
                      key={indice}
                      className="w-[72vw] max-w-[19rem] shrink-0 overflow-hidden rounded-lg bg-card sm:w-auto sm:max-w-none"
                    >
                      <div className="aspect-square animate-pulse bg-muted" />
                      <div className="space-y-3 p-4">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                        <div className="h-6 w-2/5 animate-pulse rounded bg-muted" />
                        <div className="h-11 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  ref={trilhaOfertasRef}
                  className="-mx-4 touch-auto overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4"
                  onScroll={agendarAtualizacaoIndicadores}
                >
                  <div className="flex min-w-max snap-x snap-mandatory gap-4 sm:contents">
                    {produtosEmOferta.map((produto) => (
                      <div
                        key={produto.id}
                        className="w-[72vw] max-w-[19rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
                      >
                        <CartaoProduto
                          produto={produto}
                          onAdicionar={adicionarProdutoAoCarrinho}
                          variante="oferta"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!carregandoOfertas && produtosEmOferta.length > 1 ? (
                <div
                  className="relative mx-4 mt-5 h-0.5 overflow-hidden bg-border sm:hidden"
                  aria-hidden="true"
                >
                  <span
                    ref={barraOfertasRef}
                    className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-foreground will-change-transform motion-reduce:will-change-auto"
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section id="catalogo" className="scroll-mt-20 py-7 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative max-w-3xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar shampoo, máscara, kit ou marca..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-12 w-full rounded-lg border border-input bg-card pl-12 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 sm:h-14 sm:text-base"
                aria-label="Buscar no catálogo"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Limpar busca"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>

            <div className="mb-5 mt-6 flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground sm:text-2xl">
                  {categoriaAtiva === rotuloCategoriaTodos
                    ? 'Todos os produtos'
                    : categoriaAtiva}
                </h3>
                {!carregando ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {totalResultados}{' '}
                    {totalResultados === 1
                      ? 'produto encontrado'
                      : 'produtos encontrados'}
                    {busca ? ` para “${busca}”` : ''}
                  </p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Ordenar por</span>
                <select
                  value={ordenacaoCliente}
                  onChange={(event) =>
                    setOrdenacaoCliente(
                      event.target.value as typeof ordenacaoCliente,
                    )
                  }
                  className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="recomendados">Recomendados</option>
                  <option value="menor_preco">Menor preço</option>
                  <option value="maior_preco">Maior preço</option>
                </select>
              </label>
            </div>

            {carregando ? (
              <div
                className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
                aria-label="Carregando produtos"
              >
                {Array.from({ length: 8 }, (_, indice) => (
                  <div
                    key={indice}
                    className="overflow-hidden rounded-xl border border-border/70 bg-card"
                  >
                    <div className="aspect-[4/5] animate-pulse bg-muted" />
                    <div className="space-y-3 p-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-10 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/25 px-5 py-14 text-center">
                <p className="text-base font-semibold text-foreground">
                  Nenhum produto encontrado
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tente outro termo ou volte para todos os produtos.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBusca('')
                    setCategoriaAtiva(rotuloCategoriaTodos)
                  }}
                  className="mt-4 min-h-11 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ver todos os produtos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {produtosFiltrados.map((produto) => (
                  <CartaoProduto
                    key={produto.id}
                    produto={produto}
                    onAdicionar={adicionarProdutoAoCarrinho}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <ResultadosStudio />
      </main>

      {navegacaoInferiorVisivel && (
        <Footer
          onAbrirCarrinho={abrirCarrinho}
          onAbrirPedidos={() => setModalPedidosClienteAberto(true)}
        />
      )}

      <AjudaPedidoPublica
        aberto={ajudaAberta}
        numeroWhatsApp={numeroWhatsApp}
        onFechar={() => setAjudaAberta(false)}
      />

      <ModalCarrinho
        aberto={modalCarrinhoAberto}
        onFechar={() => setModalCarrinhoAberto(false)}
        lojaFechada={lojaFechada}
      />

      {/*
        Contenção: um throw dentro da consulta de pedidos não pode apagar a loja
        inteira. A causa continua sendo corrigida na origem — isto é a rede.
      */}
      <LimiteDeErro area="MeusPedidos">
        <ModalPedidosCliente
          aberto={modalPedidosClienteAberto}
          onFechar={() => setModalPedidosClienteAberto(false)}
        />
      </LimiteDeErro>

      <ModalNotificacao
        aberto={modalNotificacao.aberto}
        tipo={modalNotificacao.tipo}
        titulo={modalNotificacao.titulo}
        mensagem={modalNotificacao.mensagem}
        onFechar={() =>
          setModalNotificacao((prev) => ({ ...prev, aberto: false }))
        }
      />

      <ModalComplementos
        produto={produtoSelecionado}
        aberto={modalComplementosAberto}
        onFechar={() => {
          setModalComplementosAberto(false)
          setProdutoSelecionado(null)
        }}
        onItemAdicionado={mostrarItemAdicionado}
      />

      <ModalLojaFechada aberto={lojaFechada} numeroWhatsApp={numeroWhatsApp} />
    </div>
  )
}
