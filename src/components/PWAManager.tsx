'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import {
  ACOES_ATUALIZACAO,
  decidirAcaoAoTrocarControlador,
} from '@/lib/atualizacao-pwa.mjs'

// Flag global para prevenir múltiplos reloads
let isReloading = false

export default function PWAManager() {
  const pathname = usePathname()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const controllerChangeHandledRef = useRef(false)
  const controllerChangeHandlerRef = useRef<(() => void) | null>(null)
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Quem controlava a página quando ela abriu, e se a pessoa pediu a
  // atualização. Juntos decidem o que fazer no `controllerchange` — recarregar
  // sozinho durante o carregamento era o que derrubava a primeira visita.
  const tinhaControladorRef = useRef(false)
  const pediuAtualizacaoRef = useRef(false)
  const deveGerenciarPwaCliente =
    !(pathname?.startsWith('/admin') || pathname?.startsWith('/garcom') || pathname?.startsWith('/entregador'))

  useEffect(() => {
    if (!deveGerenciarPwaCliente) {
      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current)
        updateCheckIntervalRef.current = null
      }
      setUpdateAvailable(false)
      setIsUpdating(false)
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker?.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
        controllerChangeHandlerRef.current = null
      }
      return
    }

    // Previne execução no servidor
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )

      if (typeof caches !== 'undefined') {
        void caches.keys().then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.includes('fortes-fios-client') || cacheName.includes('edienai-lanches-client'))
              .map((cacheName) => caches.delete(cacheName))
          )
        )
      }
      return
    }

    registerServiceWorker()

    // Cleanup ao desmontar
    return () => {
      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current)
        updateCheckIntervalRef.current = null
      }
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
        controllerChangeHandlerRef.current = null
      }
    }
  }, [deveGerenciarPwaCliente])

  const registerServiceWorker = async () => {
    try {
      console.log('[PWA] Iniciando registro do Service Worker')

      // Registra o service worker
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      console.log('[PWA] Service Worker registrado com sucesso')
      setRegistration(reg)

      // O controlador atual define, mais tarde, se um `controllerchange` é a
      // primeira instalação (ignorar) ou uma versão nova assumindo (oferecer).
      tinhaControladorRef.current = Boolean(navigator.serviceWorker.controller)

      // Busca atualização logo após registrar (sem esperar intervalo)
      try {
        await reg.update()
      } catch (erroUpdate) {
        console.warn('[PWA] Falha ao atualizar imediatamente:', erroUpdate)
      }

      // Versão nova esperando: avisa e deixa a pessoa decidir. Assumir o
      // controle sozinho troca o worker embaixo de uma página já carregada.
      if (reg.waiting) {
        console.log('[PWA] Atualização já disponível')
        setUpdateAvailable(true)
      }

      // Listener para novas atualizações encontradas
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        console.log('[PWA] Nova atualização encontrada')
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[PWA] Estado do novo SW:', newWorker.state)
            
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nova versão instalada e pronta')
              setUpdateAvailable(true)
            }
          })
        }
      })

      // Listener único para mudança de controller
      const handleControllerChange = () => {
        console.log('[PWA] Controller mudou')

        // Previne múltiplas execuções
        if (controllerChangeHandledRef.current || isReloading) {
          console.log('[PWA] Controller change já tratado, ignorando')
          return
        }

        const acao = decidirAcaoAoTrocarControlador({
          tinhaControlador: tinhaControladorRef.current,
          pedidoPelaPessoa: pediuAtualizacaoRef.current,
        })

        // Primeira instalação: a página aberta já tem o HTML e os chunks certos.
        if (acao === ACOES_ATUALIZACAO.IGNORAR) return

        if (acao === ACOES_ATUALIZACAO.OFERECER) {
          setUpdateAvailable(true)
          return
        }

        controllerChangeHandledRef.current = true
        isReloading = true
        setUpdateAvailable(false)
        setIsUpdating(true)
        window.location.reload()
      }

      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
      }
      controllerChangeHandlerRef.current = handleControllerChange
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

      // Verifica atualizações periodicamente (60 segundos)
      updateCheckIntervalRef.current = setInterval(() => {
        console.log('[PWA] Verificando atualizações...')
        reg.update().then(() => {
          if (reg.waiting) {
            setUpdateAvailable(true)
          }
        }).catch(err => {
          console.warn('[PWA] Erro ao verificar atualização:', err)
        })
      }, 60000)

    } catch (error) {
      console.error('[PWA] Erro ao registrar Service Worker:', error)
    }
  }

  const handleUpdate = async () => {
    // Só aqui o reload passa a ser legítimo: foi a pessoa que pediu.
    pediuAtualizacaoRef.current = true
    setIsUpdating(true)

    // Sem worker esperando, a versão nova já assumiu sozinha (o `skipWaiting`
    // do install). Não há `controllerchange` por vir, então o botão precisa
    // recarregar aqui mesmo — senão ele não faria nada.
    if (!registration?.waiting) {
      console.log('[PWA] Nenhum SW esperando; recarregando a pedido da pessoa')
      isReloading = true
      window.location.reload()
      return
    }

    try {
      console.log('[PWA] Enviando SKIP_WAITING para o SW')

      // Envia mensagem para o SW waiting pular a espera
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // O reload será automático via controllerchange
    } catch (error) {
      console.error('[PWA] Erro ao atualizar:', error)
      setIsUpdating(false)
      setUpdateAvailable(false)
    }
  }

  // Banner de atualização
  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[10001] 
                    bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-2xl p-4 
                    border border-amber-400 animate-slide-up">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-bold mb-1 flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Atualizando...' : 'Nova versão disponível!'}
            </h4>
            <p className="text-sm text-amber-100">
              {isUpdating 
                ? 'Aguarde, estamos aplicando as melhorias...' 
                : 'Clique em atualizar para ter acesso às últimas melhorias.'}
            </p>
          </div>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap
                     ${isUpdating 
                       ? 'bg-amber-300 text-amber-700 cursor-not-allowed opacity-75' 
                       : 'bg-white text-amber-600 hover:bg-amber-50 hover:shadow-lg'}`}
          >
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Atualizando
              </span>
            ) : (
              'Atualizar'
            )}
          </button>
        </div>
      </div>
    )
  }

  return null
}
