'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import {
  CHAVE_FAIXA_RODAPE,
  CONFIGURACAO_FAIXA_RODAPE_PADRAO,
  ConfiguracaoFaixaRodape,
  normalizarConfiguracaoFaixaRodape,
} from '@/lib/vitrineFaixaRodape'

export default function EditorFaixaRodape() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoFaixaRodape>(
    CONFIGURACAO_FAIXA_RODAPE_PADRAO,
  )
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregarConfiguracao = useCallback(async () => {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_FAIXA_RODAPE)
        .maybeSingle()

      if (error) throw error
      setConfiguracao(normalizarConfiguracaoFaixaRodape(data?.valor))
    } catch {
      toast.error('Não foi possível carregar o aviso do cabeçalho')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarConfiguracao()
  }, [carregarConfiguracao])

  const salvarConfiguracao = async () => {
    const mensagem = configuracao.mensagem.trim().replace(/\s+/g, ' ')
    if (!mensagem) {
      toast.warning('Escreva a mensagem que aparecerá no cabeçalho')
      return
    }

    const configuracaoNormalizada = normalizarConfiguracaoFaixaRodape(
      JSON.stringify({ ...configuracao, mensagem }),
    )
    setSalvando(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_FAIXA_RODAPE,
          valor: JSON.stringify(configuracaoNormalizada),
          tipo: 'json',
          descricao: 'Faixa promocional exibida no cabeçalho da loja pública.',
        },
        { onConflict: 'chave' },
      )

      if (error) throw error
      setConfiguracao(configuracaoNormalizada)
      toast.success('Aviso do cabeçalho atualizado')
    } catch {
      toast.error('Não foi possível salvar o aviso do cabeçalho')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <Card className="border-border/70 shadow-none">
        <CardContent className="flex min-h-48 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="sr-only">Carregando configuração</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Aviso do cabeçalho</CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Mostre uma condição especial acima da navegação da loja, em uma
            faixa fina e contínua.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => void salvarConfiguracao()}
          disabled={salvando}
        >
          {salvando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar alterações
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-foreground">
              Exibir no site
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              Ao ocultar, a mensagem continua salva para uso posterior.
            </span>
          </span>
          <input
            type="checkbox"
            checked={configuracao.ativo}
            onChange={(event) =>
              setConfiguracao((estadoAtual) => ({
                ...estadoAtual,
                ativo: event.target.checked,
              }))
            }
            className="size-4 shrink-0 accent-primary"
          />
        </label>

        <div className="space-y-2">
          <Label htmlFor="mensagem-faixa-rodape">Mensagem</Label>
          <Input
            id="mensagem-faixa-rodape"
            value={configuracao.mensagem}
            maxLength={120}
            onChange={(event) =>
              setConfiguracao((estadoAtual) => ({
                ...estadoAtual,
                mensagem: event.target.value,
              }))
            }
            placeholder="Ex.: Frete grátis em compras a partir de R$ 150"
            className="min-h-11"
          />
          <p className="text-xs text-muted-foreground">
            {configuracao.mensagem.length}/120 caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label>Prévia no site</Label>
          <div className="overflow-hidden rounded-md bg-primary py-2 text-primary-foreground">
            <p className="fortes-display truncate px-6 text-center text-sm leading-none sm:text-base">
              {configuracao.mensagem || 'Sua mensagem aparecerá aqui'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
