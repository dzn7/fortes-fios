'use client'

import { Check, Clock3, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rotaDaNotificacao, type Notificacao } from '@/lib/notificacoes.mjs'
import { aparenciaDaNotificacao, dataCompleta, ehUrgente, tempoRelativo } from './aparencia'

type ItemNotificacaoProps = {
  notificacao: Notificacao
  /** Abre o contexto (produto ou pedido). Sem isso o cartão não é clicável. */
  onAbrir?: (notificacao: Notificacao) => void
  onMarcarComoLida?: (id: string) => void
  onDispensar?: (id: string) => void
  /** Item de histórico: já resolvido ou dispensado, sem ações e esmaecido. */
  arquivado?: boolean
}

/**
 * Cartão de notificação.
 *
 * O cartão inteiro leva ao contexto por um "stretched link": o botão do título
 * projeta `after:absolute after:inset-0` sobre o cartão. Assim a área de clique
 * é o cartão todo sem aninhar botão dentro de botão — os ícones de ação ficam
 * acima com `relative z-10`.
 *
 * A urgência aparece no fio vermelho da borda esquerda e no agrupamento do
 * painel, não em cada linha: com o estoque inteiro em alerta, marcar todo
 * cartão de vermelho apagaria a diferença entre "baixo" e "esgotado".
 */
export function ItemNotificacao({
  notificacao,
  onAbrir,
  onMarcarComoLida,
  onDispensar,
  arquivado = false,
}: ItemNotificacaoProps) {
  const { Icone, classeIcone } = aparenciaDaNotificacao(notificacao.tipo)
  const urgente = ehUrgente(notificacao) && !arquivado
  const naoLida = !notificacao.lida_em && !arquivado
  const podeAbrir = Boolean(rotaDaNotificacao(notificacao)) && Boolean(onAbrir) && !arquivado

  const quando = arquivado
    ? notificacao.resolvida_em || notificacao.silenciada_em || notificacao.criada_em
    : notificacao.criada_em

  return (
    <article
      className={cn(
        'group relative flex gap-3 rounded-xl border border-border/70 p-3 transition-colors',
        podeAbrir && 'hover:border-border hover:bg-accent/60',
        naoLida ? 'bg-primary/[0.045]' : 'bg-transparent',
        urgente && 'border-l-[3px] border-l-destructive',
        arquivado && 'opacity-65',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          arquivado ? 'bg-muted text-muted-foreground' : classeIcone,
        )}
        aria-hidden
      >
        <Icone strokeWidth={1.7} className="size-[18px]" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h4 className="min-w-0 flex-1 text-sm font-semibold leading-tight tracking-tight text-foreground">
            {podeAbrir ? (
              <button
                type="button"
                onClick={() => onAbrir?.(notificacao)}
                className="text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
              >
                {notificacao.titulo}
              </button>
            ) : (
              notificacao.titulo
            )}
            {naoLida ? (
              <span
                className="ml-1.5 inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-primary align-middle"
                aria-label="Não lida"
              />
            ) : null}
          </h4>

          {!arquivado && (onMarcarComoLida || onDispensar) ? (
            <div className="relative z-10 -mr-1 -mt-0.5 flex shrink-0 items-center gap-0.5">
              {onMarcarComoLida && naoLida ? (
                <button
                  type="button"
                  onClick={() => onMarcarComoLida(notificacao.id)}
                  aria-label="Marcar como lida"
                  title="Marcar como lida"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Check strokeWidth={2} className="size-3.5" />
                </button>
              ) : null}
              {onDispensar ? (
                <button
                  type="button"
                  onClick={() => onDispensar(notificacao.id)}
                  aria-label="Dispensar"
                  title="Dispensar"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X strokeWidth={2} className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-1 break-words text-[13px] leading-snug text-muted-foreground">
          {notificacao.mensagem}
        </p>

        <p
          className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/70"
          title={dataCompleta(quando)}
        >
          <Clock3 strokeWidth={1.8} className="size-3 shrink-0" aria-hidden />
          {arquivado && notificacao.silenciada_em && notificacao.estado === 'ativa'
            ? `Dispensada ${tempoRelativo(quando)}`
            : arquivado
              ? `Resolvida ${tempoRelativo(quando)}`
              : tempoRelativo(quando)}
        </p>
      </div>
    </article>
  )
}
