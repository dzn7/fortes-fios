'use client'

import { useSyncExternalStore } from 'react'

const BREAKPOINT_MOBILE = 768
const CONSULTA = `(max-width: ${BREAKPOINT_MOBILE - 1}px)`

/**
 * Lido por store externa em vez de `useState` + `useEffect`: com o efeito, todo
 * componente que monta depois da hidratação começava em `false` e só corrigia
 * no commit seguinte. Como o `Dialog` escolhe a superfície por esse valor
 * (Radix no desktop, Drawer vaul no mobile), um dialog renderizado
 * condicionalmente montava como dialog e remontava como drawer, perdendo foco e
 * estado dos campos. Aqui a primeira leitura no cliente já é a real.
 */
const assinar = (aoMudar: () => void) => {
  if (typeof window === 'undefined') return () => undefined
  const media = window.matchMedia(CONSULTA)
  media.addEventListener('change', aoMudar)
  return () => media.removeEventListener('change', aoMudar)
}

const lerNoCliente = () =>
  typeof window === 'undefined' ? false : window.matchMedia(CONSULTA).matches

const lerNoServidor = () => false

export const useIsMobile = () => useSyncExternalStore(assinar, lerNoCliente, lerNoServidor)
