import { AlertTriangle, PackageX, Receipt, type LucideIcon } from 'lucide-react'
import type { Notificacao, TipoNotificacao } from '@/lib/notificacoes.mjs'

/**
 * Aparência por tipo de notificação.
 *
 * A cor comunica QUAL é o problema; a urgência é comunicada à parte (barra
 * vermelha + selo "Urgente"). Assim o vermelho continua significando o caso
 * terminal — produto que não vende mais — e a tela não satura, como pede o
 * UI.md (status nunca só por cor, sem excesso de vermelho).
 */

type AparenciaNotificacao = {
  Icone: LucideIcon
  /** Cor do ícone e do respingo de fundo. */
  classeIcone: string
  rotulo: string
}

const APARENCIAS: Record<TipoNotificacao, AparenciaNotificacao> = {
  estoque_esgotado: {
    Icone: PackageX,
    classeIcone: 'bg-destructive/10 text-destructive',
    rotulo: 'Estoque',
  },
  estoque_baixo: {
    Icone: AlertTriangle,
    classeIcone: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    rotulo: 'Estoque',
  },
  pedido_novo: {
    Icone: Receipt,
    classeIcone: 'bg-primary/10 text-primary',
    rotulo: 'Pedido',
  },
}

const APARENCIA_PADRAO: AparenciaNotificacao = {
  Icone: AlertTriangle,
  classeIcone: 'bg-muted text-muted-foreground',
  rotulo: 'Aviso',
}

export const aparenciaDaNotificacao = (tipo: string): AparenciaNotificacao =>
  APARENCIAS[tipo as TipoNotificacao] ?? APARENCIA_PADRAO

/** "agora há pouco", "há 3 h", "há 2 d" — curto o bastante para caber no mobile. */
export const tempoRelativo = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''

  const minutos = Math.floor((Date.now() - data.getTime()) / 60_000)
  if (minutos < 1) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} d`
}

export const ehUrgente = (notificacao: Pick<Notificacao, 'prioridade'>) =>
  notificacao.prioridade === 'urgente'
