'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Quote, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONFIGURACAO_DEPOIMENTOS_PADRAO,
  depoimentosVisiveis,
  proporcaoDoFormato,
  type ConfiguracaoDepoimentos,
  type Depoimento,
} from '@/lib/vitrineDepoimentos.mjs'

/**
 * Depoimentos na vitrine.
 *
 * Carrossel `embla`, como o Estúdio — mas com uma diferença que é o ponto da
 * seção: **cada card tem a largura do seu próprio formato**. Um print 9:16 e um
 * screenshot largo convivem na mesma trilha sem que nenhum seja esticado,
 * cortado ou cercado de faixa vazia. Forçar proporção única aqui destruiria
 * justamente o conteúdo — a conversa dentro da imagem.
 *
 * Seção desligada não renderiza nem baixa imagem: o `return null` acontece antes
 * de qualquer `<Image>` entrar na árvore.
 */
export default function Depoimentos() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDepoimentos>(
    CONFIGURACAO_DEPOIMENTOS_PADRAO,
  )
  const [ampliado, setAmpliado] = useState<Depoimento | null>(null)

  const itens = useMemo(() => depoimentosVisiveis(configuracao), [configuracao])

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  })

  useEffect(() => {
    let ativo = true

    fetch('/api/vitrine/depoimentos', { cache: 'no-store' })
      .then((resposta) => resposta.json())
      .then((dados) => {
        if (ativo && dados?.configuracao) setConfiguracao(dados.configuracao)
      })
      .catch(() => {
        if (ativo) setConfiguracao(CONFIGURACAO_DEPOIMENTOS_PADRAO)
      })

    return () => {
      ativo = false
    }
  }, [])

  // Fechar com Escape: no desktop é o gesto que a pessoa tenta primeiro.
  useEffect(() => {
    if (!ampliado) return

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAmpliado(null)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [ampliado])

  const rolar = useCallback(
    (direcao: -1 | 1) => {
      if (!emblaApi) return
      if (direcao === -1) emblaApi.scrollPrev()
      else emblaApi.scrollNext()
    },
    [emblaApi],
  )

  if (itens.length === 0) return null

  return (
    <section className="py-12 sm:py-16" aria-labelledby="titulo-depoimentos">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <Quote className="size-3" strokeWidth={2} aria-hidden />
              Depoimentos
            </span>
            <h2
              id="titulo-depoimentos"
              className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              {configuracao.titulo}
            </h2>
            {configuracao.chamada ? (
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                {configuracao.chamada}
              </p>
            ) : null}
          </div>

          {/* Setas só no desktop: no mobile o swipe já resolve e botão ali rouba área de toque. */}
          <div className="hidden shrink-0 gap-2 sm:flex">
            {([-1, 1] as const).map((direcao) => (
              <button
                key={direcao}
                type="button"
                onClick={() => rolar(direcao)}
                aria-label={direcao === -1 ? 'Depoimentos anteriores' : 'Próximos depoimentos'}
                className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {direcao === -1 ? (
                  <ChevronLeft className="size-5" strokeWidth={1.8} />
                ) : (
                  <ChevronRight className="size-5" strokeWidth={1.8} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3 sm:gap-4">
            {itens.map((depoimento, indice) => {
              const formato = proporcaoDoFormato(depoimento.formato)

              return (
                <button
                  key={depoimento.id}
                  type="button"
                  onClick={() => setAmpliado(depoimento)}
                  aria-label={
                    depoimento.nome
                      ? `Ampliar depoimento de ${depoimento.nome}`
                      : 'Ampliar depoimento'
                  }
                  className={cn(
                    'group relative shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card text-left transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    formato.classeLargura,
                  )}
                >
                  <div className={cn('relative w-full', formato.classeProporcao)}>
                    <Image
                      src={depoimento.imagemUrl}
                      alt={
                        depoimento.nome
                          ? `Depoimento de ${depoimento.nome}`
                          : 'Depoimento de cliente'
                      }
                      fill
                      sizes="(max-width: 640px) 70vw, 460px"
                      // `contain` e não `cover`: o print é o conteúdo, cortar
                      // borda significa cortar texto.
                      className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      // As duas primeiras entram no viewport; o resto espera o swipe.
                      loading={indice < 2 ? 'eager' : 'lazy'}
                    />
                  </div>

                  {depoimento.nome ? (
                    <p className="truncate border-t border-border/60 px-3 py-2.5 text-[13px] font-medium text-foreground">
                      {depoimento.nome}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/*
        Visualização ampliada. Overlay próprio em vez do `Dialog` do admin porque
        aqui o conteúdo é só a imagem, e o `Dialog` acrescentaria moldura, padding
        e fundo que competem com o print. Fecha por Escape, clique fora e botão.
      */}
      {ampliado ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ampliado.nome ? `Depoimento de ${ampliado.nome}` : 'Depoimento'}
          onClick={() => setAmpliado(null)}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
        >
          <button
            type="button"
            onClick={() => setAmpliado(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>

          {/*
            `max-h`/`max-w` em unidades do viewport com `object-contain`: a imagem
            cresce até caber e para. Sem isso um 9:16 alto estoura a tela no
            desktop e um horizontal largo cria rolagem lateral no mobile.
          */}
          <img
            src={ampliado.imagemUrl}
            alt={ampliado.nome ? `Depoimento de ${ampliado.nome}` : 'Depoimento de cliente'}
            onClick={(evento) => evento.stopPropagation()}
            className="max-h-[88dvh] max-w-[min(100%,52rem)] rounded-xl object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </section>
  )
}
