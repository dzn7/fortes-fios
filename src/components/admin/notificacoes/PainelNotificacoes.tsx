'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, CheckCheck, History, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  agruparPorPrioridade,
  notificacaoNoHistorico,
  notificacaoVisivelNaCentral,
  rotaDaNotificacao,
  type Notificacao,
} from '@/lib/notificacoes.mjs'
import { useNotificacoes } from '@/contexts/NotificacoesContext'
import { ItemNotificacao } from './ItemNotificacao'

/**
 * Conteúdo da central de notificações.
 *
 * Não carrega superfície própria: o `SinoNotificacoes` o coloca dentro de um
 * `Popover` ancorado no sino (desktop) ou de um `Drawer` (mobile). Era um
 * `Dialog` centrado — modal no meio da tela para consultar aviso é peso demais
 * e tira o vínculo visual com o sino que o usuário acabou de clicar.
 *
 * A cadeia `min-h-0 flex-1 overflow-y-auto` mantém cabeçalho e rodapé fixos com
 * apenas a lista rolando, nas duas superfícies.
 */
export function PainelNotificacoes({ onFechar }: { onFechar: () => void }) {
  const router = useRouter()
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const {
    notificacoes,
    carregando,
    resumo,
    modalAtivo,
    marcarComoLida,
    marcarTodasComoLidas,
    dispensar,
    reativarModalDeEntrada,
    carregarHistorico,
  } = useNotificacoes()

  const ativas = notificacoes.filter(notificacaoVisivelNaCentral)
  const historico = notificacoes.filter(notificacaoNoHistorico)
  const { urgentes, normais } = agruparPorPrioridade(ativas)

  const abrirContexto = (notificacao: Notificacao) => {
    const rota = rotaDaNotificacao(notificacao)
    if (!rota) return
    // Ir até o contexto é atender o aviso: não faz sentido continuar não lido.
    if (!notificacao.lida_em) marcarComoLida(notificacao.id)
    onFechar()
    router.push(rota)
  }

  const alternarHistorico = () => {
    // O efeito colateral fica FORA do updater: atualizador de estado precisa ser
    // puro e o StrictMode o invoca duas vezes — ali dentro, `carregarHistorico`
    // dispararia duas buscas.
    if (!mostrarHistorico) carregarHistorico()
    setMostrarHistorico((atual) => !atual)
  }

  const secao = (titulo: string, itens: Notificacao[], destaque = false) => (
    <section className="flex flex-col gap-1.5">
      <h3
        className={cn(
          'px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
          destaque ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {titulo}
      </h3>
      {itens.map((item) => (
        <ItemNotificacao
          key={item.id}
          notificacao={item}
          onAbrir={abrirContexto}
          onMarcarComoLida={marcarComoLida}
          onDispensar={dispensar}
        />
      ))}
    </section>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell strokeWidth={1.7} className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            Notificações
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {resumo.total === 0
              ? 'Nada precisa de atenção agora'
              : resumo.naoLidas === 0
                ? `${resumo.total} ${resumo.total === 1 ? 'alerta ativo' : 'alertas ativos'}`
                : `${resumo.naoLidas} não ${resumo.naoLidas === 1 ? 'lida' : 'lidas'} de ${resumo.total}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar notificações"
          className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <X strokeWidth={1.8} className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5 [-webkit-overflow-scrolling:touch]">
        {carregando && notificacoes.length === 0 ? (
          <div className="flex min-h-44 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : ativas.length === 0 && !mostrarHistorico ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
              <Bell strokeWidth={1.5} className="size-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium text-foreground">Tudo em dia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum alerta de estoque ou pedido aguardando você.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {urgentes.length > 0 ? secao('Precisa de atenção', urgentes, true) : null}
            {normais.length > 0 ? secao('Informações', normais) : null}

            {mostrarHistorico ? (
              <section className="flex flex-col gap-1.5">
                <h3 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Histórico
                </h3>
                {historico.length === 0 ? (
                  <p className="px-1 pb-1 text-xs text-muted-foreground">
                    Nada resolvido ou dispensado por aqui ainda.
                  </p>
                ) : (
                  historico.map((item) => (
                    <ItemNotificacao key={item.id} notificacao={item} arquivado />
                  ))
                )}
              </section>
            ) : null}
          </div>
        )}

        {!modalAtivo ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <BellOff strokeWidth={1.7} className="size-3.5 shrink-0" aria-hidden />
              Aviso ao entrar está desligado
            </span>
            <button
              type="button"
              onClick={reativarModalDeEntrada}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              Reativar
            </button>
          </div>
        ) : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/70 px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={marcarTodasComoLidas}
          disabled={resumo.naoLidas === 0}
        >
          <CheckCheck strokeWidth={1.7} className="size-4" />
          Marcar todas como lidas
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs text-muted-foreground"
          onClick={alternarHistorico}
        >
          <History strokeWidth={1.7} className="size-4" />
          {mostrarHistorico ? 'Ocultar' : 'Histórico'}
        </Button>
      </footer>
    </div>
  )
}
