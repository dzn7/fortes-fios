'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { podeVerRota } from '@/lib/rbac.mjs'
import { Loader2, ShieldOff } from 'lucide-react'

/**
 * Porteiro das telas do Admin.
 *
 * Duas checagens: existe sessão, e essa sessão alcança esta rota. A versão
 * anterior aceitava qualquer `localStorage.adminToken` que começasse com
 * `admin-authenticated-` — uma linha no console do navegador virava
 * administrador.
 *
 * Isto continua sendo **UX**: quem realmente barra o acesso ao dado é o
 * `exigirPermissao` do route handler. Um atendente que digite `/admin/financas`
 * na barra vê o aviso abaixo; se contornar isso, a API ainda responde 403.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, permissoes } = useAdminAuth()
  const pathname = usePathname()
  const router = useRouter()

  const autorizado = isAuthenticated && podeVerRota(pathname || '', permissoes)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-laranja-500 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!autorizado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <ShieldOff strokeWidth={1.5} className="size-7 text-muted-foreground" />
        </span>
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Sem acesso a esta área
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu acesso não inclui esta tela. Fale com um administrador se você precisa dela
            para trabalhar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/dashboard')}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          Voltar ao início
        </button>
      </div>
    )
  }

  return <>{children}</>
}
