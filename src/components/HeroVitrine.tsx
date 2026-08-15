'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Image, { getImageProps } from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  FONTE_TEXTO_BANNER_CLASSES,
  PESO_TITULO_BANNER_CLASSES,
  POSICAO_TEXTO_BANNER_CLASSES,
  ehFonteTextoBanner,
  ehPesoTituloBanner,
  ehPosicaoTextoBanner,
  type FonteTextoBanner,
  type PesoTituloBanner,
  type PosicaoTextoBanner,
} from '@/lib/vitrineBannerTexto'

type ContrasteTexto = 'claro' | 'escuro'
type IntensidadeOverlay = 'sem_overlay' | 'suave' | 'forte'

type BannerVitrine = {
  id: string
  imagemDesktopUrl: string
  imagemMobileUrl: string
  proporcaoDesktop: number
  proporcaoMobile: number
  titulo: string
  subtitulo: string
  fonteTexto: FonteTextoBanner
  pesoTitulo: PesoTituloBanner
  posicaoTexto: PosicaoTextoBanner
  contrasteTexto: ContrasteTexto
  overlay: IntensidadeOverlay
  ativo: boolean
}

const CHAVE_BANNERS_VITRINE = 'vitrine_banners_publicos'

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

    return configuracao.banners
      .flatMap((item, indice) => {
        if (!item || typeof item !== 'object') return []
        const banner = item as Record<string, unknown>
        const imagemLegada =
          typeof banner.imagemUrl === 'string' ? banner.imagemUrl.trim() : ''
        const imagemDesktopUrl =
          typeof banner.imagemDesktopUrl === 'string'
            ? banner.imagemDesktopUrl.trim()
            : imagemLegada
        if (!imagemDesktopUrl) return []

        const posicaoTexto: PosicaoTextoBanner = ehPosicaoTextoBanner(
          banner.posicaoTexto,
        )
          ? banner.posicaoTexto
          : 'inferior_esquerda'
        const contrasteTexto: ContrasteTexto =
          banner.contrasteTexto === 'escuro' ? 'escuro' : 'claro'
        const overlay: IntensidadeOverlay = [
          'sem_overlay',
          'suave',
          'forte',
        ].includes(String(banner.overlay))
          ? (banner.overlay as IntensidadeOverlay)
          : 'suave'

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
            titulo:
              typeof banner.titulo === 'string' ? banner.titulo.trim() : '',
            subtitulo:
              typeof banner.subtitulo === 'string'
                ? banner.subtitulo.trim()
                : '',
            fonteTexto: ehFonteTextoBanner(banner.fonteTexto)
              ? banner.fonteTexto
              : 'quiche',
            pesoTitulo: ehPesoTituloBanner(banner.pesoTitulo)
              ? banner.pesoTitulo
              : 'leve',
            posicaoTexto,
            contrasteTexto,
            overlay,
            ativo: banner.ativo !== false,
          },
        ]
      })
      .filter((banner) => banner.ativo)
  } catch {
    return []
  }
}

function ImagemResponsivaBanner({
  banner,
  prioridade,
}: {
  banner: BannerVitrine
  prioridade: boolean
}) {
  const desktop = getImageProps({
    src: banner.imagemDesktopUrl,
    alt: '',
    fill: true,
    sizes: '100vw',
    priority: prioridade,
  }).props
  const mobile = banner.imagemMobileUrl
    ? getImageProps({
        src: banner.imagemMobileUrl,
        alt: banner.titulo || 'Destaque Fortes Fios',
        fill: true,
        sizes: '100vw',
        priority: prioridade,
      }).props
    : null
  const imagemBase = mobile ?? desktop

  return (
    <picture>
      {mobile ? (
        <source
          media="(min-width: 640px)"
          srcSet={desktop.srcSet}
          sizes={desktop.sizes}
        />
      ) : null}
      <img
        {...imagemBase}
        alt={banner.titulo || 'Destaque Fortes Fios'}
        className="object-contain"
      />
    </picture>
  )
}

