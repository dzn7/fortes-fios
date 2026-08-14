export const CHAVE_FAIXA_RODAPE = 'vitrine_faixa_rodape'

export type ConfiguracaoFaixaRodape = {
  ativo: boolean
  mensagem: string
}

export const CONFIGURACAO_FAIXA_RODAPE_PADRAO: ConfiguracaoFaixaRodape = {
  ativo: true,
  mensagem: 'Frete grátis em compras a partir de R$ 150',
}

const normalizarMensagem = (valor: unknown) =>
  typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ').slice(0, 120) : ''

export const normalizarConfiguracaoFaixaRodape = (
  valor: string | null | undefined,
): ConfiguracaoFaixaRodape => {
  if (!valor) return CONFIGURACAO_FAIXA_RODAPE_PADRAO

  try {
    const configuracao = JSON.parse(valor) as Record<string, unknown>
    return {
      ativo: configuracao.ativo !== false,
      mensagem:
        normalizarMensagem(configuracao.mensagem) ||
        CONFIGURACAO_FAIXA_RODAPE_PADRAO.mensagem,
    }
  } catch {
    return CONFIGURACAO_FAIXA_RODAPE_PADRAO
  }
}
