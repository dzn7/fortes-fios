'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { useAjusteTecladoVirtual } from '@/hooks/useAjusteTecladoVirtual'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  CamadaSuperficieProvider,
  useCamadaOverlay,
  useCamadaSuperficie,
} from '@/components/ui/overlay-layer'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

type DialogSurface = 'dialog' | 'drawer'

type DialogSurfaceContextValue = {
  surface: DialogSurface
  requestClose: (() => void) | null
}

const DialogSurfaceContext = React.createContext<DialogSurfaceContextValue>({
  surface: 'dialog',
  requestClose: null,
})

const useDialogSurface = () => React.useContext(DialogSurfaceContext)

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  variant?: 'responsive' | 'dialog'
  /** Somente mobile (Drawer vaul): quando false, não fecha ao arrastar/tocar fora. */
  dismissible?: boolean
}

const Dialog = ({ variant = 'responsive', dismissible, ...props }: DialogProps) => {
  const isMobile = useIsMobile()
  const surface: DialogSurface = variant === 'dialog' || !isMobile ? 'dialog' : 'drawer'
  const { onOpenChange } = props
  // Dialog não controlado não tem para onde encaminhar o fechamento: nesse caso
  // o próprio primitivo (Radix ou vaul) fecha, como faria sem o wrapper.
  const requestClose = React.useMemo(
    () => (onOpenChange ? () => onOpenChange(false) : null),
    [onOpenChange],
  )
  const contextValue = React.useMemo(
    () => ({ surface, requestClose }),
    [requestClose, surface],
  )

  if (surface === 'drawer') {
    return (
      <DialogSurfaceContext.Provider value={contextValue}>
        <Drawer dismissible={dismissible} {...props} />
      </DialogSurfaceContext.Provider>
    )
  }

  return (
    <DialogSurfaceContext.Provider value={contextValue}>
      <DialogPrimitive.Root {...props} />
    </DialogSurfaceContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const { surface } = useDialogSurface()
  if (surface === 'drawer') {
    return <DrawerTrigger ref={ref} {...props} />
  }
  return <DialogPrimitive.Trigger ref={ref} {...props} />
})
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName

const DialogPortal = ({ ...props }: DialogPrimitive.DialogPortalProps) => {
  const { surface } = useDialogSurface()
  if (surface === 'drawer') {
    return <>{props.children}</>
  }
  return <DialogPrimitive.Portal {...props} />
}
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>((props, ref) => {
  const { surface, requestClose } = useDialogSurface()
  const { onClick, ...closeProps } = props

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) requestClose?.()
  }

  if (surface === 'drawer') {
    return <DrawerClose ref={ref} onClick={handleClick} {...closeProps} />
  }
  return <DialogPrimitive.Close ref={ref} onClick={handleClick} {...closeProps} />
})
DialogClose.displayName = DialogPrimitive.Close.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const camada = useCamadaOverlay()
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 bg-black/80', className)}
      style={{ zIndex: camada.overlay, ...style }}
      {...props}
      ref={ref}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, style, ...props }, ref) => {
  const { surface } = useDialogSurface()

  if (surface === 'drawer') {
    return (
      <DrawerContent
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          'gap-0 overflow-y-auto overscroll-contain p-6 [-webkit-overflow-scrolling:touch]',
          className,
          // `sm:max-w-none` acompanha o `max-w-none`: a superfície só troca em
          // 768px, então um `sm:max-w-*` do consumidor voltaria a valer entre
          // 640 e 767px — dentro de um drawer de largura total.
          'left-0 right-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-[10px] sm:max-w-none',
        )}
        style={style}
        {...props}
      >
        {showCloseButton ? (
          <DialogClose
            aria-label="Fechar"
            className="absolute right-2 top-1 z-20 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground opacity-80 ring-offset-background transition-colors hover:bg-accent hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogClose>
        ) : null}
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogContentCentrado
      ref={ref}
      className={className}
      showCloseButton={showCloseButton}
      style={style}
      {...props}
    >
      {children}
    </DialogContentCentrado>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogContentCentrado = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, style, ...props }, ref) => {
  const camada = useCamadaSuperficie()

  // Em iPhone deitado a largura passa de 768px e o dialog volta a ser centrado,
  // mas `dvh` não encolhe com o teclado. Reposiciona pelo centro da área
  // realmente visível — no admin o `body` nunca rola, então o topo da área
  // visível coincide com o topo do viewport de layout.
  const ajusteTeclado = useAjusteTecladoVirtual(true)

  return (
    <DialogPortal>
      <DialogOverlay style={{ zIndex: camada.overlay }} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card p-6 text-card-foreground shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:w-full',
          className,
        )}
        style={{
          zIndex: camada.conteudo,
          ...(ajusteTeclado
            ? {
                top: `${Math.round(ajusteTeclado.altura / 2)}px`,
                maxHeight: `${Math.max(0, ajusteTeclado.altura - 16)}px`,
              }
            : null),
          ...style,
        }}
        {...props}
      >
        <CamadaSuperficieProvider profundidade={camada.profundidade}>
          {children}
        </CamadaSuperficieProvider>
        {showCloseButton ? (
          <DialogClose
            aria-label="Fechar"
            className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground opacity-80 ring-offset-background transition-colors hover:bg-accent hover:text-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogClose>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContentCentrado.displayName = 'DialogContentCentrado'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-auto flex shrink-0 flex-col-reverse gap-2 pb-[max(0px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const { surface } = useDialogSurface()
  if (surface === 'drawer') {
    return (
      <DrawerTitle
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const { surface } = useDialogSurface()
  if (surface === 'drawer') {
    return (
      <DrawerDescription
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
