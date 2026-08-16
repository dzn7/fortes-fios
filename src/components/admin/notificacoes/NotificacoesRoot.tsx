'use client'

import { ModalAlertasEntrada } from './ModalAlertasEntrada'

/**
 * Superfície global da central, montada uma única vez no layout do Admin —
 * mesmo padrão do `OnboardingRoot`. Fica fora da árvore das páginas para que
 * navegar entre telas não reabra o modal.
 *
 * O painel não está aqui: ele é ancorado no sino do header (ver
 * `SinoNotificacoes`), que é quem tem o gatilho do `Popover`.
 */
export function NotificacoesRoot() {
  return <ModalAlertasEntrada />
}
