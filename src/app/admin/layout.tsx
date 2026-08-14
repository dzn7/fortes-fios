'use client'

import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { ImpressoraProvider } from '@/contexts/ImpressoraContext'
import PWAManagerAdmin from '@/components/admin/PWAManagerAdmin'
import { OnboardingProvider, OnboardingRoot } from '@/features/onboarding'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ImpressoraProvider>
        <OnboardingProvider>
          {/*
            Marcador SSR do shell administrativo. Existe para o CSS: a regra que
            garante fonte de 16px nos campos (contra o zoom automático do
            Safari/iOS) precisa partir do `body`, porque todo overlay é
            portalizado para lá — um seletor descendente do layout do admin não
            alcançaria os drawers. Espelha o `.fortes-fios-site` da loja pública.
          */}
          <span data-admin-shell hidden aria-hidden />
          <PWAManagerAdmin />
          {children}
          <OnboardingRoot />
        </OnboardingProvider>
      </ImpressoraProvider>
    </AdminAuthProvider>
  )
}
