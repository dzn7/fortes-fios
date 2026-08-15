'use client'

import { useEffect, useState } from 'react'
import { Loader2, Minus, PackageX, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import {
  ajustarQuantidadeEstoque,
  obterSituacaoEstoque,
} from '@/lib/estoque-produto.mjs'
import { useNotificacoesOpcional } from '@/contexts/NotificacoesContext'
import { cn } from '@/lib/utils'

type ControleEstoqueProdutoProps = {
  produtoId: string
  produtoNome: string
  quantidade: number
  estoqueMinimo: number
  onQuantidadeAlterada: (quantidade: number) => void
  compacto?: boolean
  className?: string
}

const rotuloSituacao = {
  em_estoque: 'Em estoque',
  baixo: 'Estoque baixo',
  esgotado: 'Esgotado',
} as const

export function ControleEstoqueProduto({
  produtoId,
  produtoNome,
  quantidade,
  estoqueMinimo,
  onQuantidadeAlterada,
  compacto = false,
  className,
}: ControleEstoqueProdutoProps) {
  const [salvando, setSalvando] = useState(false)
  const [valorDigitado, setValorDigitado] = useState(String(quantidade))
  const notificacoes = useNotificacoesOpcional()
  const situacao = obterSituacaoEstoque({
    estoque_quantidade: quantidade,
    estoque_minimo: estoqueMinimo,
  })

  useEffect(() => {
    setValorDigitado(String(quantidade))
  }, [quantidade])

  const persistir = async (proximaQuantidade: number, modo: 'ajuste' | 'definir') => {
    if (salvando || proximaQuantidade === quantidade) return
    const quantidadeAnterior = quantidade
    onQuantidadeAlterada(proximaQuantidade)
    setValorDigitado(String(proximaQuantidade))
    setSalvando(true)

    try {
      const resposta = modo === 'ajuste'
        ? await supabase.rpc('ajustar_estoque_produto', {
            p_produto_id: produtoId,
            p_delta: proximaQuantidade - quantidadeAnterior,
          })
        : await supabase.rpc('definir_estoque_produto', {
            p_produto_id: produtoId,
            p_quantidade: proximaQuantidade,
          })

      if (resposta.error) throw resposta.error
      const quantidadeConfirmada = Number(resposta.data)
      if (!Number.isInteger(quantidadeConfirmada) || quantidadeConfirmada < 0) {
        throw new Error('O banco retornou uma quantidade inválida.')
      }
      onQuantidadeAlterada(quantidadeConfirmada)
      setValorDigitado(String(quantidadeConfirmada))

      // O trigger do banco já abriu/resolveu a notificação nesta transação.
      // Buscamos de novo em vez de manter subscription aberta (spec §6).
      notificacoes?.invalidar()
    } catch (erro) {
      onQuantidadeAlterada(quantidadeAnterior)
      setValorDigitado(String(quantidadeAnterior))
      toast.error('Não foi possível atualizar o estoque', {
        description: erro instanceof Error ? erro.message : `Tente novamente em ${produtoNome}.`,
      })
    } finally {
      setSalvando(false)
    }
  }

  const ajustar = (delta: number) => {
    try {
      const proximaQuantidade = ajustarQuantidadeEstoque(quantidade, delta)
      void persistir(proximaQuantidade, 'ajuste')
    } catch {
      toast.warning('O estoque já está zerado')
    }
  }

  const confirmarDigitacao = () => {
    const numero = Number(valorDigitado)
    if (!Number.isInteger(numero) || numero < 0) {
      setValorDigitado(String(quantidade))
      toast.warning('Informe uma quantidade inteira e não negativa')
      return
    }
    void persistir(numero, 'definir')
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {!compacto ? (
        <Badge
          variant={situacao === 'em_estoque' ? 'success' : situacao === 'baixo' ? 'warning' : 'secondary'}
          className="shrink-0"
        >
          {rotuloSituacao[situacao]}
        </Badge>
      ) : null}
      <div className="flex h-10 items-center overflow-hidden rounded-lg border border-border/70 bg-background">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-none"
          onClick={() => ajustar(-1)}
          disabled={salvando || quantidade === 0}
          aria-label={`Diminuir estoque de ${produtoNome}`}
        >
          <Minus className="size-3.5" />
        </Button>
        <Input
          value={valorDigitado}
          onChange={(evento) => setValorDigitado(evento.target.value)}
          onBlur={confirmarDigitacao}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') evento.currentTarget.blur()
            if (evento.key === 'Escape') {
              setValorDigitado(String(quantidade))
              evento.currentTarget.blur()
            }
          }}
          inputMode="numeric"
          aria-label={`Quantidade em estoque de ${produtoNome}`}
          disabled={salvando}
          className="h-9 w-12 rounded-none border-0 px-1 text-center font-mono text-sm font-semibold tabular-nums shadow-none focus-visible:ring-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-none"
          onClick={() => ajustar(1)}
          disabled={salvando}
          aria-label={`Aumentar estoque de ${produtoNome}`}
        >
          {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0 text-muted-foreground"
        onClick={() => void persistir(0, 'definir')}
        disabled={salvando || quantidade === 0}
        aria-label={`Zerar estoque de ${produtoNome}`}
        title="Zerar estoque"
      >
        <PackageX className="size-4" />
      </Button>
    </div>
  )
}
