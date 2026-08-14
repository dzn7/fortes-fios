'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgePercent,
  Camera,
  Crop,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Megaphone,
  Monitor,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
import EditorResultadosStudio from '@/components/admin/vitrine/EditorResultadosStudio'
import EditorOfertas from '@/components/admin/vitrine/EditorOfertas'
import EditorFaixaRodape from '@/components/admin/vitrine/EditorFaixaRodape'
import { supabase } from '@/lib/supabase'
import { uploadImagemB2 } from '@/lib/backblaze'
import { arquivoParaUrl, validarArquivoImagem } from '@/lib/recorteImagem'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  POSICAO_TEXTO_BANNER_CLASSES,
  POSICAO_TEXTO_BANNER_ROTULOS,
  POSICOES_TEXTO_BANNER,
  ehPosicaoTextoBanner,
  type PosicaoTextoBanner,
} from '@/lib/vitrineBannerTexto'
import {
  CHAVE_MAIS_VENDIDOS_VITRINE,
  CONFIGURACAO_MAIS_VENDIDOS_PADRAO,
  ConfiguracaoMaisVendidos,
  normalizarConfiguracaoMaisVendidos,
} from '@/lib/vitrineMaisVendidos'
import {
  CHAVE_OFERTAS_VITRINE,
  CONFIGURACAO_OFERTAS_PADRAO,
  ConfiguracaoOfertas,
  normalizarConfiguracaoOfertas,
} from '@/lib/vitrineOfertas'

type ContrasteTexto = 'claro' | 'escuro'
type IntensidadeOverlay = 'sem_overlay' | 'suave' | 'forte'
type DestinoImagem = 'desktop' | 'mobile'
type AreaVitrine =
  | 'banners'
  | 'mais_vendidos'
  | 'ofertas'
  | 'resultados'
  | 'faixa_rodape'

type BannerVitrine = {
  id: string
  imagemDesktopUrl: string
  imagemMobileUrl: string
  proporcaoDesktop: number
  proporcaoMobile: number
  titulo: string
  subtitulo: string
  posicaoTexto: PosicaoTextoBanner
  contrasteTexto: ContrasteTexto
  overlay: IntensidadeOverlay
  ativo: boolean
}

type FormularioBanner = Omit<BannerVitrine, 'id'>

type ProdutoVitrineAdmin = {
  id: string
  nome: string
  categoria: string | null
  imagem_url: string | null
  preco: number
  preco_original: number | null
  desconto: number | null
  disponivel: boolean
}

const CHAVE_BANNERS_VITRINE = 'vitrine_banners_publicos'
const FORMULARIO_VAZIO: FormularioBanner = {
  imagemDesktopUrl: '',
  imagemMobileUrl: '',
  proporcaoDesktop: 21 / 8,
  proporcaoMobile: 4 / 5,
  titulo: '',
  subtitulo: '',
  posicaoTexto: 'inferior_esquerda',
  contrasteTexto: 'claro',
  overlay: 'suave',
  ativo: true,
}

const proporcaoValida = (valor: unknown, padrao: number) =>
  typeof valor === 'number' &&
  Number.isFinite(valor) &&
  valor >= 0.4 &&
  valor <= 4
    ? valor
    : padrao

const lerBanners = (valor: string | null | undefined): BannerVitrine[] => {
  if (!valor) return []

  try {
    const configuracao = JSON.parse(valor) as { banners?: unknown }
    if (!Array.isArray(configuracao.banners)) return []

    return configuracao.banners.flatMap((item, indice) => {
      if (!item || typeof item !== 'object') return []
      const banner = item as Record<string, unknown>
      const imagemLegada =
        typeof banner.imagemUrl === 'string' ? banner.imagemUrl.trim() : ''
      const imagemDesktopUrl =
        typeof banner.imagemDesktopUrl === 'string'
          ? banner.imagemDesktopUrl.trim()
          : imagemLegada
      if (!imagemDesktopUrl) return []

      return [
        {
          id:
            typeof banner.id === 'string' && banner.id
              ? banner.id
              : `banner-${indice}`,
          imagemDesktopUrl,
          imagemMobileUrl:
            typeof banner.imagemMobileUrl === 'string' &&
            banner.imagemMobileUrl.trim() !== imagemDesktopUrl
              ? banner.imagemMobileUrl.trim()
              : '',
          proporcaoDesktop: proporcaoValida(banner.proporcaoDesktop, 21 / 8),
          proporcaoMobile: proporcaoValida(banner.proporcaoMobile, 16 / 9),
          titulo: typeof banner.titulo === 'string' ? banner.titulo.trim() : '',
          subtitulo:
            typeof banner.subtitulo === 'string' ? banner.subtitulo.trim() : '',
          posicaoTexto: ehPosicaoTextoBanner(banner.posicaoTexto)
            ? banner.posicaoTexto
            : 'inferior_esquerda',
          contrasteTexto:
            banner.contrasteTexto === 'escuro' ? 'escuro' : 'claro',
          overlay: ['sem_overlay', 'suave', 'forte'].includes(
            String(banner.overlay),
          )
            ? (banner.overlay as IntensidadeOverlay)
            : 'suave',
          ativo: banner.ativo !== false,
        },
      ]
    })
  } catch {
    return []
  }
}

const criarIdBanner = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `banner-${Date.now()}`
}

