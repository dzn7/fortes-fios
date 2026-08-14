'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock3, Loader2, MapPin, Save, ShoppingBag, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { supabase } from '@/lib/supabase'
import {
  CHAVE_TEMPO_ENTREGA,
  CHAVE_TEMPO_RETIRADA,
  TEMPO_ENTREGA_PADRAO,
  TEMPO_RETIRADA_PADRAO,
  normalizarTempoEstimado,
  tempoEstimadoValido,
} from '@/lib/configuracoes-pedidos'

type CidadeEntregaConfig = {
  id: string
  nome: string
  valorMinimo: string
  ativo: boolean
}

type ConfiguracoesPedidosDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ConfiguracoesPedidosDialog({
  open,
  onOpenChange,
}: ConfiguracoesPedidosDialogProps) {
  const [tempoRetirada, setTempoRetirada] = useState(TEMPO_RETIRADA_PADRAO)
  const [tempoEntrega, setTempoEntrega] = useState(TEMPO_ENTREGA_PADRAO)
  const [cidades, setCidades] = useState<CidadeEntregaConfig[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [resultadoTempos, resultadoCidades] = await Promise.all([
        supabase
          .from('configuracoes_loja')
          .select('chave, valor')
          .in('chave', [CHAVE_TEMPO_RETIRADA, CHAVE_TEMPO_ENTREGA]),
        supabase
          .from('bairros')
          .select('id, nome, valor_minimo_pedido, ativo')
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
      ])

      if (resultadoTempos.error) throw resultadoTempos.error
      if (resultadoCidades.error) throw resultadoCidades.error

      const tempos = new Map(
        (resultadoTempos.data || []).map((item) => [item.chave, item.valor]),
      )
      setTempoRetirada(
        normalizarTempoEstimado(tempos.get(CHAVE_TEMPO_RETIRADA), TEMPO_RETIRADA_PADRAO),
      )
      setTempoEntrega(
        normalizarTempoEstimado(tempos.get(CHAVE_TEMPO_ENTREGA), TEMPO_ENTREGA_PADRAO),
      )
      setCidades(
        (resultadoCidades.data || []).map((cidade) => ({
          id: cidade.id,
          nome: cidade.nome,
          valorMinimo: Number(cidade.valor_minimo_pedido || 0).toFixed(2),
          ativo: cidade.ativo !== false,
        })),
      )
    } catch (error) {
      console.error('[Configurações de pedidos] Erro ao carregar:', error)
      toast.error('Não foi possível carregar as configurações')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (open) void carregar()
  }, [carregar, open])

  const salvar = async () => {
    if (!tempoEstimadoValido(tempoRetirada) || !tempoEstimadoValido(tempoEntrega)) {
      toast.warning('Informe os minutos como 20 ou como intervalo, por exemplo 20-30')
      return
    }

    const cidadeInvalida = cidades.find((cidade) => {
      const valor = Number(cidade.valorMinimo)
      return !Number.isFinite(valor) || valor < 0
    })
    if (cidadeInvalida) {
      toast.warning(`Revise a compra mínima de ${cidadeInvalida.nome}`)
      return
    }

    setSalvando(true)
    try {
      const retiradaNormalizada = normalizarTempoEstimado(
        tempoRetirada,
        TEMPO_RETIRADA_PADRAO,
      )
      const entregaNormalizada = normalizarTempoEstimado(
        tempoEntrega,
        TEMPO_ENTREGA_PADRAO,
      )
      const { error: erroTempos } = await supabase.from('configuracoes_loja').upsert(
        [
          {
            chave: CHAVE_TEMPO_RETIRADA,
            valor: retiradaNormalizada,
            tipo: 'string',
            descricao: 'Tempo estimado em minutos para retirada de pedidos.',
          },
          {
            chave: CHAVE_TEMPO_ENTREGA,
            valor: entregaNormalizada,
            tipo: 'string',
            descricao: 'Tempo estimado em minutos para entrega de pedidos.',
          },
        ],
        { onConflict: 'chave' },
      )
      if (erroTempos) throw erroTempos

      const resultadosCidades = await Promise.all(
        cidades.map((cidade) =>
          supabase
            .from('bairros')
            .update({ valor_minimo_pedido: Number(cidade.valorMinimo) })
            .eq('id', cidade.id),
        ),
      )
      const erroCidade = resultadosCidades.find((resultado) => resultado.error)?.error
      if (erroCidade) throw erroCidade

      setTempoRetirada(retiradaNormalizada)
      setTempoEntrega(entregaNormalizada)
      toast.success('Configurações de pedidos atualizadas')
      onOpenChange(false)
    } catch (error) {
      console.error('[Configurações de pedidos] Erro ao salvar:', error)
      toast.error('Não foi possível salvar todas as configurações')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Configurações de pedidos"
      description="Defina prazos e compras mínimas mostrados ao cliente."
      className="flex max-h-[92dvh] flex-col sm:max-w-2xl"
    >
      <div className="shrink-0 border-b border-border/70 px-5 py-4 pr-12 sm:px-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock3 className="size-5 text-primary" />
          Configurações de pedidos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste o que o cliente vê ao escolher como receber o pedido.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {carregando ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <div className="space-y-7">
            <section>
              <div className="mb-4">
                <h3 className="font-semibold text-foreground">Prazo informado ao cliente</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use um número ou intervalo em minutos, como 20 ou 20-30.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <Label htmlFor="config-tempo-retirada" className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-primary" />
                    Retirada na loja
                  </Label>
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      id="config-tempo-retirada"
                      value={tempoRetirada}
                      onChange={(event) => setTempoRetirada(event.target.value)}
                      inputMode="text"
                      placeholder="20-30"
                      className="h-10 shadow-none"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">min</span>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <Label htmlFor="config-tempo-entrega" className="flex items-center gap-2">
                    <Truck className="size-4 text-primary" />
                    Entrega
                  </Label>
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      id="config-tempo-entrega"
                      value={tempoEntrega}
                      onChange={(event) => setTempoEntrega(event.target.value)}
                      inputMode="text"
                      placeholder="20-30"
                      className="h-10 shadow-none"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">min</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-border/70 pt-6">
              <div className="mb-4">
                <h3 className="flex items-center gap-2 font-semibold text-foreground">
                  <MapPin className="size-4 text-primary" />
                  Compra mínima por cidade
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada cidade mantém seu próprio valor mínimo para entrega.
                </p>
              </div>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                {cidades.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma cidade de entrega cadastrada.
                  </div>
                ) : cidades.map((cidade) => (
                  <div
                    key={cidade.id}
                    className="flex items-center justify-between gap-4 bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{cidade.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {cidade.ativo ? 'Disponível no checkout' : 'Cidade inativa'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input
                        value={cidade.valorMinimo}
                        onChange={(event) =>
                          setCidades((atuais) =>
                            atuais.map((item) =>
                              item.id === cidade.id
                                ? { ...item, valorMinimo: event.target.value }
                                : item,
                            ),
                          )
                        }
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.50"
                        aria-label={`Compra mínima para ${cidade.nome}`}
                        className="h-9 w-24 text-right tabular-nums shadow-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-border/70 bg-card px-5 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
        <Button
          type="button"
          variant="outline"
          className="flex-1 shadow-none sm:flex-none"
          onClick={() => onOpenChange(false)}
          disabled={salvando}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1 shadow-none sm:flex-none"
          onClick={() => void salvar()}
          disabled={carregando || salvando}
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar alterações
        </Button>
      </div>
    </ModalSheet>
  )
}
