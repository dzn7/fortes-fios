'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import {
  deltaResumo,
  notificacaoVisivelNaCentral,
  resumirNotificacoes,
  selecionarNotificacoesDoModal,
  type Notificacao,
  type ResumoNotificacoes,
} from '@/lib/notificacoes.mjs'

/**
 * Origem única das notificações do Admin.
 *
 * Montado uma vez em `src/app/admin/layout.tsx`, como o OnboardingProvider —
 * assim nenhuma tela abre a própria consulta e não existe query duplicada.
 *
 * Estratégia de atualização (spec §6): sem Realtime. A publication
 * `supabase_realtime` deste projeto está vazia, e websocket aberto gastaria
 * egress do plano free continuamente, inclusive com o painel ocioso. No lugar:
 *
 *   - uma busca completa ao montar;
 *   - `invalidar()` logo após uma mutação de estoque/pedido na própria aba;
 *   - revalidação por foco da janela, com throttle, buscando só os contadores
 *     e indo atrás da lista apenas quando eles mudam.
 *
 * Não há polling por intervalo.
 */

const CHAVE_USUARIO_PADRAO = 'admin-local'
const INTERVALO_MINIMO_REVALIDACAO_MS = 60_000

const RESUMO_VAZIO: ResumoNotificacoes = { urgentes: 0, normais: 0, naoLidas: 0, total: 0 }

type AcaoNotificacao =
  | { acao: 'visualizadas'; ids: string[] }
  | { acao: 'lida'; ids: string[] }
  | { acao: 'lidas_todas' }
  | { acao: 'silenciada'; ids: string[] }
  | { acao: 'preferencia_modal'; ativo: boolean }

type NotificacoesContextValue = {
  resumo: ResumoNotificacoes
  notificacoes: Notificacao[]
  carregando: boolean
  modalAtivo: boolean
  painelAberto: boolean
  alertasDeEntrada: Notificacao[]
  abrirPainel: () => void
  fecharPainel: () => void
  fecharAlertasDeEntrada: (naoMostrarNovamente: boolean) => void
  marcarComoLida: (id: string) => void
  marcarTodasComoLidas: () => void
  dispensar: (id: string) => void
  reativarModalDeEntrada: () => void
  carregarHistorico: () => void
  invalidar: () => void
}

