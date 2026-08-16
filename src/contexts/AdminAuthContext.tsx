'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { limparSessao, type UsuarioSistema } from '@/lib/autenticacao'
import { podeExecutar, type PermissoesAdmin } from '@/lib/rbac.mjs'

/**
 * Identidade e permissões do Admin.
 *
 * Antes, isto era um booleano derivado de uma string em `localStorage` e de
 * duas senhas escritas dentro do bundle. Qualquer visitante virava
 * administrador com uma linha no console, e o servidor não tinha como saber
 * quem chamava — o que tornava impossível qualquer autorização de verdade.
 *
 * Agora a fonte é o cookie `httpOnly` assinado que `/api/admin/sessao` emite:
 * este contexto não guarda credencial nenhuma, apenas pergunta ao servidor
 * quem está logado e o que essa pessoa pode fazer.
 *
 * `permissoes` chega já resolvida (preset do papel + overrides). A UI nunca
 * pergunta `papel === 'atendente'`; pergunta `pode('financas.ver')`.
 *
 * Esconder componente por aqui é UX, não segurança: quem garante é o
 * `exigirPermissao` do route handler.
 *
 * Spec: specs/rbac-admin.md
 */

type AdminAuthContextType = {
  isAuthenticated: boolean
  usuarioAtual: UsuarioSistema | null
  permissoes: PermissoesAdmin
  pode: (permissao: string) => boolean
  login: (nomeUsuario: string, senha: string) => Promise<boolean>
  loginAsync: (nomeUsuario: string, senha: string) => Promise<boolean>
  autenticarNoServidor: (
    nomeUsuario: string,
    senha: string,
  ) => Promise<{ sucesso: boolean; usuario?: UsuarioSistema; erro?: string }>
  recarregarSessao: () => Promise<void>
  logout: () => void
  loading: boolean
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

const SEM_PERMISSOES: PermissoesAdmin = {}

type RespostaSessao = {
  sucesso?: boolean
  usuario?: {
    id: string
    nome: string
    nome_usuario: string
    papel: string
    avatar_url: string | null
    cor_avatar: string
  }
  permissoes?: PermissoesAdmin
  erro?: string
}

const paraUsuarioSistema = (bruto: NonNullable<RespostaSessao['usuario']>): UsuarioSistema => ({
  id: bruto.id,
  nome: bruto.nome,
  nome_usuario: bruto.nome_usuario,
  papel: bruto.papel as UsuarioSistema['papel'],
  avatar_url: bruto.avatar_url,
  cor_avatar: bruto.cor_avatar || '#f97316',
  funcionario_id: null,
})

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [usuarioAtual, setUsuarioAtual] = useState<UsuarioSistema | null>(null)
  const [permissoes, setPermissoes] = useState<PermissoesAdmin>(SEM_PERMISSOES)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const aplicarSessao = useCallback((json: RespostaSessao) => {
    if (json.sucesso && json.usuario) {
      setUsuarioAtual(paraUsuarioSistema(json.usuario))
      setPermissoes(json.permissoes || SEM_PERMISSOES)
      return true
    }
    setUsuarioAtual(null)
    setPermissoes(SEM_PERMISSOES)
    return false
  }, [])

  const recarregarSessao = useCallback(async () => {
    try {
      const resposta = await fetch('/api/admin/sessao', { credentials: 'same-origin' })
      aplicarSessao((await resposta.json()) as RespostaSessao)
    } catch {
      setUsuarioAtual(null)
      setPermissoes(SEM_PERMISSOES)
    } finally {
      setLoading(false)
    }
  }, [aplicarSessao])

  useEffect(() => {
    void recarregarSessao()
  }, [recarregarSessao])

  /**
   * Revalida ao voltar para a aba. É o que faz uma permissão revogada parar de
   * valer sem polling: o servidor compara a versão do cookie com a do banco e
   * recusa a sessão antiga.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const aoFocar = () => {
      if (document.visibilityState === 'visible') void recarregarSessao()
    }

    document.addEventListener('visibilitychange', aoFocar)
    return () => document.removeEventListener('visibilitychange', aoFocar)
  }, [recarregarSessao])

  const autenticarNoServidor = useCallback(
    async (nomeUsuario: string, senha: string) => {
      try {
        const resposta = await fetch('/api/admin/sessao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ nomeUsuario, senha }),
        })
        const json = (await resposta.json()) as RespostaSessao

        if (!resposta.ok || !json.sucesso || !json.usuario) {
          return { sucesso: false, erro: json.erro || 'Usuário ou senha incorretos' }
        }

        aplicarSessao(json)
        return { sucesso: true, usuario: paraUsuarioSistema(json.usuario) }
      } catch {
        return { sucesso: false, erro: 'Erro ao conectar com o servidor' }
      }
    },
    [aplicarSessao],
  )

  const login = useCallback(
    async (nomeUsuario: string, senha: string) => {
      const resultado = await autenticarNoServidor(nomeUsuario, senha)
      return resultado.sucesso
    },
    [autenticarNoServidor],
  )

  const logout = useCallback(() => {
    // Só o servidor apaga o cookie: ele é httpOnly, então o cliente não alcança.
    void fetch('/api/admin/sessao', { method: 'DELETE', credentials: 'same-origin' })

    // Restos do modelo antigo, que guardava senha em texto claro no navegador.
    localStorage.removeItem('adminToken')
    localStorage.removeItem('admin_saved_username')
    localStorage.removeItem('admin_saved_password')
    localStorage.removeItem('admin_remember_me')
    limparSessao()

    setUsuarioAtual(null)
    setPermissoes(SEM_PERMISSOES)
    router.push('/admin/login')
  }, [router])

  const pode = useCallback(
    (permissao: string) => podeExecutar(permissoes, permissao),
    [permissoes],
  )

  const valor = useMemo<AdminAuthContextType>(
    () => ({
      isAuthenticated: usuarioAtual !== null,
      usuarioAtual,
      permissoes,
      pode,
      login,
      loginAsync: login,
      autenticarNoServidor,
      recarregarSessao,
      logout,
      loading,
    }),
    [autenticarNoServidor, loading, login, logout, pode, permissoes, recarregarSessao, usuarioAtual],
  )

  return <AdminAuthContext.Provider value={valor}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth deve ser usado dentro de AdminAuthProvider')
  }
  return context
}

/** Atalho para telas: `const pode = usePermissoes()` → `pode('financas.ver')`. */
export function usePermissoes() {
  return useAdminAuth().pode
}
