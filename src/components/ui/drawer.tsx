'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { useAjusteTecladoVirtual } from '@/hooks/useAjusteTecladoVirtual'
import {
  CamadaSuperficieProvider,
  useCamadaOverlay,
  useCamadaSuperficie,
} from '@/components/ui/overlay-layer'
import { cn } from '@/lib/utils'

const Drawer = ({
  shouldScaleBackground = false,
  /**
   * Desligado por padrão: o `repositionInputs` do vaul 1.1.2 *alterna*
   * (`!keyboardIsOpen`) um booleano a cada `visualViewport.resize`, e
   * Safari/Chromium emitem vários eventos por animação de teclado. O flag
   * dessincroniza, o handler passa a sair cedo e o `style.height`/`style.bottom`
   * inline fica congelado numa altura curta — que vence qualquer `dvh` do CSS.
   * Quem mede o teclado aqui é o `DrawerContent`, sempre a partir da medida
   * atual e nunca de estado acumulado.
   */
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    repositionInputs={repositionInputs}
    {...props}
  />
)
Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerNested = DrawerPrimitive.NestedRoot

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const camada = useCamadaOverlay()
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn('fixed inset-0 bg-black/80', className)}
      style={{ zIndex: camada.overlay, ...style }}
      {...props}
    />
  )
})
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const camada = useCamadaSuperficie()
  // O conteúdo só existe enquanto o drawer está aberto, então a medição
  // acompanha exatamente o ciclo de vida da superfície.
  const ajusteTeclado = useAjusteTecladoVirtual(true)

  return (
    <DrawerPortal>
      <DrawerOverlay style={{ zIndex: camada.overlay }} />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-x-0 bottom-0 mt-24 flex max-h-[96dvh] flex-col rounded-t-[10px] border border-border/70 bg-card text-card-foreground outline-none',
          className,
        )}
        style={{
          zIndex: camada.conteudo,
          // Nunca `height`: a maioria dos drawers tem altura pelo conteúdo e
          // seria esticada. `maxHeight` + `bottom` encaixa o painel na área
          // visível acima do teclado sem alterar quem já cabe.
          ...(ajusteTeclado
            ? { maxHeight: `${ajusteTeclado.altura}px`, bottom: `${ajusteTeclado.base}px` }
            : null),
          // O consumidor vence: o checkout público já aplica o próprio ajuste.
          ...style,
        }}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-[100px] shrink-0 rounded-full bg-muted" aria-hidden />
        <CamadaSuperficieProvider profundidade={camada.profundidade}>
          {children}
        </CamadaSuperficieProvider>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = 'DrawerContent'

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-1.5 p-4 text-center sm:text-left', className)} {...props} />
)
DrawerHeader.displayName = 'DrawerHeader'

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-auto flex shrink-0 flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
      className,
    )}
    {...props}
  />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerNested,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
