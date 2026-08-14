'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONFIGURACAO_RESULTADOS_STUDIO_PADRAO,
  ConfiguracaoResultadosStudio,
} from '@/lib/vitrineResultadosStudio'

type RespostaResultadosStudio = {
  sucesso: boolean
  configuracao?: ConfiguracaoResultadosStudio
}

export default function ResultadosStudio() {
  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoResultadosStudio>(
      CONFIGURACAO_RESULTADOS_STUDIO_PADRAO,
    )
  const [indiceAtual, setIndiceAtual] = useState(0)
  const [pausaManual, setPausaManual] = useState(false)
  const [pausaInteracao, setPausaInteracao] = useState(false)
  const resultados = useMemo(
    () => configuracao.resultados.filter((resultado) => resultado.ativo),
    [configuracao.resultados],
  )
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'center',
    containScroll: 'trimSnaps',
    loop: resultados.length > 2,
  })
  const pausado = pausaManual || pausaInteracao

  const carregarConfiguracao = useCallback(async () => {
    try {
      const resposta = await fetch('/api/vitrine/resultados-studio', {
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Falha ao carregar resultados')
      const dados = (await resposta.json()) as RespostaResultadosStudio
      if (dados.sucesso && dados.configuracao) {
        setConfiguracao(dados.configuracao)
      }
    } catch {
      setConfiguracao(CONFIGURACAO_RESULTADOS_STUDIO_PADRAO)
    }
  }, [])

  useEffect(() => {
    void carregarConfiguracao()
  }, [carregarConfiguracao])

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
      resultados.length < 2 ||
      !configuracao.autoplay ||
      pausado ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const intervalo = window.setInterval(
      () => emblaApi.scrollNext(),
      configuracao.intervaloSegundos * 1000,
    )
    return () => window.clearInterval(intervalo)
  }, [
    configuracao.autoplay,
    configuracao.intervaloSegundos,
    emblaApi,
    pausado,
    resultados.length,
  ])

  if (!configuracao.ativo || resultados.length === 0) return null

  const temNavegacao = resultados.length > 1

  return (
    <section
      className="border-t border-border/70 bg-secondary/25 py-12 sm:py-16"
      aria-labelledby="titulo-resultados-studio"
      aria-roledescription="carousel"
      onMouseEnter={() => setPausaInteracao(true)}
      onMouseLeave={() => setPausaInteracao(false)}
      onFocusCapture={() => setPausaInteracao(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPausaInteracao(false)
        }
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="px-6 text-center sm:px-8">
          <h2
            id="titulo-resultados-studio"
            className="text-balance text-xs font-semibold uppercase tracking-wide text-primary sm:text-sm"
          >
            {configuracao.chamada}
          </h2>
          {configuracao.logoUrl ? (
            <div className="relative mx-auto mt-5 h-20 w-full max-w-56 sm:h-24 sm:max-w-64">
              <Image
                src={configuracao.logoUrl}
                alt={configuracao.nomeStudio || 'Studio parceiro'}
                fill
                sizes="256px"
                className="object-contain dark:hidden"
              />
              <Image
                src={
                  configuracao.logoUrlTemaEscuro || configuracao.logoUrl
                }
                alt={configuracao.nomeStudio || 'Studio parceiro'}
                fill
                sizes="256px"
                className="hidden object-contain dark:block"
              />
            </div>
          ) : configuracao.nomeStudio ? (
            <p className="fortes-display mt-4 text-4xl leading-none text-foreground sm:text-5xl">
              {configuracao.nomeStudio}
            </p>
          ) : null}
        </div>

        <div className="relative mt-8 sm:mt-10">
          <div ref={emblaRef} className="overflow-hidden" aria-live={pausado ? 'polite' : 'off'}>
            <div
              className={cn(
                'flex touch-pan-y',
                resultados.length === 1 && 'justify-center',
              )}
            >
              {resultados.map((resultado, indice) => (
                <article
                  key={resultado.id}
                  className="min-w-0 flex-[0_0_78%] px-1.5 sm:flex-[0_0_44%] sm:px-2 lg:flex-[0_0_31%]"
                  aria-roledescription="slide"
                  aria-label={`${indice + 1} de ${resultados.length}`}
                >
                  <div
                    className={cn(
                      'relative aspect-[4/5] overflow-hidden rounded-xl bg-muted transition-[transform,opacity] duration-150',
                      indice === indiceAtual
                        ? 'scale-100 opacity-100'
                        : 'scale-95 opacity-70',
                    )}
                  >
                    <Image
                      src={resultado.imagemUrl}
                      alt={
                        resultado.titulo ||
                        `Resultado apresentado por ${configuracao.nomeStudio || 'studio parceiro'}`
                      }
                      fill
                      sizes="(max-width: 640px) 78vw, (max-width: 1024px) 44vw, 31vw"
                      className="object-cover"
                    />
                    {(resultado.titulo || resultado.descricao) && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-5 pt-16 text-white">
                        {resultado.titulo ? (
                          <h3 className="line-clamp-1 text-lg font-semibold leading-snug sm:text-xl">
                            {resultado.titulo}
                          </h3>
                        ) : null}
                        {resultado.descricao ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-normal text-white/90">
                            {resultado.descricao}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {temNavegacao ? (
            <>
              <button
                type="button"
                onClick={() => emblaApi?.scrollPrev()}
                className="absolute start-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:start-8"
                aria-label="Resultado anterior"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => emblaApi?.scrollNext()}
                className="absolute end-4 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:end-8"
                aria-label="Próximo resultado"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          ) : null}
        </div>

        {temNavegacao ? (
          <div
            className="mt-5 flex min-h-11 items-center justify-center gap-1"
            role="group"
            aria-label="Selecionar resultado"
          >
            {resultados.map((resultado, indice) => (
              <button
                key={resultado.id}
                type="button"
                onClick={() => emblaApi?.scrollTo(indice)}
                className="flex size-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ir para resultado ${indice + 1}`}
                aria-current={indice === indiceAtual ? 'true' : undefined}
              >
                <span
                  className={cn(
                    'size-2 rounded-full bg-muted-foreground/35 transition-colors duration-150',
                    indice === indiceAtual && 'bg-primary',
                  )}
                />
              </button>
            ))}
            {configuracao.autoplay ? (
              <button
                type="button"
                onClick={() => setPausaManual((estadoAtual) => !estadoAtual)}
                className="ms-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={pausaManual ? 'Retomar carrossel' : 'Pausar carrossel'}
              >
                {pausaManual ? (
                  <Play className="size-4" fill="currentColor" aria-hidden />
                ) : (
                  <Pause className="size-4" fill="currentColor" aria-hidden />
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