export default function HeroVitrine() {
  const [banners, setBanners] = useState<BannerVitrine[]>([])
  const [indiceAtual, setIndiceAtual] = useState(0)
  const [pausaManual, setPausaManual] = useState(false)
  const [pausaInteracao, setPausaInteracao] = useState(false)
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: true })
  const pausado = pausaManual || pausaInteracao

  const carregarBanners = useCallback(async () => {
    const { data, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_BANNERS_VITRINE)
      .maybeSingle()

    if (error) {
      setBanners([])
      return
    }

    setBanners(lerBanners(data?.valor))
  }, [])

  useEffect(() => {
    void carregarBanners()

    const canal = supabase
      .channel('vitrine-banners-publicos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes_loja' },
        (payload) => {
          const registroNovo = payload.new as { chave?: string } | null
          const registroAnterior = payload.old as { chave?: string } | null
          if (
            registroNovo?.chave === CHAVE_BANNERS_VITRINE ||
            registroAnterior?.chave === CHAVE_BANNERS_VITRINE
          ) {
            void carregarBanners()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregarBanners])

  useEffect(() => {
    if (!emblaApi) return

    const atualizarIndice = () => setIndiceAtual(emblaApi.selectedScrollSnap())
    atualizarIndice()
    emblaApi.on('select', atualizarIndice)
    emblaApi.on('reInit', atualizarIndice)

    return () => {
      emblaApi.off('select', atualizarIndice)
      emblaApi.off('reInit', atualizarIndice)
    }
  }, [emblaApi])

  useEffect(() => {
    if (
      !emblaApi ||
      banners.length < 2 ||
      pausado ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const intervalo = window.setInterval(() => emblaApi.scrollNext(), 6000)
    return () => window.clearInterval(intervalo)
  }, [banners.length, emblaApi, pausado])

  if (banners.length === 0) {
    return (
      <section className="mb-7 overflow-hidden rounded-xl border border-border bg-secondary px-5 py-8 sm:mb-8 sm:px-8 sm:py-10">
        <p className="text-sm font-medium text-primary">Fortes Fios</p>
        <h2 className="fortes-display mt-2 max-w-2xl text-3xl leading-none text-foreground sm:text-5xl">
          Tudo o que seu cabelo precisa em um só lugar.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          A loja de quem entende de cabelo.
        </p>
      </section>
    )
  }

  const temMaisDeUmBanner = banners.length > 1
  const bannerAtual = banners[indiceAtual] ?? banners[0]
  const proporcaoDesktopAtual = bannerAtual.proporcaoDesktop
  const proporcaoMobileAtual = bannerAtual.imagemMobileUrl
    ? bannerAtual.proporcaoMobile
    : bannerAtual.proporcaoDesktop
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Destaques da Fortes Fios"
      className="relative w-full overflow-hidden bg-background pb-12 sm:bg-muted sm:pb-0"
      onMouseEnter={() => setPausaInteracao(true)}
      onMouseLeave={() => setPausaInteracao(false)}
      onFocusCapture={() => setPausaInteracao(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setPausaInteracao(false)
      }}
    >
      {temMaisDeUmBanner && (
        <button
          type="button"
          onClick={() => setPausaManual((estadoAtual) => !estadoAtual)}
          className="absolute bottom-0 end-3 z-10 flex size-11 items-center justify-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-3 sm:bg-black/25 sm:text-white sm:backdrop-blur-sm sm:focus-visible:ring-white"
          aria-label={
            pausaManual
              ? 'Retomar rotação dos banners'
              : 'Pausar rotação dos banners'
          }
        >
          {pausaManual ? (
            <Play className="size-4" fill="currentColor" />
          ) : (
            <Pause className="size-4" fill="currentColor" />
          )}
        </button>
      )}
      <div
        ref={emblaRef}
        className="aspect-[var(--proporcao-hero-mobile)] h-auto min-h-0 overflow-hidden transition-[aspect-ratio] duration-200 sm:aspect-[var(--proporcao-hero-desktop)]"
        style={
          {
            '--proporcao-hero-mobile': String(proporcaoMobileAtual),
            '--proporcao-hero-desktop': String(proporcaoDesktopAtual),
          } as CSSProperties
        }
        aria-live={pausado ? 'polite' : 'off'}
        aria-atomic="false"
      >
        <div className="flex h-full">
          {banners.map((banner, indice) => (
            <article
              key={banner.id}
              aria-roledescription="slide"
              aria-label={`${indice + 1} de ${banners.length}`}
              className="relative h-full min-w-0 flex-[0_0_100%]"
            >
              <ImagemResponsivaBanner
                banner={banner}
                prioridade={indice === 0}
              />
              {banner.overlay !== 'sem_overlay' && (
                <div
                  className={cn(
                    'absolute inset-0',
                    banner.contrasteTexto === 'claro'
                      ? banner.overlay === 'forte'
                        ? 'bg-black/50'
                        : 'bg-black/25'
                      : banner.overlay === 'forte'
                        ? 'bg-white/60'
                        : 'bg-white/30',
                  )}
                />
              )}

              {(banner.titulo || banner.subtitulo) && (
                <div
                  className={cn(
                    'absolute inset-0 flex p-6 sm:p-10 lg:p-14',
                    POSICAO_TEXTO_BANNER_CLASSES[banner.posicaoTexto],
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[88%] sm:max-w-xl',
                      banner.contrasteTexto === 'claro'
                        ? 'text-white'
                        : 'text-foreground',
                    )}
                  >
                    {banner.titulo && (
                      <h2
                        className={cn(
                          'whitespace-pre-line text-3xl leading-none drop-shadow-sm sm:text-5xl lg:text-6xl',
                          FONTE_TEXTO_BANNER_CLASSES[banner.fonteTexto],
                          PESO_TITULO_BANNER_CLASSES[banner.pesoTitulo],
                        )}
                      >
                        {banner.titulo}
                      </h2>
                    )}
                    {banner.subtitulo && (
                      <p
                        className={cn(
                          'mt-3 max-w-lg whitespace-pre-line text-sm font-normal leading-relaxed drop-shadow-sm sm:text-lg',
                          FONTE_TEXTO_BANNER_CLASSES[banner.fonteTexto],
                        )}
                      >
                        {banner.subtitulo}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {temMaisDeUmBanner && (
        <>
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute start-4 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute end-4 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
            aria-label="Próximo banner"
          >
            <ChevronRight className="size-5" />
          </button>
          <div
            role="group"
            className="absolute inset-x-14 bottom-0 flex h-12 items-center justify-center sm:bottom-3 sm:h-11"
            aria-label="Selecionar destaque"
          >
            <div className="flex max-w-full overflow-x-auto overscroll-x-contain scrollbar-hide">
              {banners.map((banner, indice) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(indice)}
                  aria-label={`Ir para destaque ${indice + 1}`}
                  aria-current={indice === indiceAtual ? 'true' : undefined}
                  className="flex size-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:focus-visible:ring-white"
                >
                  <span
                    className={cn(
                      'h-1.5 rounded-full bg-muted-foreground/35 transition-[width,background-color] sm:bg-white/60 sm:shadow-sm',
                      indice === indiceAtual
                        ? 'w-8 bg-primary sm:bg-white'
                        : 'w-2',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
