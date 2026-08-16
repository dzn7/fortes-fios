'use client'

import { useEffect, useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CHAVE_FRETE_GRATIS } from '@/lib/configuracoes-pedidos'
import {
  CONFIG_FRETE_GRATIS_PADRAO,
  SUGESTOES_VALOR_MINIMO,
  normalizarConfigFreteGratis,
  type ConfigFreteGratis as TipoConfig,
} from '@/lib/frete.mjs'

/**
 * Frete grátis acima de um valor.
 *
 * Persiste em `configuracoes_loja` — tabela chave/valor que já guarda JSON em
 * outras chaves — em vez de coluna nova. A leitura passa sempre por
 * `normalizarConfigFreteGratis`: o campo é texto e um valor estranho não pode
 * virar frete grátis universal.
 *
 * Sem modal: ligar, escolher um atalho ou digitar, salvar. Uma configuração de
 * duas informações não justifica abrir uma tela por cima da tela.
 */
export function ConfigFreteGratis() {
  const [config, setConfig] = useState<TipoConfig>(CONFIG_FRETE_GRATIS_PADRAO)
  const [valorDigitado, setValorDigitado] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true

    supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_FRETE_GRATIS)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return
        const lida = normalizarConfigFreteGratis(data?.valor)
        setConfig(lida)
        setValorDigitado(lida.valorMinimo ? String(lida.valorMinimo) : '')
        setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [])

  const persistir = async (proxima: TipoConfig) => {
    setSalvando(true)
    const anterior = config
    setConfig(proxima)

    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_FRETE_GRATIS,
          valor: JSON.stringify(proxima),
          tipo: 'json',
          descricao: 'Frete grátis acima de um valor de compra',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'chave' },
      )

      if (error) throw error

      toast.success(
        proxima.ativo
          ? `Frete grátis acima de R$ ${proxima.valorMinimo.toFixed(2)}`
          : 'Frete grátis desligado',
      )
    } catch (erro) {
      console.error('[Entregas] Falha ao salvar frete grátis:', erro)
      setConfig(anterior)
      toast.error('Não foi possível salvar a regra de frete grátis.')
    } finally {
      setSalvando(false)
    }
  }

  const alternar = () => {
    if (config.ativo) {
      void persistir({ ...config, ativo: false })
      return
    }

    // Ligar sem valor não pode virar frete grátis para todo mundo: sem número
    // escolhido, assume a primeira sugestão.
    const valor = Number(valorDigitado.replace(',', '.')) || SUGESTOES_VALOR_MINIMO[2]
    setValorDigitado(String(valor))
    void persistir({ ativo: true, valorMinimo: valor })
  }

  const escolherValor = (valor: number) => {
    setValorDigitado(String(valor))
    void persistir({ ativo: true, valorMinimo: valor })
  }

  const salvarValorDigitado = () => {
    const valor = Number(valorDigitado.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.warning('Informe um valor maior que zero.')
      setValorDigitado(config.valorMinimo ? String(config.valorMinimo) : '')
      return
    }
    if (valor === config.valorMinimo) return
    void persistir({ ativo: true, valorMinimo: valor })
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
              config.ativo
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-border/70 bg-muted text-muted-foreground',
            )}
          >
            <Gift className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Frete grátis</h2>
              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs font-medium',
                  config.ativo
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border/70 bg-muted/40 text-muted-foreground',
                )}
              >
                {config.ativo ? 'ativado' : 'desligado'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {config.ativo
                ? `O cliente não paga entrega em compras a partir de R$ ${config.valorMinimo.toFixed(2)}.`
                : 'Nenhuma regra de frete grátis por valor está sendo aplicada.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={config.ativo}
          disabled={carregando || salvando}
          onClick={alternar}
          className={cn(
            'inline-flex h-10 min-w-[156px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
            config.ativo
              ? 'border-border/70 bg-background hover:bg-muted'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
          )}
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {config.ativo ? 'Desligar' : 'Ativar'}
        </button>
      </div>

      {config.ativo ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <Label htmlFor="frete-valor-minimo">Compras acima de</Label>

          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES_VALOR_MINIMO.map((valor) => (
              <button
                key={valor}
                type="button"
                disabled={salvando}
                onClick={() => escolherValor(valor)}
                className={cn(
                  'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60',
                  config.valorMinimo === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 bg-background text-foreground hover:bg-muted',
                )}
              >
                R$ {valor}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="frete-valor-minimo"
                  inputMode="decimal"
                  value={valorDigitado}
                  onChange={(evento) => setValorDigitado(evento.target.value)}
                  onBlur={salvarValorDigitado}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') evento.currentTarget.blur()
                  }}
                  disabled={salvando}
                  className="h-10 border-border/70 pl-9 shadow-none"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Valor personalizado — salva ao sair do campo.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
