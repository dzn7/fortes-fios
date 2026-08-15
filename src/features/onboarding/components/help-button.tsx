'use client'

import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '../context'

export const HelpButton = () => {
  const pathname = usePathname() ?? ''
  const { activeTour, openHelpPanel } = useOnboarding()

  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login') || activeTour) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-4 z-40">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full bg-background/95 shadow-sm backdrop-blur"
        onClick={openHelpPanel}
        aria-label="Abrir ajuda do painel"
      >
        <HelpCircle className="h-4 w-4 text-primary" />
        Ajuda
      </Button>
    </div>
  )
}
