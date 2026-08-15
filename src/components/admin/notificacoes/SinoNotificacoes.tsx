'use client'

import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificacoes } from '@/contexts/NotificacoesContext'

/**
 * Sino do header. O badge sai de contadores que o servidor devolve por
 * index-only scan — nunca de uma varredura da lista.
 */
export function SinoNotificacoes({ className }: { className?: string }) {
  const { resumo, abrirPainel } = useNotificacoes()

  const naoLidas = resumo.naoLidas
  const temUrgente = resumo.urgentes > 0
  const rotulo =
    naoLidas === 0
      ? 'Notificações: nenhuma não lida'
      : `Notificações: ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}${
          temUrgente ? `, ${resumo.urgentes} urgente${resumo.urgentes === 1 ? '' : 's'}` : ''
        }`

  return (
    <button
      type="button"
      onClick={abrirPainel}
      aria-label={rotulo}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
    >
      <Bell strokeWidth={1.6} className="size-[18px]" />

      {naoLidas > 0 ? (
        <span
          aria-hidden
          className={cn(
            'absolute -right-0.5 -top-0.5 flex min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-[17px] text-white ring-2 ring-background',
            temUrgente ? 'bg-destructive' : 'bg-primary',
          )}
        >
          {naoLidas > 9 ? '9+' : naoLidas}
        </span>
      ) : null}
    </button>
  )
}
