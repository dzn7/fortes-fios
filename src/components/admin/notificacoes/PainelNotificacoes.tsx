'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, CheckCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { agruparPorPrioridade } from '@/lib/notificacoes.mjs'
import { useNotificacoes } from '@/contexts/NotificacoesContext'
import { ItemNotificacao } from './ItemNotificacao'

/**
 * Central de notificações.
 *
 * Superfície: `Dialog` compartilhado, que já vira `Drawer` vaul abaixo de
 * 768 px com handle, swipe, botão de 44 px e ajuste de teclado virtual. Mesmo
 * padrão do atalho ⌘K que o header já usa. A cadeia `min-h-0 flex-1
 * overflow-y-auto` mantém o rodapé fora da área que rola — sem `max-h-[80vh]`,
 * proibido pelo UI.md no bottom sheet.
 */
export function PainelNotificacoes() {
  const router = useRouter()
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false)
  const {
    painelAberto,
    fecharPainel,
    notificacoes,
    carregando,
    resumo,
    modalAtivo,
    marcarComoLida,
    marcarTodasComoLidas,
    dispensar,
    reativarModalDeEntrada,
    carregarResolvidas,
  } = useNotificacoes()

  const ativas = notificacoes.filter((item) => item.estado === 'ativa')
  const resolvidas = notificacoes.filter((item) => item.estado === 'resolvida')
  const { urgentes, normais } = agruparPorPrioridade(ativas)

  const irParaContexto = (rota: string) => {
    fecharPainel()
    router.push(rota)
  }

  return (
    <Dialog open={painelAberto} onOpenChange={(aberto) => { if (!aberto) fecharPainel() }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Notificações</DialogTitle>
        <DialogDescription className="sr-only">
          Alertas de estoque e pedidos que precisam de atenção.
        </DialogDescription>

        <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3.5 pr-14">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell strokeWidth={1.7} className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">Notificações</p>
            <p className="truncate text-xs text-muted-foreground">
              {resumo.total === 0
                ? 'Nada precisa de atenção agora'
                : `${resumo.naoLidas} não ${resumo.naoLidas === 1 ? 'lida' : 'lidas'} de ${resumo.total} ${resumo.total === 1 ? 'ativa' : 'ativas'}`}
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {carregando && notificacoes.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : ativas.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <Bell strokeWidth={1.5} className="size-6 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium text-foreground">Tudo em dia</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum alerta de estoque ou pedido aguardando você.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {urgentes.length > 0 ? (
                <section>
                  <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-destructive">
                    Precisa de atenção
                  </h3>
                  <div className="flex flex-col">
                    {urgentes.map((item) => (
                      <ItemNotificacao
                        key={item.id}
                        notificacao={item}
                        onIrParaContexto={irParaContexto}
                        onMarcarComoLida={marcarComoLida}
                        onDispensar={dispensar}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {normais.length > 0 ? (
                <section>
                  <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Informações
                  </h3>
                  <div className="flex flex-col">
                    {normais.map((item) => (
                      <ItemNotificacao
                        key={item.id}
                        notificacao={item}
                        onIrParaContexto={irParaContexto}
                        onMarcarComoLida={marcarComoLida}
                        onDispensar={dispensar}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {mostrarResolvidas && resolvidas.length > 0 ? (
                <section>
                  <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Resolvidas
                  </h3>
                  <div className="flex flex-col">
                    {resolvidas.map((item) => (
                      <ItemNotificacao key={item.id} notificacao={item} compacto />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <footer
          className={cn(
            'flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5',
            'pb-[max(0.625rem,env(safe-area-inset-bottom))]',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={marcarTodasComoLidas}
            disabled={resumo.naoLidas === 0}
          >
            <CheckCheck strokeWidth={1.7} className="size-4" />
            Marcar todas como lidas
          </Button>

          <div className="flex items-center gap-1">
            {!modalAtivo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 text-xs text-muted-foreground"
                onClick={reativarModalDeEntrada}
              >
                <BellOff strokeWidth={1.7} className="size-4" />
                Reativar alertas ao entrar
              </Button>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              onClick={() => {
                // O efeito colateral fica FORA do updater: atualizador de
                // estado precisa ser puro, e o StrictMode o invoca duas vezes
                // — dentro dele, `carregarResolvidas` dispararia duas buscas.
                if (!mostrarResolvidas) carregarResolvidas()
                setMostrarResolvidas((atual) => !atual)
              }}
            >
              {mostrarResolvidas ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