export default function VitrinePage() {
  const [areaAtiva, setAreaAtiva] = useState<AreaVitrine>('banners')
  const [banners, setBanners] = useState<BannerVitrine[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [bannerEmEdicaoId, setBannerEmEdicaoId] = useState<string | null>(null)
  const [formulario, setFormulario] =
    useState<FormularioBanner>(FORMULARIO_VAZIO)
  const [bannerParaExcluir, setBannerParaExcluir] =
    useState<BannerVitrine | null>(null)
  const [recorteAberto, setRecorteAberto] = useState(false)
  const [imagemParaRecorte, setImagemParaRecorte] = useState('')
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [destinoImagem, setDestinoImagem] = useState<DestinoImagem>('desktop')
  const [previewTelaBanner, setPreviewTelaBanner] =
    useState<DestinoImagem>('desktop')
  const [configuracaoMaisVendidos, setConfiguracaoMaisVendidos] =
    useState<ConfiguracaoMaisVendidos>(CONFIGURACAO_MAIS_VENDIDOS_PADRAO)
  const [produtosCatalogo, setProdutosCatalogo] = useState<
    ProdutoVitrineAdmin[]
  >([])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [salvandoMaisVendidos, setSalvandoMaisVendidos] = useState(false)
  const [configuracaoOfertas, setConfiguracaoOfertas] =
    useState<ConfiguracaoOfertas>(CONFIGURACAO_OFERTAS_PADRAO)
  const inputImagemRef = useRef<HTMLInputElement>(null)

  const bannersPublicados = useMemo(
    () => banners.filter((banner) => banner.ativo).length,
    [banners],
  )

  const produtosSelecionados = useMemo(
    () =>
      configuracaoMaisVendidos.produtoIds.flatMap((produtoId) => {
        const produto = produtosCatalogo.find((item) => item.id === produtoId)
        return produto ? [produto] : []
      }),
    [configuracaoMaisVendidos.produtoIds, produtosCatalogo],
  )

  const produtosDisponiveis = useMemo(() => {
    const termo = buscaProduto.trim().toLocaleLowerCase('pt-BR')
    return produtosCatalogo
      .filter(
        (produto) =>
          !configuracaoMaisVendidos.produtoIds.includes(produto.id) &&
          (!termo ||
            produto.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
            produto.categoria?.toLocaleLowerCase('pt-BR').includes(termo)),
      )
      .slice(0, 8)
  }, [buscaProduto, configuracaoMaisVendidos.produtoIds, produtosCatalogo])

  const carregarBanners = useCallback(async () => {
    setCarregando(true)
    try {
      const [resultadoConfiguracoes, resultadoProdutos] = await Promise.all([
        supabase
          .from('configuracoes_loja')
          .select('chave, valor')
          .in('chave', [
            CHAVE_BANNERS_VITRINE,
            CHAVE_MAIS_VENDIDOS_VITRINE,
            CHAVE_OFERTAS_VITRINE,
          ]),
        supabase
          .from('produtos')
          .select(
            'id, nome, categoria, imagem_url, preco, preco_original, desconto, disponivel',
          )
          .eq('disponivel', true)
          .order('nome', { ascending: true }),
      ])

      if (resultadoConfiguracoes.error) throw resultadoConfiguracoes.error
      if (resultadoProdutos.error) throw resultadoProdutos.error

      const configuracoes = resultadoConfiguracoes.data || []
      setBanners(
        lerBanners(
          configuracoes.find(
            (configuracao) => configuracao.chave === CHAVE_BANNERS_VITRINE,
          )?.valor,
        ),
      )
      const produtosDisponiveisAgora = (resultadoProdutos.data ||
        []) as ProdutoVitrineAdmin[]
      const idsDisponiveis = new Set(
        produtosDisponiveisAgora.map((produto) => produto.id),
      )
      const configuracaoCarregada = normalizarConfiguracaoMaisVendidos(
        configuracoes.find(
          (configuracao) =>
            configuracao.chave === CHAVE_MAIS_VENDIDOS_VITRINE,
        )?.valor,
      )
      setConfiguracaoMaisVendidos({
        ...configuracaoCarregada,
        produtoIds: configuracaoCarregada.produtoIds.filter((produtoId) =>
          idsDisponiveis.has(produtoId),
        ),
      })
      const ofertasCarregadas = normalizarConfiguracaoOfertas(
        configuracoes.find(
          (configuracao) => configuracao.chave === CHAVE_OFERTAS_VITRINE,
        )?.valor,
      )
      setConfiguracaoOfertas({
        ...ofertasCarregadas,
        produtoIds: ofertasCarregadas.produtoIds.filter((produtoId) =>
          idsDisponiveis.has(produtoId),
        ),
      })
      setProdutosCatalogo(produtosDisponiveisAgora)
    } catch (erro) {
      console.error('Erro ao carregar banners da vitrine:', erro)
      toast.error('Não foi possível carregar a vitrine')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarBanners()
  }, [carregarBanners])

  const abrirNovoBanner = () => {
    setBannerEmEdicaoId(null)
    setFormulario(FORMULARIO_VAZIO)
    setPreviewTelaBanner('desktop')
    setModalAberto(true)
  }

  const abrirEdicaoBanner = (banner: BannerVitrine) => {
    setBannerEmEdicaoId(banner.id)
    setPreviewTelaBanner('desktop')
    setFormulario({
      imagemDesktopUrl: banner.imagemDesktopUrl,
      imagemMobileUrl: banner.imagemMobileUrl,
      proporcaoDesktop: banner.proporcaoDesktop,
      proporcaoMobile: banner.proporcaoMobile,
      titulo: banner.titulo,
      subtitulo: banner.subtitulo,
      posicaoTexto: banner.posicaoTexto,
      contrasteTexto: banner.contrasteTexto,
      overlay: banner.overlay,
      ativo: banner.ativo,
    })
    setModalAberto(true)
  }

  const abrirSeletorImagem = (destino: DestinoImagem) => {
    setDestinoImagem(destino)
    inputImagemRef.current?.click()
  }

  const abrirFluxoRecorte = (imagemUrl: string) => {
    setImagemParaRecorte(imagemUrl)
    setModalAberto(false)
    setRecorteAberto(true)
  }

  const fecharRecorteEVoltarAoFormulario = () => {
    setRecorteAberto(false)
    setImagemParaRecorte('')
    setModalAberto(true)
  }

  const selecionarImagem = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return

    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      toast.warning(validacao.erro || 'Selecione uma imagem válida')
      return
    }

    try {
      abrirFluxoRecorte(await arquivoParaUrl(arquivo))
    } catch {
      toast.error('Não foi possível abrir esta imagem')
    }
  }

  const abrirRecorteImagemAtual = (destino: DestinoImagem) => {
    const imagemUrl =
      destino === 'desktop'
        ? formulario.imagemDesktopUrl
        : formulario.imagemMobileUrl || formulario.imagemDesktopUrl
    if (!imagemUrl) return
    setDestinoImagem(destino)
    const urlPublica = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || ''
    const prefixoPublico = urlPublica ? `${urlPublica}/` : ''
    const chaveArquivo =
      prefixoPublico && imagemUrl.startsWith(prefixoPublico)
        ? imagemUrl.slice(prefixoPublico.length)
        : null
    abrirFluxoRecorte(
      chaveArquivo
        ? `/api/upload?arquivo=${encodeURIComponent(chaveArquivo)}`
        : imagemUrl,
    )
  }

  const confirmarRecorteImagem = async (_base64: string, blob: Blob) => {
    fecharRecorteEVoltarAoFormulario()
    setEnviandoImagem(true)
    try {
      const arquivoRecortado = new File(
        [blob],
        `banner-${Date.now()}.${blob.type === 'image/png' ? 'png' : 'jpg'}`,
        { type: blob.type || 'image/jpeg' },
      )
      const resultado = await uploadImagemB2(arquivoRecortado, 'vitrine')
      if (!resultado.sucesso || !resultado.url) {
        throw new Error(resultado.erro || 'Falha no upload')
      }

      const proporcao = await new Promise<number>((resolve) => {
        const urlTemporaria = URL.createObjectURL(blob)
        const imagem = new window.Image()
        imagem.onload = () => {
          const valor = imagem.naturalWidth / imagem.naturalHeight
          URL.revokeObjectURL(urlTemporaria)
          resolve(
            proporcaoValida(
              valor,
              destinoImagem === 'desktop' ? 21 / 8 : 4 / 5,
            ),
          )
        }
        imagem.onerror = () => {
          URL.revokeObjectURL(urlTemporaria)
          resolve(destinoImagem === 'desktop' ? 21 / 8 : 4 / 5)
        }
        imagem.src = urlTemporaria
      })

      setFormulario((estadoAtual) =>
        destinoImagem === 'desktop'
          ? {
              ...estadoAtual,
              imagemDesktopUrl: resultado.url || '',
              proporcaoDesktop: proporcao,
            }
          : {
              ...estadoAtual,
              imagemMobileUrl: resultado.url || '',
              proporcaoMobile: proporcao,
            },
      )
      toast.success('Imagem ajustada', {
        description:
          destinoImagem === 'desktop'
            ? 'A versão para telas grandes está pronta.'
            : 'A versão para celulares está pronta.',
      })
    } catch (erro) {
      toast.error(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível enviar a imagem',
      )
    } finally {
      setEnviandoImagem(false)
    }
  }

  const persistirBanners = useCallback(
    async (
      proximosBanners: BannerVitrine[],
      mensagemSucesso: string,
    ): Promise<boolean> => {
      setSalvando(true)
      try {
        const { error } = await supabase.from('configuracoes_loja').upsert(
          {
            chave: CHAVE_BANNERS_VITRINE,
            valor: JSON.stringify({ banners: proximosBanners }),
            tipo: 'json',
            descricao:
              'Banners horizontais e textos exibidos na vitrine pública.',
          },
          { onConflict: 'chave' },
        )

        if (error) throw error
        setBanners(proximosBanners)
        toast.success(mensagemSucesso, {
          description: 'A alteração já está disponível no site.',
        })
        return true
      } catch (erro) {
        console.error('Erro ao salvar banners da vitrine:', erro)
        toast.error('Não foi possível atualizar a vitrine')
        return false
      } finally {
        setSalvando(false)
      }
    },
    [],
  )

  const salvarBanner = async () => {
    if (!formulario.imagemDesktopUrl.trim()) {
      toast.warning('Adicione a imagem principal para continuar')
      return
    }

    const dadosNormalizados: FormularioBanner = {
      imagemDesktopUrl: formulario.imagemDesktopUrl.trim(),
      imagemMobileUrl: formulario.imagemMobileUrl.trim(),
      proporcaoDesktop: formulario.proporcaoDesktop,
      proporcaoMobile: formulario.proporcaoMobile,
      titulo: formulario.titulo.trim(),
      subtitulo: formulario.subtitulo.trim(),
      posicaoTexto: formulario.posicaoTexto,
      contrasteTexto: formulario.contrasteTexto,
      overlay: formulario.overlay,
      ativo: formulario.ativo,
    }

    const proximosBanners = bannerEmEdicaoId
      ? banners.map((banner) =>
          banner.id === bannerEmEdicaoId
            ? { ...banner, ...dadosNormalizados }
            : banner,
        )
      : [...banners, { id: criarIdBanner(), ...dadosNormalizados }]

    const salvou = await persistirBanners(
      proximosBanners,
      bannerEmEdicaoId ? 'Banner atualizado' : 'Banner publicado',
    )
    if (salvou) setModalAberto(false)
  }

  const moverBanner = async (indice: number, direcao: -1 | 1) => {
    const novoIndice = indice + direcao
    if (novoIndice < 0 || novoIndice >= banners.length) return

    const proximosBanners = [...banners]
    const [banner] = proximosBanners.splice(indice, 1)
    proximosBanners.splice(novoIndice, 0, banner)
    await persistirBanners(proximosBanners, 'Ordem atualizada')
  }

  const alternarVisibilidade = async (id: string) => {
    const bannerAlterado = banners.find((banner) => banner.id === id)
    if (!bannerAlterado) return

    const proximosBanners = banners.map((banner) =>
      banner.id === id ? { ...banner, ativo: !banner.ativo } : banner,
    )
    await persistirBanners(
      proximosBanners,
      bannerAlterado.ativo ? 'Banner ocultado' : 'Banner publicado',
    )
  }

  const confirmarExclusao = async () => {
    if (!bannerParaExcluir) return
    const proximosBanners = banners.filter(
      (banner) => banner.id !== bannerParaExcluir.id,
    )
    const salvou = await persistirBanners(proximosBanners, 'Banner excluído')
    if (salvou) setBannerParaExcluir(null)
  }

  const adicionarProdutoMaisVendido = (produtoId: string) => {
    setConfiguracaoMaisVendidos((configuracaoAtual) => ({
      ...configuracaoAtual,
      produtoIds: [...configuracaoAtual.produtoIds, produtoId].slice(0, 12),
    }))
  }

  const removerProdutoMaisVendido = (produtoId: string) => {
    setConfiguracaoMaisVendidos((configuracaoAtual) => ({
      ...configuracaoAtual,
      produtoIds: configuracaoAtual.produtoIds.filter(
        (idAtual) => idAtual !== produtoId,
      ),
    }))
  }

  const moverProdutoMaisVendido = (indice: number, direcao: -1 | 1) => {
    const novoIndice = indice + direcao
    if (
      novoIndice < 0 ||
      novoIndice >= configuracaoMaisVendidos.produtoIds.length
    )
      return

    setConfiguracaoMaisVendidos((configuracaoAtual) => {
      const produtoIds = [...configuracaoAtual.produtoIds]
      const [produtoId] = produtoIds.splice(indice, 1)
      produtoIds.splice(novoIndice, 0, produtoId)
      return { ...configuracaoAtual, produtoIds }
    })
  }

  const salvarConfiguracaoMaisVendidos = async () => {
    if (
      configuracaoMaisVendidos.modo === 'manual' &&
      configuracaoMaisVendidos.ativo &&
      configuracaoMaisVendidos.produtoIds.length === 0
    ) {
      toast.warning('Escolha pelo menos um produto para publicar a seleção')
      return
    }

    setSalvandoMaisVendidos(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_MAIS_VENDIDOS_VITRINE,
          valor: JSON.stringify(configuracaoMaisVendidos),
          tipo: 'json',
          descricao:
            'Modo, quantidade e seleção manual de produtos mais vendidos da vitrine pública.',
        },
        { onConflict: 'chave' },
      )

      if (error) throw error
      toast.success('Mais vendidos atualizado', {
        description: 'A seleção já está disponível no site.',
      })
    } catch (erro) {
      console.error('Erro ao salvar produtos mais vendidos:', erro)
      toast.error('Não foi possível salvar a seleção')
    } finally {
      setSalvandoMaisVendidos(false)
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-28 pt-6 sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="size-5" strokeWidth={1.8} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Vitrine
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Escolha uma área para organizar o que seus clientes veem na
                loja.
              </p>
            </div>
            {areaAtiva === 'banners' ? (
              <Button
                type="button"
                onClick={abrirNovoBanner}
                disabled={salvando}
                className="min-h-11"
              >
                <Plus className="size-4" />
                Adicionar banner
              </Button>
            ) : null}
          </header>

          <nav
            className="grid w-full grid-cols-2 rounded-lg border border-border bg-muted/30 p-1 sm:grid-cols-3 lg:w-fit lg:grid-cols-5"
            aria-label="Áreas da vitrine"
            role="tablist"
          >
            {(
              [
                { id: 'banners', nome: 'Banners', Icone: ImageIcon },
                {
                  id: 'mais_vendidos',
                  nome: 'Mais vendidos',
                  Icone: PackageSearch,
                },
                { id: 'ofertas', nome: 'Ofertas', Icone: BadgePercent },
                { id: 'resultados', nome: 'Studio', Icone: Sparkles },
                { id: 'faixa_rodape', nome: 'Cabeçalho', Icone: Megaphone },
              ] as const
            ).map(({ id, nome, Icone }) => {
              const selecionada = areaAtiva === id
              return (
                <button
                  key={id}
                  id={`aba-vitrine-${id}`}
                  type="button"
                  onClick={() => setAreaAtiva(id)}
                  className={cn(
                    'flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 sm:text-sm',
                    selecionada
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  role="tab"
                  aria-selected={selecionada}
                  aria-controls={`painel-vitrine-${id}`}
                >
                  <Icone className="size-4 shrink-0" aria-hidden />
                  {nome}
                </button>
              )
            })}
          </nav>

          {areaAtiva === 'banners' ? (
            <div
              id="painel-vitrine-banners"
              role="tabpanel"
              aria-labelledby="aba-vitrine-banners"
              className="space-y-6"
            >
              <section
                className="grid gap-3 sm:grid-cols-3"
                aria-label="Resumo da vitrine"
              >
            <Card className="border-border/70 shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Banners cadastrados
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {banners.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Publicados no site
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {bannersPublicados}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-none">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Formato recomendado
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Desktop horizontal · celular 4:5 ou 9:16
                </p>
              </CardContent>
            </Card>
              </section>

              <Card className="border-border/70 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 pb-4">
              <CardTitle className="text-base">Banners</CardTitle>
              {salvando && (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Salvando...
                </span>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Carregando vitrine...
                </div>
              ) : banners.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImageIcon className="size-6" strokeWidth={1.6} />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">
                    Sua vitrine ainda está vazia
                  </h2>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Adicione o primeiro banner para destacar linhas, kits ou
                    promoções no catálogo.
                  </p>
                  <Button
                    type="button"
                    className="mt-5 min-h-11"
                    onClick={abrirNovoBanner}
                  >
                    <Plus className="size-4" />
                    Adicionar primeiro banner
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/70">
                  {banners.map((banner, indice) => (
                    <article
                      key={banner.id}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="relative aspect-[16/8] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-52">
                        <Image
                          src={banner.imagemDesktopUrl}
                          alt=""
                          fill
                          sizes="208px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            {banner.titulo || 'Sem frase principal'}
                          </h2>
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-xs font-medium',
                              banner.ativo
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {banner.ativo ? 'Publicado' : 'Oculto'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {banner.subtitulo || 'Sem texto complementar'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 border-t border-border/70 pt-3 sm:border-t-0 sm:pt-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => void moverBanner(indice, -1)}
                          disabled={salvando || indice === 0}
                          aria-label="Mover banner para cima"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => void moverBanner(indice, 1)}
                          disabled={salvando || indice === banners.length - 1}
                          aria-label="Mover banner para baixo"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => void alternarVisibilidade(banner.id)}
                          disabled={salvando}
                          aria-label={
                            banner.ativo ? 'Ocultar banner' : 'Publicar banner'
                          }
                        >
                          {banner.ativo ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11"
                          onClick={() => abrirEdicaoBanner(banner)}
                          disabled={salvando}
                          aria-label="Editar banner"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 text-destructive hover:text-destructive"
                          onClick={() => setBannerParaExcluir(banner)}
                          disabled={salvando}
                          aria-label="Excluir banner"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
              </Card>
            </div>
          ) : null}

          {areaAtiva === 'mais_vendidos' ? (
            <div
              id="painel-vitrine-mais_vendidos"
              role="tabpanel"
              aria-labelledby="aba-vitrine-mais_vendidos"
            >
              <Card className="border-border/70 shadow-none">
            <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Produtos mais vendidos</CardTitle>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Defina quais produtos ganham destaque logo no início da loja.
                </p>
              </div>
              <Button
                type="button"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => void salvarConfiguracaoMaisVendidos()}
                disabled={salvandoMaisVendidos}
              >
                {salvandoMaisVendidos && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Salvar seleção
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <fieldset>
                  <legend className="text-sm font-medium text-foreground">
                    Como escolher os produtos
                  </legend>
                  <div className="mt-2 grid grid-cols-2 rounded-lg border border-border bg-muted/30 p-1">
                    {(
                      [
                        {
                          valor: 'automatico',
                          titulo: 'Automático',
                          descricao: 'Usa as vendas reais',
                        },
                        {
                          valor: 'manual',
                          titulo: 'Manual',
                          descricao: 'Você escolhe e ordena',
                        },
                      ] as const
                    ).map((opcao) => {
                      const selecionado =
                        configuracaoMaisVendidos.modo === opcao.valor
                      return (
                        <button
                          key={opcao.valor}
                          type="button"
                          onClick={() =>
                            setConfiguracaoMaisVendidos(
                              (configuracaoAtual) => ({
                                ...configuracaoAtual,
                                modo: opcao.valor,
                              }),
                            )
                          }
                          className={cn(
                            'min-h-14 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selecionado
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                          aria-pressed={selecionado}
                        >
                          <span className="block text-sm font-semibold">
                            {opcao.titulo}
                          </span>
                          <span className="block text-xs">{opcao.descricao}</span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="quantidade-mais-vendidos">
                    Quantidade no site
                  </Label>
                  <Select
                    value={String(configuracaoMaisVendidos.quantidade)}
                    onValueChange={(valor) =>
                      setConfiguracaoMaisVendidos((configuracaoAtual) => ({
                        ...configuracaoAtual,
                        quantidade: Number(valor),
                      }))
                    }
                  >
                    <SelectTrigger
                      id="quantidade-mais-vendidos"
                      className="min-h-11 shadow-none"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8, 10, 12].map((quantidade) => (
                        <SelectItem key={quantidade} value={String(quantidade)}>
                          {quantidade} produtos
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Exibir seção no site
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    Ao ocultar, a configuração fica salva para uso posterior.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={configuracaoMaisVendidos.ativo}
                  onChange={(event) =>
                    setConfiguracaoMaisVendidos((configuracaoAtual) => ({
                      ...configuracaoAtual,
                      ativo: event.target.checked,
                    }))
                  }
                  className="size-4 shrink-0 accent-primary"
                />
              </label>

              {configuracaoMaisVendidos.modo === 'automatico' ? (
                <div className="flex gap-3 rounded-lg border border-border/70 bg-muted/25 p-4">
                  <PackageSearch
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Ranking atualizado pelas vendas
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      O site soma as unidades vendidas em pedidos válidos de
                      entrega e retirada. Cancelamentos e pagamentos pendentes
                      não entram no cálculo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Ordem de exibição
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O primeiro produto será o primeiro destaque visto pelo
                      cliente.
                    </p>
                    {produtosSelecionados.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        Nenhum produto selecionado.
                      </div>
                    ) : (
                      <div className="mt-3 divide-y divide-border/70 rounded-lg border border-border/70">
                        {produtosSelecionados.map((produto, indice) => (
                          <div
                            key={produto.id}
                            className="flex min-w-0 items-center gap-3 p-3"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                              {indice + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {produto.nome}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {produto.categoria || 'Sem categoria'}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                onClick={() =>
                                  moverProdutoMaisVendido(indice, -1)
                                }
                                disabled={indice === 0}
                                aria-label={`Mover ${produto.nome} para cima`}
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                onClick={() =>
                                  moverProdutoMaisVendido(indice, 1)
                                }
                                disabled={
                                  indice === produtosSelecionados.length - 1
                                }
                                aria-label={`Mover ${produto.nome} para baixo`}
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-11 text-destructive hover:text-destructive"
                                onClick={() =>
                                  removerProdutoMaisVendido(produto.id)
                                }
                                aria-label={`Remover ${produto.nome} da seleção`}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="buscar-produto-destaque">
                      Adicionar produto
                    </Label>
                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="buscar-produto-destaque"
                        value={buscaProduto}
                        onChange={(event) => setBuscaProduto(event.target.value)}
                        placeholder="Buscar por nome ou categoria"
                        className="min-h-11 pl-10"
                      />
                    </div>
                    <div className="mt-2 divide-y divide-border/70 rounded-lg border border-border/70">
                      {produtosDisponiveis.length === 0 ? (
                        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                          Nenhum outro produto disponível.
                        </p>
                      ) : (
                        produtosDisponiveis.map((produto) => (
                          <button
                            key={produto.id}
                            type="button"
                            onClick={() =>
                              adicionarProdutoMaisVendido(produto.id)
                            }
                            className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {produto.nome}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {produto.categoria || 'Sem categoria'}
                              </p>
                            </div>
                            <Plus className="size-4 shrink-0 text-primary" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
              </Card>
            </div>
          ) : null}

          {areaAtiva === 'resultados' ? (
            <div
              id="painel-vitrine-resultados"
              role="tabpanel"
              aria-labelledby="aba-vitrine-resultados"
            >
              <EditorResultadosStudio />
            </div>
          ) : null}

          {areaAtiva === 'ofertas' ? (
            <div
              id="painel-vitrine-ofertas"
              role="tabpanel"
              aria-labelledby="aba-vitrine-ofertas"
            >
              <EditorOfertas
                key={JSON.stringify(configuracaoOfertas)}
                configuracaoInicial={configuracaoOfertas}
                produtos={produtosCatalogo}
                onConfiguracaoSalva={setConfiguracaoOfertas}
                onProdutoAtualizado={(produtoId, atualizacao) =>
                  setProdutosCatalogo((produtosAtuais) =>
                    produtosAtuais.map((produtoAtual) =>
                      produtoAtual.id === produtoId
                        ? { ...produtoAtual, ...atualizacao }
                        : produtoAtual,
                    ),
                  )
                }
              />
            </div>
          ) : null}

          {areaAtiva === 'faixa_rodape' ? (
            <div
              id="painel-vitrine-faixa_rodape"
              role="tabpanel"
              aria-labelledby="aba-vitrine-faixa_rodape"
            >
              <EditorFaixaRodape />
            </div>
          ) : null}
        </main>

        {modalAberto && (
          <Dialog
            open
            onOpenChange={(aberto) => !aberto && setModalAberto(false)}
          >
            <DialogContent
              className="flex h-[100dvh] max-h-[100dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[92dvh]"
              showCloseButton
            >
              <DialogHeader className="shrink-0 border-b border-border/70 px-5 pb-4 pt-5 pr-12 text-left">
                <DialogTitle>
                  {bannerEmEdicaoId ? 'Editar banner' : 'Novo banner'}
                </DialogTitle>
                <DialogDescription>
                  Prepare cada tela separadamente e revise o resultado antes de
                  publicar.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
                  <section
                    className="space-y-4"
                    aria-labelledby="midias-banner"
                  >
                    <div>
                      <h3
                        id="midias-banner"
                        className="text-sm font-semibold text-foreground"
                      >
                        Imagens por tela
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Use uma arte ampla no desktop e, se quiser, outra
                        composição no celular. A versão desktop será usada como
                        fallback.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Monitor className="size-4 text-muted-foreground" />
                          <Label>Desktop *</Label>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Recomendado 21:8
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => abrirSeletorImagem('desktop')}
                        disabled={enviandoImagem}
                        className="group relative w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                        style={{
                          aspectRatio: String(formulario.proporcaoDesktop),
                        }}
                        aria-label={
                          formulario.imagemDesktopUrl
                            ? 'Trocar imagem para desktop'
                            : 'Selecionar imagem para desktop'
                        }
                      >
                        {formulario.imagemDesktopUrl ? (
                          <Image
                            src={formulario.imagemDesktopUrl}
                            alt=""
                            fill
                            sizes="720px"
                            className="object-contain"
                          />
                        ) : (
                          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
                            <Camera className="size-6" strokeWidth={1.7} />
                            Selecionar imagem
                          </span>
                        )}
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => abrirSeletorImagem('desktop')}
                          disabled={enviandoImagem}
                        >
                          <Camera className="size-4" />
                          {formulario.imagemDesktopUrl ? 'Trocar' : 'Escolher'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => abrirRecorteImagemAtual('desktop')}
                          disabled={
                            !formulario.imagemDesktopUrl || enviandoImagem
                          }
                        >
                          <Crop className="size-4" />
                          Recortar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="size-4 text-muted-foreground" />
                          <Label>Celular</Label>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formulario.imagemMobileUrl
                            ? 'Versão própria · 4:5 ou 9:16'
                            : 'Fallback horizontal automático'}
                        </span>
                      </div>
                      <div className="flex min-h-48 justify-center rounded-md bg-muted/20 p-2">
                        <button
                          type="button"
                          onClick={() => abrirSeletorImagem('mobile')}
                          disabled={enviandoImagem}
                          className={cn(
                            'group relative max-h-[30rem] w-full overflow-hidden rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70',
                            formulario.imagemMobileUrl ? 'max-w-xs' : 'max-w-full',
                          )}
                          style={{
                            aspectRatio: String(
                              formulario.imagemMobileUrl
                                ? formulario.proporcaoMobile
                                : formulario.proporcaoDesktop,
                            ),
                          }}
                          aria-label={
                            formulario.imagemMobileUrl
                              ? 'Trocar imagem para celular'
                              : 'Selecionar imagem para celular'
                          }
                        >
                          {formulario.imagemMobileUrl || formulario.imagemDesktopUrl ? (
                            <>
                            <Image
                              src={
                                formulario.imagemMobileUrl ||
                                formulario.imagemDesktopUrl
                              }
                              alt=""
                              fill
                              sizes="320px"
                              className="object-contain"
                            />
                              {!formulario.imagemMobileUrl ? (
                                <span className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-foreground backdrop-blur">
                                  Adaptação da arte desktop
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm">
                              <Smartphone
                                className="size-6"
                                strokeWidth={1.7}
                              />
                              Adicionar versão mobile
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => abrirSeletorImagem('mobile')}
                          disabled={enviandoImagem}
                        >
                          <Camera className="size-4" />
                          {formulario.imagemMobileUrl ? 'Trocar' : 'Adicionar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => abrirRecorteImagemAtual('mobile')}
                          disabled={
                            !formulario.imagemDesktopUrl || enviandoImagem
                          }
                        >
                          <Crop className="size-4" />
                          {formulario.imagemMobileUrl
                            ? 'Recortar'
                            : 'Criar do desktop'}
                        </Button>
                      </div>
                      {formulario.imagemMobileUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="min-h-11 w-full text-muted-foreground"
                          onClick={() =>
                            setFormulario((estadoAtual) => ({
                              ...estadoAtual,
                              imagemMobileUrl: '',
                            }))
                          }
                          disabled={enviandoImagem}
                        >
                          Usar a imagem desktop no celular
                        </Button>
                      )}
                    </div>
                  </section>

                  <section
                    className="space-y-5"
                    aria-labelledby="conteudo-banner"
                  >
                    <div>
                      <h3
                        id="conteudo-banner"
                        className="text-sm font-semibold text-foreground"
                      >
                        Texto sobre a imagem
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Deixe os campos vazios se a frase já fizer parte da
                        arte.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="banner-titulo">Frase principal</Label>
                      <textarea
                        id="banner-titulo"
                        value={formulario.titulo}
                        onChange={(event) =>
                          setFormulario((estadoAtual) => ({
                            ...estadoAtual,
                            titulo: event.target.value.slice(0, 240),
                          }))
                        }
                        maxLength={240}
                        rows={4}
                        placeholder={'Ex.: Entregas em Porto em até 24h\nNossa Senhora dos Remédios toda semana'}
                        className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>Opcional · Enter cria uma nova linha</span>
                        <span className="tabular-nums">{formulario.titulo.length}/240</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="banner-subtitulo">
                        Texto complementar
                      </Label>
                      <textarea
                        id="banner-subtitulo"
                        value={formulario.subtitulo}
                        onChange={(event) =>
                          setFormulario((estadoAtual) => ({
                            ...estadoAtual,
                            subtitulo: event.target.value.slice(0, 140),
                          }))
                        }
                        placeholder="Ex.: Encontre produtos para cada etapa da sua rotina."
                        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground">
                        Opcional · até 140 caracteres
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Posição do texto</Label>
                      <Select
                        value={formulario.posicaoTexto}
                        onValueChange={(valor: PosicaoTextoBanner) =>
                          setFormulario((estadoAtual) => ({
                            ...estadoAtual,
                            posicaoTexto: valor,
                          }))
                        }
                      >
                        <SelectTrigger className="min-h-11 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POSICOES_TEXTO_BANNER.map((posicao) => (
                            <SelectItem key={posicao} value={posicao}>
                              {POSICAO_TEXTO_BANNER_ROTULOS[posicao]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Cor do texto</Label>
                        <Select
                          value={formulario.contrasteTexto}
                          onValueChange={(valor: ContrasteTexto) =>
                            setFormulario((estadoAtual) => ({
                              ...estadoAtual,
                              contrasteTexto: valor,
                            }))
                          }
                        >
                          <SelectTrigger className="min-h-11 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="claro">Claro</SelectItem>
                            <SelectItem value="escuro">Escuro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Contraste da foto</Label>
                        <Select
                          value={formulario.overlay}
                          onValueChange={(valor: IntensidadeOverlay) =>
                            setFormulario((estadoAtual) => ({
                              ...estadoAtual,
                              overlay: valor,
                            }))
                          }
                        >
                          <SelectTrigger className="min-h-11 shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sem_overlay">
                              Sem camada
                            </SelectItem>
                            <SelectItem value="suave">Suave</SelectItem>
                            <SelectItem value="forte">Forte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formulario.imagemDesktopUrl && (
                      <div className="space-y-2">
                        <div className="flex min-h-11 items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {previewTelaBanner === 'desktop' ? (
                              <Monitor className="size-4 text-muted-foreground" />
                            ) : (
                              <Smartphone className="size-4 text-muted-foreground" />
                            )}
                            <div>
                              <Label>Prévia no site</Label>
                              <p
                                className="text-xs text-muted-foreground"
                                aria-live="polite"
                              >
                                {previewTelaBanner === 'desktop'
                                  ? 'Desktop'
                                  : formulario.imagemMobileUrl
                                    ? 'Celular'
                                    : 'Celular · usando imagem desktop'}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11 shrink-0"
                            onClick={() =>
                              setPreviewTelaBanner((telaAtual) =>
                                telaAtual === 'desktop' ? 'mobile' : 'desktop',
                              )
                            }
                            aria-label={
                              previewTelaBanner === 'desktop'
                                ? 'Ver prévia para celular'
                                : 'Ver prévia para desktop'
                            }
                          >
                            <ArrowRight className="size-4" />
                          </Button>
                        </div>
                        <div
                          className={cn(
                            'relative mx-auto max-h-[30rem] w-full overflow-hidden rounded-md bg-muted',
                            previewTelaBanner === 'mobile'
                              ? 'max-w-xs'
                              : 'max-w-full',
                          )}
                          style={{
                            aspectRatio: String(
                              previewTelaBanner === 'mobile' &&
                                formulario.imagemMobileUrl
                                ? formulario.proporcaoMobile
                                : formulario.proporcaoDesktop,
                            ),
                          }}
                        >
                          <Image
                            src={
                              previewTelaBanner === 'mobile' &&
                              formulario.imagemMobileUrl
                                ? formulario.imagemMobileUrl
                                : formulario.imagemDesktopUrl
                            }
                            alt=""
                            fill
                            sizes={
                              previewTelaBanner === 'mobile' ? '320px' : '720px'
                            }
                            className="object-contain"
                          />
                          {formulario.overlay !== 'sem_overlay' && (
                            <div
                              className={cn(
                                'absolute inset-0',
                                formulario.contrasteTexto === 'claro'
                                  ? formulario.overlay === 'forte'
                                    ? 'bg-black/50'
                                    : 'bg-black/25'
                                  : formulario.overlay === 'forte'
                                    ? 'bg-white/60'
                                    : 'bg-white/30',
                              )}
                            />
                          )}
                          <div
                            className={cn(
                              'fortes-text absolute inset-0 flex p-4',
                              POSICAO_TEXTO_BANNER_CLASSES[formulario.posicaoTexto],
                            )}
                          >
                            <div
                              className={cn(
                                'max-w-[90%]',
                                formulario.contrasteTexto === 'claro'
                                  ? 'text-white'
                                  : 'text-foreground',
                              )}
                            >
                              {formulario.titulo && (
                                <p className="fortes-display whitespace-pre-line text-2xl leading-none">
                                  {formulario.titulo}
                                </p>
                              )}
                              {formulario.subtitulo && (
                                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">
                                  {formulario.subtitulo}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-3 py-2">
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          Publicar no site
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Banners ocultos ficam guardados, mas não aparecem para
                          clientes.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={formulario.ativo}
                        onChange={(event) =>
                          setFormulario((estadoAtual) => ({
                            ...estadoAtual,
                            ativo: event.target.checked,
                          }))
                        }
                        className="size-4 accent-primary"
                      />
                    </label>
                  </section>
                </div>

                {enviandoImagem && (
                  <div className="sticky bottom-2 mt-4 flex items-center justify-center gap-2 rounded-lg border border-border bg-background/95 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur">
                    <Loader2 className="size-4 animate-spin" />
                    Processando e enviando imagem...
                  </div>
                )}
              </div>
              <DialogFooter className="shrink-0 border-t border-border/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setModalAberto(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => void salvarBanner()}
                  disabled={salvando || enviandoImagem}
                >
                  {salvando && <Loader2 className="size-4 animate-spin" />}
                  {bannerEmEdicaoId ? 'Salvar banner' : 'Publicar banner'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <input
          ref={inputImagemRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => void selecionarImagem(event)}
          className="hidden"
          aria-hidden="true"
        />

        {recorteAberto && (
          <ModalRecorteImagem
            aberto
            imagemUrl={imagemParaRecorte}
            onFechar={fecharRecorteEVoltarAoFormulario}
            onConfirmar={confirmarRecorteImagem}
            proporcaoInicial={
              destinoImagem === 'desktop'
                ? formulario.proporcaoDesktop
                : formulario.proporcaoMobile
            }
            titulo={
              destinoImagem === 'desktop'
                ? 'Recortar imagem para desktop'
                : 'Recortar imagem para celular'
            }
            modoPreview="banner"
            previewTitulo={formulario.titulo}
            previewSubtitulo={formulario.subtitulo}
            previewPosicaoTexto={formulario.posicaoTexto}
            previewContrasteTexto={formulario.contrasteTexto}
            previewOverlay={formulario.overlay}
            destinoBanner={destinoImagem}
          />
        )}

        <AlertDialog
          open={Boolean(bannerParaExcluir)}
          onOpenChange={(aberto) => !aberto && setBannerParaExcluir(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este banner?</AlertDialogTitle>
              <AlertDialogDescription>
                Ele será removido da vitrine assim que você confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void confirmarExclusao()}
                disabled={salvando}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {salvando && <Loader2 className="size-4 animate-spin" />}
                Excluir banner
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}
