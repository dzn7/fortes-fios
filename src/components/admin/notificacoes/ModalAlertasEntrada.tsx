'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { notificacaoAbreModal, rotaDaNotificacao } from '@/lib/notificacoes.mjs'
import { useNotificacoes } from '@/contexts/NotificacoesContext'
import { aparenciaDaNotificacao, ehUrgente } from './aparencia'

/**
 * Modal de entrada.
 *
 * Aparece uma vez por sessão do Admin, quando existe alerta ativo que o usuário
 * ainda não viu. Fechar marca as exibidas como visualizadas — aquelas
 * ocorrências não voltam, mas uma notificação NOVA reabre o modal. O checkbox
 * "Não mostrar novamente" desliga o modal de vez para o usuário, com reversão
 * disponível no rodapé do painel.
 *
 * Não bloqueia o uso do sistema: fecha com Escape, clique fora e botão de 44 px.
 */
export function ModalAlertasEntrada() {
  const router = useRouter()
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false)
  const { alertasDeEntrada, fecharAlertasDeEntrada, abrirPainel, notificacoes } =
    useNotificacoes()

  const aberto = alertasDeEntrada.length > 0
  // Conta o excedente entre os que ABRIRIAM o modal, não entre todos os ativos:
  // o que já foi lido ou silenciado não é "mais um alerta esperando".
  const restantes = Math.max(
    0,
    notificacoes.filter(notificacaoAbreModal).length - alertasDeEntrada.length,
  )

  const fechar = () => {
    fecharAlertasDeEntrada(naoMostrarNovamente)
    setNaoMostrarNovamente(false)
  }

  const verTodas = () => {
    fecharAlertasDeEntrada(naoMostrarNovamente)
    setNaoMostrarNovamente(false)
    abrirPainel()
  }

  const irParaContexto = (rota: string) => {
    fecharAlertasDeEntrada(naoMostrarNovamente)
    setNaoMostrarNovamente(false)
    router.push(rota)
  }

  return (
    <Dialog open={aberto} onOpenChange={(proximo) => { if (!proximo) fechar() }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Atenção necessária</DialogTitle>
        <DialogDescription className="sr-only">
          Alertas de estoque e pedidos que precisam da sua atenção agora.
        </DialogDescription>

        <header className="flex shrink-0 items-start gap-3 border-b border-border/70 px-5 py-4 pr-14">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle strokeWidth={1.7} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-tight text-foreground">
              Atenção necessária
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {alertasDeEntrada.length === 1
                ? '1 item precisa da sua atenção.'
                : `${alertasDeEntrada.length} itens precisam da sua atenção.`}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <ul className="flex flex-col gap-2">
            {alertasDeEntrada.map((item) => {
              const { Icone, classeIcone } = aparenciaDaNotificacao(item.tipo)
              const rota = rotaDaNotificacao(item)

              const corpo = (
                <>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${classeIcone}`}
                    aria-hidden
                  >
                    <Icone strokeWidth={1.7} className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.titulo}</span>
                      {ehUrgente(item) ? (
                        <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-destructive">
                          Urgente
                        </span>
                      ) : null}
                    </span>
                    <span className="break-words text-sm leading-snug text-muted-foreground">
                      {item.mensagem}
                    </span>
                  </span>
                </>
              )

              return (
                <li key={item.id}>
                  {rota ? (
                    <button
                      type="button"
                      onClick={() => irParaContexto(rota)}
                      className={`flex w-full items-start gap-3 rounded-lg border-l-[3px] px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                        ehUrgente(item)
                          ? 'border-l-destructive bg-destructive/[0.04]'
                          : 'border-l-border'
                      }`}
                    >
                      {corpo}
                    </button>
                  ) : (
                    <div
                      className={`flex items-start gap-3 rounded-lg border-l-[3px] px-3 py-3 ${
                        ehUrgente(item)
                          ? 'border-l-destructive bg-destructive/[0.04]'
                          : 'border-l-border'
                      }`}
                    >
                      {corpo}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {restantes > 0 ? (
            <p className="px-3 pt-3 text-xs text-muted-foreground">
              e mais {restantes} {restantes === 1 ? 'alerta' : 'alertas'} na central.
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-border/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <Checkbox
              checked={naoMostrarNovamente}
              onCheckedChange={(valor) => setNaoMostrarNovamente(valor === true)}
            />
            Não mostrar novamente ao entrar
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={verTodas}
            >
              Ver todas
            </Button>
            <Button type="button" className="h-11 w-full sm:h-9 sm:w-auto" onClick={fechar}>
              Entendi
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
