'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Rede para o caso de `animationend` não chegar — aba em segundo plano, motion
 * reduzido, navegador que pula a animação. Sem ela o aviso ficaria montado para
 * sempre. Folga sobre os 250 ms de `slide-down-out`.
 */
const ESPERA_SAIDA_MS = 400

type ModalLojaFechadaProps = {
  aberto: boolean
  numeroWhatsApp: string
}

const IconeWhatsApp = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

/**
 * Aviso de loja fechada.
 *
 * **É um banner, não um modal** — `role="status"` e `aria-live="polite"`, sem
 * overlay e sem prender o foco. Por isso não usa o `Dialog` do projeto.
 *
 * A animação é CSS, e não `framer-motion`. Este arquivo era o **único** ponto
 * de entrada do framer-motion na árvore do site do cliente, e custava 42 kB
 * gzip do bundle inicial (391 → 349 kB, medidos em build limpo) — pago por todo
 * visitante para um aviso que só aparece com a loja fechada.
 *
 * `next/dynamic` **não** resolve, e isso foi medido antes de descartar: o Next
 * pré-carrega o chunk dinâmico no HTML inicial e o total subiu (391 → 393 kB).
 *
 * `animate-slide-up` já é o idioma do projeto para banner fixo — os três
 * `PWAManager` usam a mesma estrutura de className.
 *
 * Spec: specs/desempenho-catalogo-mobile.md
 */
export default function ModalLojaFechada({ aberto, numeroWhatsApp }: ModalLojaFechadaProps) {
  const [fechadoPeloUsuario, setFechadoPeloUsuario] = useState(false)
  const numeroFormatado = numeroWhatsApp.replace(/\D/g, '')
  const podeFalarNoWhatsApp = numeroFormatado.length > 0

  const deveAparecer = aberto && !fechadoPeloUsuario
  const [renderizado, setRenderizado] = useState(deveAparecer)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    if (!aberto) {
      setFechadoPeloUsuario(false)
    }
  }, [aberto])

  // O que o `AnimatePresence` fazia: adiar a desmontagem até a saída terminar.
  useEffect(() => {
    if (deveAparecer) {
      setRenderizado(true)
      setSaindo(false)
      return
    }
    if (!renderizado) return

    setSaindo(true)
    const espera = window.setTimeout(() => setRenderizado(false), ESPERA_SAIDA_MS)
    return () => window.clearTimeout(espera)
  }, [deveAparecer, renderizado])

  const abrirWhatsApp = () => {
    if (!podeFalarNoWhatsApp) return

    const mensagem = 'Ola! Gostaria de tirar uma duvida sobre o funcionamento da loja.'
    const url = `https://wa.me/${numeroFormatado}?text=${encodeURIComponent(mensagem)}`
    window.open(url, '_blank')
  }

  if (!renderizado) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:w-full sm:max-w-md sm:px-0 sm:pb-0',
        saindo ? 'animate-slide-down-out' : 'animate-slide-up',
      )}
      role="status"
      aria-live="polite"
      /*
        `currentTarget` porque `animationend` borbulha: animação de um filho
        desmontaria o aviso no meio da entrada.
      */
      onAnimationEnd={(evento) => {
        if (saindo && evento.target === evento.currentTarget) setRenderizado(false)
      }}
    >
      <div className="max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl border border-amber-300/80 bg-amber-50/95 p-4 shadow-2xl backdrop-blur dark:border-amber-700 dark:bg-amber-950/90">
        <div className="flex items-start justify-between gap-3">
          <div className="pr-2">
            <h2 className="text-base font-bold leading-tight text-amber-900 dark:text-amber-200">
              Loja fechada no momento
            </h2>
            <p className="mt-1 text-sm leading-snug text-amber-800 dark:text-amber-300">
              O catálogo continua disponível para consulta, mas novos pedidos só voltam quando a loja reabrir.
            </p>
          </div>

          <button
            onClick={() => setFechadoPeloUsuario(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-800 transition-colors hover:bg-amber-200/70 dark:text-amber-300 dark:hover:bg-amber-800/40"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {podeFalarNoWhatsApp && (
          <div className="mt-3">
            <button
              onClick={abrirWhatsApp}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              <IconeWhatsApp className="h-5 w-5" />
              <span>Falar no WhatsApp</span>
            </button>
          </div>
        )}

        <p className="mt-2 text-center text-xs text-amber-700/90 dark:text-amber-400/90">
          Pedidos online indisponiveis enquanto a loja estiver fechada.
        </p>
      </div>
    </div>
  )
}
