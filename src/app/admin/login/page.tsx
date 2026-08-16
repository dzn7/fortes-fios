'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import TelaSelecaoPerfil from '@/components/login/TelaSelecaoPerfil'
import { type UsuarioSistema } from '@/lib/autenticacao'
import { Loader2 } from 'lucide-react'

/**
 * Login do Admin.
 *
 * A senha vai uma única vez para `/api/admin/sessao`, que a confere no banco e
 * devolve um cookie assinado `httpOnly`. O "lembrar de mim" que guardava
 * usuário e SENHA em texto claro no `localStorage` saiu junto com as duas
 * credenciais que estavam escritas dentro do bundle.
 *
 * Spec: specs/rbac-admin.md §7
 */
export default function AdminLogin() {
  const { isAuthenticated, loading, autenticarNoServidor } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/admin/dashboard')
    }
  }, [loading, isAuthenticated, router])

  // Limpa o que o modelo antigo deixou no navegador, inclusive a senha salva.
  useEffect(() => {
    localStorage.removeItem('admin_saved_username')
    localStorage.removeItem('admin_saved_password')
    localStorage.removeItem('admin_remember_me')
    localStorage.removeItem('adminToken')
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-laranja-500 animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) return null

  // A sessão já foi criada pelo servidor em `autenticarNoServidor`; aqui só
  // resta sair da tela de login.
  const handleAutenticar = (_usuario: UsuarioSistema) => {
    router.push('/admin/dashboard')
  }

  return (
    <TelaSelecaoPerfil
      papel="admin"
      papeisListados={['admin', 'atendente']}
      aoAutenticar={handleAutenticar}
      autenticarNoServidor={autenticarNoServidor}
    />
  )
}
