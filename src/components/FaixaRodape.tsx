'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CONFIGURACAO_FAIXA_RODAPE_PADRAO,
  ConfiguracaoFaixaRodape,
} from '@/lib/vitrineFaixaRodape'

type RespostaFaixaRodape = {
  sucesso: boolean
  configuracao?: ConfiguracaoFaixaRodape
}

const REPETICOES_POR_GRUPO = 10

export function FaixaRodape() {
  const [configuracao, setConfiguracao] = useState(
    CONFIGURACAO_FAIXA_RODAPE_PADRAO,
  )

  const carregarConfiguracao = useCallback(async () => {
    try {
      const resposta = await fetch('/api/vitrine/faixa-rodape', {
        cache: 'no-store',
      })
      if (!resposta.ok) throw new Error('Falha ao carregar aviso do cabeçalho')
      const dados = (await resposta.json()) as RespostaFaixaRodape
      if (dados.sucesso && dados.configuracao) {
        setConfiguracao(dados.configuracao)
      }
    } catch {
      setConfiguracao(CONFIGURACAO_FAIXA_RODAPE_PADRAO)
    }
  }, [])

  useEffect(() => {
    void carregarConfiguracao()
  }, [carregarConfiguracao])

  if (!configuracao.ativo || !configuracao.mensagem) return null

  return (
    <aside
      className="overflow-hidden border-b border-primary-foreground/15 bg-primary py-2 text-primary-foreground"
      aria-label="Aviso promocional da loja"
    >
      <p className="sr-only">{configuracao.mensagem}</p>
      <div className="faixa-rodape-track flex w-max" aria-hidden="true">
        {[0, 1].map((grupo) => (
          <div key={grupo} className="flex shrink-0 items-center">
            {Array.from({ length: REPETICOES_POR_GRUPO }, (_, indice) => (
              <span
                key={indice}
                className="fortes-display flex shrink-0 items-center gap-6 px-6 text-sm leading-none sm:text-base"
              >
                {configuracao.mensagem}
                <span
                  className="size-1 rounded-full bg-current opacity-60"
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