const NotificacoesContext = createContext<NotificacoesContextValue | undefined>(undefined)

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, usuarioAtual, loading } = useAdminAuth()
  const pathname = usePathname()

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [resumo, setResumo] = useState<ResumoNotificacoes>(RESUMO_VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [modalAtivo, setModalAtivo] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [alertasDeEntrada, setAlertasDeEntrada] = useState<Notificacao[]>([])

  const ultimaBuscaRef = useRef(0)
  const buscandoRef = useRef(false)
  const entradaJaAvaliadaRef = useRef(false)
  // Lido pela revalidação sem entrar nas dependências: se `resumo` fosse
  // dependência, o listener de foco seria removido e re-registrado a cada
  // atualização de contador.
  const resumoRef = useRef<ResumoNotificacoes>(RESUMO_VAZIO)
  // Espelho síncrono da coleção. A marcação otimista precisa calcular o delta
  // ANTES de chamar os setters: fazer isso dentro do updater de `setNotificacoes`
  // seria efeito colateral em updater, que o StrictMode executa duas vezes.
  const notificacoesRef = useRef<Notificacao[]>([])

  const definirNotificacoes = useCallback((lista: Notificacao[]) => {
    notificacoesRef.current = lista
    setNotificacoes(lista)
  }, [])

  const usuarioChave = usuarioAtual?.id || CHAVE_USUARIO_PADRAO
  const ativo = !loading && isAuthenticated && pathname !== '/admin/login'

  const buscarCompleto = useCallback(async (incluirResolvidas = false) => {
    if (buscandoRef.current) return
    buscandoRef.current = true
    setCarregando(true)

    try {
      const resposta = await fetch(
        `/api/admin/notificacoes?modo=completo&usuarioChave=${encodeURIComponent(usuarioChave)}${
          incluirResolvidas ? '&incluirResolvidas=true' : ''
        }`,
      )
      const json = (await resposta.json()) as {
        sucesso?: boolean
        resumo?: ResumoNotificacoes
        notificacoes?: Notificacao[]
        modalAtivo?: boolean
      }

      if (!resposta.ok || !json.sucesso) return

      const lista = Array.isArray(json.notificacoes) ? json.notificacoes : []
      definirNotificacoes(lista)
      setResumo(json.resumo ?? resumirNotificacoes(lista))
      setModalAtivo(json.modalAtivo !== false)
      ultimaBuscaRef.current = Date.now()

      // O modal de entrada é avaliado uma vez por sessão do Admin. Depois disso
      // uma notificação nova aparece no sino, sem interromper a navegação.
      if (!entradaJaAvaliadaRef.current && json.modalAtivo !== false) {
        entradaJaAvaliadaRef.current = true
        const selecionadas = selecionarNotificacoesDoModal(lista)
        if (selecionadas.length > 0) setAlertasDeEntrada(selecionadas)
      }
    } catch {
      // Sem rede: o painel mantém o que já tinha; a próxima ação tenta de novo.
    } finally {
      buscandoRef.current = false
      setCarregando(false)
    }
  }, [definirNotificacoes, usuarioChave])

  const revalidarResumo = useCallback(async () => {
    if (buscandoRef.current) return
    if (Date.now() - ultimaBuscaRef.current < INTERVALO_MINIMO_REVALIDACAO_MS) return

    try {
      const resposta = await fetch(
        `/api/admin/notificacoes?modo=resumo&usuarioChave=${encodeURIComponent(usuarioChave)}`,
      )
      const json = (await resposta.json()) as { sucesso?: boolean; resumo?: ResumoNotificacoes }
      if (!resposta.ok || !json.sucesso || !json.resumo) return

      ultimaBuscaRef.current = Date.now()

      const anterior = resumoRef.current
      const mudou =
        json.resumo.total !== anterior.total ||
        json.resumo.urgentes !== anterior.urgentes ||
        json.resumo.naoLidas !== anterior.naoLidas

      setResumo(json.resumo)
      // Só paga o custo da lista quando os contadores acusam mudança.
      if (mudou) void buscarCompleto()
    } catch {
      /* revalidação silenciosa */
    }
  }, [buscarCompleto, usuarioChave])

  useEffect(() => {
    if (!ativo) {
      definirNotificacoes([])
      setResumo(RESUMO_VAZIO)
      setAlertasDeEntrada([])
      entradaJaAvaliadaRef.current = false
      ultimaBuscaRef.current = 0
      return
    }

    // Guarda contra a montagem dupla do StrictMode em desenvolvimento: uma
    // busca recente e bem-sucedida não precisa ser refeita.
    if (Date.now() - ultimaBuscaRef.current < INTERVALO_MINIMO_REVALIDACAO_MS) return

    void buscarCompleto()
  }, [ativo, buscarCompleto, definirNotificacoes])

  useEffect(() => {
    resumoRef.current = resumo
  }, [resumo])

  useEffect(() => {
    if (!ativo || typeof window === 'undefined') return

    const aoFocar = () => {
      if (document.visibilityState === 'visible') void revalidarResumo()
    }

    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoFocar)
    return () => {
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [ativo, revalidarResumo])

  const enviarAcao = useCallback(
    async (payload: AcaoNotificacao) => {
      try {
        const resposta = await fetch('/api/admin/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioChave, ...payload }),
        })
        const json = (await resposta.json()) as {
          sucesso?: boolean
          resumo?: ResumoNotificacoes
        }
        if (resposta.ok && json.sucesso && json.resumo) setResumo(json.resumo)
      } catch {
        // A marcação otimista já aconteceu; a próxima busca completa reconcilia.
      }
    },
    [usuarioChave],
  )

  /**
   * Marcação otimista: atualiza a coleção local e ajusta o badge pelo DELTA.
   *
   * Não recontar a lista inteira é proposital — ela vem truncada em 20 itens,
   * então um recálculo total faria o badge cair para o tamanho da página
   * sempre que o usuário marcasse algo. A resposta do servidor, que conta no
   * banco, sobrescreve logo em seguida.
   *
   * O delta é somado FORA dos updaters, sobre o espelho síncrono: updater de
   * estado precisa ser puro e o StrictMode o executa duas vezes.
   */
  const aplicarLocalmente = useCallback(
    (ids: string[], campos: Partial<Notificacao>) => {
      if (ids.length === 0) return
      const alvo = new Set(ids)
      const delta = { urgentes: 0, normais: 0, naoLidas: 0, total: 0 }

      const proxima = notificacoesRef.current.map((item) => {
        if (!alvo.has(item.id)) return item

        const atualizada = { ...item, ...campos }
        const parcela = deltaResumo(item, atualizada)
        delta.urgentes += parcela.urgentes
        delta.normais += parcela.normais
        delta.naoLidas += parcela.naoLidas
        delta.total += parcela.total
        return atualizada
      })

      definirNotificacoes(proxima)

      if (delta.urgentes || delta.normais || delta.naoLidas || delta.total) {
        setResumo((anterior) => ({
          urgentes: Math.max(0, anterior.urgentes + delta.urgentes),
          normais: Math.max(0, anterior.normais + delta.normais),
          naoLidas: Math.max(0, anterior.naoLidas + delta.naoLidas),
          total: Math.max(0, anterior.total + delta.total),
        }))
      }
    },
    [definirNotificacoes],
  )

  const marcarComoLida = useCallback(
    (id: string) => {
      const agora = new Date().toISOString()
      aplicarLocalmente([id], { visualizada_em: agora, lida_em: agora })
      void enviarAcao({ acao: 'lida', ids: [id] })
    },
    [aplicarLocalmente, enviarAcao],
  )

  const marcarTodasComoLidas = useCallback(() => {
    const agora = new Date().toISOString()
    aplicarLocalmente(
      notificacoes
        .filter((item) => notificacaoVisivelNaCentral(item) && !item.lida_em)
        .map((item) => item.id),
      { visualizada_em: agora, lida_em: agora },
    )
    void enviarAcao({ acao: 'lidas_todas' })
  }, [aplicarLocalmente, enviarAcao, notificacoes])

  /**
   * Dispensar silencia ESTA ocorrência: ela sai da lista e do badge na hora.
   * A linha continua ativa no banco porque a condição continua verdadeira — o
   * que reaparece depois é uma reincidência, que nasce como linha nova.
   */
  const dispensar = useCallback(
    (id: string) => {
      const agora = new Date().toISOString()
      aplicarLocalmente([id], { visualizada_em: agora, silenciada_em: agora })
      setAlertasDeEntrada((atual) => atual.filter((item) => item.id !== id))
      void enviarAcao({ acao: 'silenciada', ids: [id] })
    },
    [aplicarLocalmente, enviarAcao],
  )

  const fecharAlertasDeEntrada = useCallback(
    (naoMostrarNovamente: boolean) => {
      const ids = alertasDeEntrada.map((item) => item.id)
      setAlertasDeEntrada([])

      // Fechar já marca as exibidas como visualizadas: aquelas ocorrências não
      // voltam ao modal. Uma notificação NOVA reabre normalmente.
      aplicarLocalmente(ids, { visualizada_em: new Date().toISOString() })
      void enviarAcao({ acao: 'visualizadas', ids })

      // "Não mostrar novamente" é a preferência durável do usuário: o modal de
      // entrada deixa de abrir até ele reativar pelo painel.
      if (naoMostrarNovamente) {
        setModalAtivo(false)
        void enviarAcao({ acao: 'preferencia_modal', ativo: false })
      }
    },
    [alertasDeEntrada, aplicarLocalmente, enviarAcao],
  )

  const reativarModalDeEntrada = useCallback(() => {
    setModalAtivo(true)
    void enviarAcao({ acao: 'preferencia_modal', ativo: true })
  }, [enviarAcao])

  const invalidar = useCallback(() => {
    if (!ativo) return
    ultimaBuscaRef.current = 0
    void buscarCompleto()
  }, [ativo, buscarCompleto])

  const abrirPainel = useCallback(() => setPainelAberto(true), [])
  const fecharPainel = useCallback(() => setPainelAberto(false), [])

  /**
   * Histórico recente — resolvidas e dispensadas — buscado só quando pedido.
   * Fora daí a lista carrega apenas o que está ativo e visível.
   */
  const carregarHistorico = useCallback(() => {
    ultimaBuscaRef.current = 0
    void buscarCompleto(true)
  }, [buscarCompleto])

  const valor = useMemo<NotificacoesContextValue>(
    () => ({
      resumo,
      notificacoes,
      carregando,
      modalAtivo,
      painelAberto,
      alertasDeEntrada,
      abrirPainel,
      fecharPainel,
      fecharAlertasDeEntrada,
      marcarComoLida,
      marcarTodasComoLidas,
      dispensar,
      reativarModalDeEntrada,
      carregarHistorico,
      invalidar,
    }),
    [
      abrirPainel,
      alertasDeEntrada,
      carregando,
      carregarHistorico,
      dispensar,
      fecharAlertasDeEntrada,
      fecharPainel,
      invalidar,
      marcarComoLida,
      marcarTodasComoLidas,
      modalAtivo,
      notificacoes,
      painelAberto,
      reativarModalDeEntrada,
      resumo,
    ],
  )

  return <NotificacoesContext.Provider value={valor}>{children}</NotificacoesContext.Provider>
}

export function useNotificacoes() {
  const contexto = useContext(NotificacoesContext)
  if (!contexto) {
    throw new Error('useNotificacoes precisa estar dentro de NotificacoesProvider')
  }
  return contexto
}

/**
 * Versão tolerante para componentes que também rodam fora do shell do Admin.
 * Devolve `null` em vez de quebrar a tela.
 */
export function useNotificacoesOpcional() {
  return useContext(NotificacoesContext) ?? null
}
