'use client'

import { forwardRef } from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNotificacoes } from '@/contexts/NotificacoesContext'
import { PainelNotificacoes } from './PainelNotificacoes'

/**
 * Sino do header e a superfície da central.
 *
 * O painel mora aqui, e não no `NotificacoesRoot`, porque no desktop ele é um
 * `Popover` ancorado no próprio sino — o gatilho precisa estar na mesma árvore.
 * Abaixo de 768 px vira `Drawer` (o `Dialog` compartilhado já faz essa troca),
 * onde não existe âncora que caiba na tela.
 *
 * O badge sai de contadores que o servidor devolve por index-only scan — nunca
 * de uma varredura da lista.
 */

const BotaoSino = forwardRef<
  HTMLButtonElement,
  { className?: string; onClick?: () => void; naoLidas: number; temUrgente: boolean }
>(({ className, onClick, naoLidas, temUrgente, ...props }, ref) => {
  const rotulo =
    naoLidas === 0
      ? 'Notificações: nenhuma não lida'
      : `Notificações: ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={cn(
        'relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-[state=open]:bg-accent data-[state=open]:text-foreground',
        className,
      )}
      {...props}
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
})
BotaoSino.displayName = 'BotaoSino'

export function SinoNotificacoes({ className }: { className?: string }) {
  const isMobile = useIsMobile()
  const { resumo, painelAberto, abrirPainel, fecharPainel } = useNotificacoes()

  const naoLidas = resumo.naoLidas
  const temUrgente = resumo.urgentes > 0

  if (isMobile) {
    return (
      <>
        <BotaoSino
          className={className}
          onClick={abrirPainel}
          naoLidas={naoLidas}
          temUrgente={temUrgente}
        />
        <Dialog
          open={painelAberto}
          onOpenChange={(aberto) => {
            if (!aberto) fecharPainel()
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[85dvh] flex-col gap-0 overflow-y-hidden p-0"
          >
            <DialogTitle className="sr-only">Notificações</DialogTitle>
            <DialogDescription className="sr-only">
              Alertas de estoque e pedidos que precisam de atenção.
            </DialogDescription>
            <PainelNotificacoes onFechar={fecharPainel} />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Popover
      open={painelAberto}
      onOpenChange={(aberto) => (aberto ? abrirPainel() : fecharPainel())}
    >
      <PopoverTrigger asChild>
        <BotaoSino className={className} naoLidas={naoLidas} temUrgente={temUrgente} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="flex w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-y-hidden p-0"
        // `max-h` inline porque precisa combinar um teto fixo com a altura que o
        // Radix mede: em classe, a vírgula do `min()` não sobrevive ao JIT.
        style={{ maxHeight: 'min(32rem, var(--radix-popover-content-available-height))' }}
      >
        <PainelNotificacoes onFechar={fecharPainel} />
      </PopoverContent>
    </Popover>
  )
}
