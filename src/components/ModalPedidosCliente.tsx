'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, Phone, Receipt, Search, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  aparenciaStatusPedido,
  formatarDataPedido,
  normalizarPedidoConsulta,
  telefoneEhConsultavel,
} from '@/lib/pedidos-cliente.mjs'

type PedidoExibicao = NonNullable<ReturnType<typeof normalizarPedidoConsulta>>

type ModalPedidosClienteProps = {
  aberto: boolean
  onFechar: () => void
}

const CHAVE_TELEFONE_PEDIDOS = 'cliente_telefone_consulta_pedidos'

const moeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatarTelefone = (telefone: string) => {
  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

/**
 * Meus pedidos.
 *
 * Reescrito sobre o `Dialog` compartilhado (que já vira Drawer abaixo de 768px)
 * no lugar do overlay manual `fixed inset-0 z-[110]` + `backdrop-blur-sm` em
 * tela cheia — que burlava o `overlay-layer.tsx`, único dono do empilhamento
 * (UI.md), e cujo `backdrop-filter` de viewport inteira é uma fonte conhecida de
 * pressão de memória no WebKit.
 *
 * Toda a apresentação passa por `pedidos-cliente.mjs`, onde nada lança: a versão
 * anterior chamava `format()` do date-fns direto no JSX, e `format` estoura com
 * data inválida — um throw no render apaga a página inteira.
 *
 * Cada busca cancela a anterior por número de sequência, então clicar duas vezes
 * não deixa a resposta lenta sobrescrever a rápida.
 */
export default function ModalPedidosCliente({ aberto, onFechar }: ModalPedidosClienteProps) {
  const [telefone, setTelefone] = useState('')
  const [consultado, setConsultado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [pedidos, setPedidos] = useState<PedidoExibicao[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  const buscaRef = useRef(0)

  useEffect(() => {
    if (!aberto) return

    try {
      const salvo = window.localStorage.getItem(CHAVE_TELEFONE_PEDIDOS)
      if (salvo) setTelefone(salvo)
    } catch {
      // Storage bloqueado (navegação privada no Safari): segue sem preencher.
    }
  }, [aberto])

  useEffect(() => {
    if (aberto) return

    // Fechar zera a consulta, mas invalida também a busca em voo: sem isso, uma
    // resposta atrasada repovoaria a lista de um modal já fechado.
    buscaRef.current += 1
    setConsultado(false)
    setErro('')
    setPedidos([])
    setExpandido(null)
    setCarregando(false)
  }, [aberto])

  const resumo = useMemo(
    () => ({
      quantidade: pedidos.length,
      total: pedidos.reduce((soma, pedido) => soma + pedido.total, 0),
    }),
    [pedidos],
  )

  const consultar = useCallback(async () => {
    const informado = telefone.trim()

    if (!telefoneEhConsultavel(informado)) {
      setErro('Informe o telefone com DDD para buscar seus pedidos.')
      return
    }

    const busca = ++buscaRef.current
    setCarregando(true)
    setConsultado(true)
    setErro('')
    setExpandido(null)

    try {
      const { data, error } = await supabase.rpc('obter_pedidos_cliente_por_telefone', {
        p_telefone: informado,
        p_limite: 30,
      })

      // Resposta de uma busca que já foi substituída: descartar.
      if (busca !== buscaRef.current) return
      if (error) throw error

      const lista = (Array.isArray(data) ? data : [])
        .map(normalizarPedidoConsulta)
        .filter((pedido): pedido is PedidoExibicao => pedido !== null)

      setPedidos(lista)

      try {
        window.localStorage.setItem(CHAVE_TELEFONE_PEDIDOS, informado)
      } catch {
        // Sem storage o histórico não persiste, e tudo bem.
      }
    } catch (falha) {
      if (busca !== buscaRef.current) return
      console.error('[MeusPedidos] Falha ao consultar:', falha)
      setErro('Não foi possível buscar seus pedidos agora. Tente de novo em instantes.')
      setPedidos([])
    } finally {
      if (busca === buscaRef.current) setCarregando(false)
    }
  }, [telefone])

  const limpar = () => {
    buscaRef.current += 1
    setTelefone('')
    setPedidos([])
    setConsultado(false)
    setErro('')
    setExpandido(null)
    setCarregando(false)
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo) onFechar()
      }}
    >
      <DialogContent className="flex max-h-[88dvh] w-full flex-col gap-0 overflow-y-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/70 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight">
            Meus pedidos
          </DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Consulte pelo telefone que você usou na compra.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border/70 bg-muted/30 px-5 py-3">
          <form
            onSubmit={(evento) => {
              evento.preventDefault()
              void consultar()
            }}
            className="flex gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={telefone}
                onChange={(evento) => setTelefone(evento.target.value)}
                placeholder="(63) 98105-3014"
                inputMode="tel"
                autoComplete="tel"
                aria-label="Telefone"
                className="h-11 border-border/70 pl-9 shadow-none"
              />
            </div>

            <Button type="submit" disabled={carregando} className="h-11 shrink-0 gap-2 px-4">
              {carregando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              <span className="hidden sm:inline">Buscar</span>
            </Button>
          </form>

          {erro ? (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">{erro}</span>
            </p>
          ) : null}

          {consultado && !carregando ? (
            <button
              type="button"
              onClick={limpar}
              className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Limpar busca
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          {carregando ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((indice) => (
                <Skeleton key={indice} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : !consultado ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Receipt className="size-6 text-muted-foreground" strokeWidth={1.6} />
              </span>
              <p className="text-sm text-muted-foreground">
                Informe seu telefone para ver seus pedidos.
              </p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="size-6 text-muted-foreground" strokeWidth={1.6} />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum pedido encontrado</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Confira se o telefone é o mesmo que você usou na compra.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-border/70 bg-card p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Pedidos
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {resumo.quantidade}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl border border-border/70 bg-card p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-1 truncate text-xl font-semibold tabular-nums text-foreground">
                    {moeda(resumo.total)}
                  </p>
                </div>
              </div>

              <ul className="space-y-2.5">
                {pedidos.map((pedido) => {
                  const status = aparenciaStatusPedido(pedido.status)
                  const estaExpandido = expandido === pedido.id

                  return (
                    <li key={pedido.id}>
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                        <button
                          type="button"
                          onClick={() => setExpandido(estaExpandido ? null : pedido.id)}
                          aria-expanded={estaExpandido}
                          className="flex w-full items-start justify-between gap-3 p-3.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-semibold text-foreground">
                                Pedido {pedido.numeroExibicao}
                              </span>
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                  status.classe,
                                )}
                              >
                                {status.rotulo}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatarDataPedido(pedido.criadoEm)}
                            </p>
                          </div>

                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {moeda(pedido.total)}
                          </span>
                        </button>

                        {estaExpandido ? (
                          <div className="space-y-2 border-t border-border/60 px-3.5 pb-3.5 pt-3">
                            <div className="flex flex-wrap gap-1.5">
                              {[pedido.tipoEntrega, pedido.formaPagamento]
                                .filter(Boolean)
                                .map((etiqueta) => (
                                  <span
                                    key={etiqueta}
                                    className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
                                  >
                                    {etiqueta}
                                  </span>
                                ))}
                              {pedido.telefone ? (
                                <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                  {formatarTelefone(pedido.telefone)}
                                </span>
                              ) : null}
                            </div>

                            {pedido.observacoes ? (
                              <p className="break-words text-xs leading-snug text-muted-foreground">
                                <span className="font-medium text-foreground">Observações: </span>
                                {pedido.observacoes}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
