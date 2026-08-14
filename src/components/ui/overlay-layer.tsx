'use client'

import * as React from 'react'

/**
 * Ordenação de camadas dos overlays compartilhados.
 *
 * Antes cada primitivo trazia um `z-index` literal (`z-[1000]`/`z-[1001]` em
 * Drawer/Dialog/AlertDialog, `z-50` no Sheet, `z-[10001]` no DropdownMenu). Como
 * o valor era fixo, dois overlays simultâneos empatavam: o overlay do modal
 * filho (1000) ficava *abaixo* do conteúdo do pai (1001), que continuava aceso
 * por cima do escurecimento. Subir o número não resolve — só desloca o empate.
 *
 * A camada passa a sair da ordem real de abertura:
 *
 *   overlay  = 1000 + p * 10
 *   conteúdo = overlay + 1
 *   popper   = overlay + 5   (Select, Popover, DropdownMenu, Tooltip)
 *
 * `p` é quantas superfícies já estavam montadas quando esta abriu. Precisa ser
 * uma pilha de módulo, e não apenas contexto de React: no admin quase todo
 * modal aninhado é renderizado como **irmão** do modal que o abriu (o padrão em
 * `ModalDetalhesPedido`, `ModalEditarPedido`, os recortes de imagem e os
 * avatares), então não existe relação de pai/filho na árvore para herdar.
 *
 * O contexto continua existindo, mas com outro papel: informar aos poppers
 * (Select/Popover/Dropdown/Tooltip) a profundidade da superfície que os contém,
 * para que fiquem acima dela e abaixo da próxima superfície aberta.
 *
 * Acima desta faixa permanecem reservados o onboarding (9990–9999) e o banner
 * do PWA (10001), que precisam cobrir qualquer superfície da aplicação.
 */
const CAMADA_BASE = 1000
const PASSO_CAMADA = 10
const DESLOCAMENTO_CONTEUDO = 1
const DESLOCAMENTO_POPPER = 5

const ProfundidadeSuperficieContext = React.createContext(0)

const useEfeitoIsomorfico =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

/** Superfícies modais montadas, na ordem em que abriram. */
let pilhaSuperficies: symbol[] = []

export type CamadaOverlay = {
  /** Quantas superfícies já estavam abertas quando esta montou. */
  profundidade: number
  /** `z-index` do backdrop. */
  overlay: number
  /** `z-index` da superfície. */
  conteudo: number
  /** `z-index` de menus flutuantes ancorados dentro da superfície. */
  popper: number
}

const montarCamada = (profundidade: number): CamadaOverlay => {
  const overlay = CAMADA_BASE + profundidade * PASSO_CAMADA
  return {
    profundidade,
    overlay,
    conteudo: overlay + DESLOCAMENTO_CONTEUDO,
    popper: overlay + DESLOCAMENTO_POPPER,
  }
}

/**
 * Camada de uma superfície modal (Drawer, Dialog, AlertDialog, Sheet).
 * Registra a superfície na pilha enquanto estiver montada.
 */
export const useCamadaSuperficie = (): CamadaOverlay => {
  const profundidadeHerdada = React.useContext(ProfundidadeSuperficieContext)
  // Lido uma única vez, na montagem: a superfície não deve trocar de camada
  // enquanto está aberta só porque outra abriu ou fechou por cima.
  const [profundidadeNaAbertura] = React.useState(() => pilhaSuperficies.length)
  const identidade = React.useRef<symbol | null>(null)
  if (identidade.current === null) identidade.current = Symbol('superficie-overlay')

  useEfeitoIsomorfico(() => {
    const id = identidade.current as symbol
    pilhaSuperficies.push(id)
    return () => {
      pilhaSuperficies = pilhaSuperficies.filter((item) => item !== id)
    }
  }, [])

  // O contexto cobre o caso de a superfície ser filha de outra na árvore; a
  // pilha cobre o caso (dominante aqui) de ser irmã. Vale o maior dos dois.
  return React.useMemo(
    () => montarCamada(Math.max(profundidadeNaAbertura, profundidadeHerdada)),
    [profundidadeHerdada, profundidadeNaAbertura],
  )
}

/**
 * Camada de leitura, sem registro — para menus flutuantes, que se posicionam
 * em relação à superfície que os contém.
 */
export const useCamadaOverlay = (): CamadaOverlay => {
  const profundidade = React.useContext(ProfundidadeSuperficieContext)
  return React.useMemo(() => montarCamada(profundidade), [profundidade])
}

/**
 * Publica a profundidade da superfície para o conteúdo dela, de modo que
 * selects, popovers e tooltips internos fiquem acima do próprio painel.
 */
export const CamadaSuperficieProvider = ({
  profundidade,
  children,
}: {
  profundidade: number
  children: React.ReactNode
}) => (
  <ProfundidadeSuperficieContext.Provider value={profundidade}>
    {children}
  </ProfundidadeSuperficieContext.Provider>
)
