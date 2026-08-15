'use client'

import { PainelNotificacoes } from './PainelNotificacoes'
import { ModalAlertasEntrada } from './ModalAlertasEntrada'

/**
 * Superfícies globais da central, montadas uma única vez no layout do Admin —
 * mesmo padrão do `OnboardingRoot`. Ficam fora da árvore das páginas para que
 * navegar entre telas não desmonte o painel nem reabra o modal.
 */
export function NotificacoesRoot() {
  return (
    <>
      <PainelNotificacoes />
      <ModalAlertasEntrada />
    </>
  )
}
