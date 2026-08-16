'use client'

import { Check, Info, Ticket } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  descreverCupom,
  simularCupom,
  type FormularioCupom,
} from '@/lib/cupom-formulario.mjs'

type ResumoCupomProps = {
  formulario: FormularioCupom
  valorPedido: string
  onValorPedidoChange: (valor: string) => void
  className?: string
}

const moeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * O que este cupom faz, em português e em reais.
 *
 * É a peça que faltava na tela antiga: dava para preencher `tipo_desconto`,
 * `valor_desconto` e `limite_desconto` sem nunca saber o resultado — e só se
 * descobria o efeito quando um cliente usava. Aqui o administrador confere o
 * desconto antes de salvar, num pedido de exemplo que ele mesmo ajusta.
 */
export function ResumoCupom({
  formulario,
  valorPedido,
  onValorPedidoChange,
  className,
}: ResumoCupomProps) {
  const pedido = Number(String(valorPedido).replace(',', '.')) || 0
  const simulacao = simularCupom(formulario, pedido)
  const codigo = formulario.codigo?.trim() || 'SEUCUPOM'

  return (
    <div className={cn('space-y-4 rounded-xl border border-border/70 bg-card p-4', className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Ticket strokeWidth={1.8} className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-foreground">Como vai funcionar</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Confira antes de salvar.
          </p>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-foreground">
        O cliente digita{' '}
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide">
          {codigo}
        </span>{' '}
        no carrinho.
      </p>

      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {descreverCupom(formulario)}
      </p>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <Label htmlFor="cupom-simulacao" className="text-xs">
          Testar com um pedido de
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R$
          </span>
          <Input
            id="cupom-simulacao"
            inputMode="decimal"
            value={valorPedido}
            onChange={(evento) => onValorPedidoChange(evento.target.value)}
            className="h-10 border-border/70 pl-9 shadow-none"
          />
        </div>
      </div>

      {simulacao.aplicavel ? (
        <div className="space-y-1.5 rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Check strokeWidth={2.2} className="size-3.5" />
            Cupom aplicado
          </p>

          {simulacao.desconto > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="font-semibold tabular-nums text-foreground">
                  − {moeda(simulacao.desconto)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">O cliente paga</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {moeda(simulacao.total)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-snug text-muted-foreground">{simulacao.motivo}</p>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/40 p-3">
          <Info strokeWidth={1.8} className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[13px] leading-snug text-muted-foreground">{simulacao.motivo}</p>
        </div>
      )}
    </div>
  )
}
