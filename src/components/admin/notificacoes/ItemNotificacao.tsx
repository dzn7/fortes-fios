'use client'

import { Check, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { rotaDaNotificacao, type Notificacao } from '@/lib/notificacoes.mjs'
import { aparenciaDaNotificacao, ehUrgente, tempoRelativo } from './aparencia'

type ItemNotificacaoProps = {
  notificacao: Notificacao
  onIrParaContexto?: (rota: string) => void
  onMarcarComoLida?: (id: string) => void
  onDispensar?: (id: string) => void
  compacto?: boolean
}

export function ItemNotificacao({
  notificacao,
  onIrParaContexto,
  onMarcarComoLida,
  onDispensar,
  compacto = false,
}: ItemNotificacaoProps) {
  const { Icone, classeIcone } = aparenciaDaNotificacao(notificacao.tipo)
  const urgente = ehUrgente(notificacao)
  const resolvida = notificacao.estado === 'resolvida'
  const naoLida = !notificacao.lida_em && !resolvida
  const rota = rotaDaNotificacao(notificacao)

  const conteudo = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          resolvida ? 'bg-muted text-muted-foreground' : classeIcone,
        )}
        aria-hidden
      >
        <Icone strokeWidth={1.7} className="size-[18px]" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'text-sm font-medium text-foreground',
              resolvida && 'text-muted-foreground line-through',
            )}
          >
            {notificacao.titulo}
          </span>
          {urgente && !resolvida ? (
            <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-destructive">
              Urgente
            </span>
          ) : null}
          {naoLida ? (
            <span
              className="size-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Não lida"
            />
          ) : null}
        </span>

        <span className="break-words text-sm leading-snug text-muted-foreground">
          {notificacao.mensagem}
        </span>

        <span className="text-[11px] text-muted-foreground/80">
          {resolvida
            ? `Resolvida ${tempoRelativo(notificacao.resolvida_em)}`
            : tempoRelativo(notificacao.criada_em)}
        </span>
      </span>

      {rota && !resolvida ? (
        <ChevronRight
          strokeWidth={1.6}
          className="mt-1 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  )

  const classesBase = cn(
    'flex w-full items-start gap-3 rounded-lg border-l-[3px] px-3 py-3 text-left transition-colors',
    resolvida
      ? 'border-l-transparent opacity-70'
      : urgente
        ? 'border-l-destructive bg-destructive/[0.04]'
        : 'border-l-border',
    compacto && 'py-2.5',
  )

  return (
    <article className="group relative">
      {rota && !resolvida && onIrParaContexto ? (
        <button
          type="button"
          onClick={() => onIrParaContexto(rota)}
          className={cn(
            classesBase,
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          )}
        >
          {conteudo}
        </button>
      ) : (
        <div className={classesBase}>{conteudo}</div>
      )}

      {!compacto && !resolvida && (onMarcarComoLida || onDispensar) ? (
        <div className="flex items-center gap-1 pb-2 pl-[60px] pr-3">
          {onMarcarComoLida && naoLida ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onMarcarComoLida(notificacao.id)}
            >
              <Check strokeWidth={1.8} className="size-3.5" />
              Marcar como lida
            </Button>
          ) : null}
          {onDispensar ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onDispensar(notificacao.id)}
            >
              <X strokeWidth={1.8} className="size-3.5" />
              Dispensar
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
