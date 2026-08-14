export const CHAVE_RESULTADOS_STUDIO = 'vitrine_resultados_studio'

export type ResultadoStudio = {
  id: string
  imagemUrl: string
  titulo: string
  descricao: string
  ativo: boolean
}

export type ConfiguracaoResultadosStudio = {
  ativo: boolean
  chamada: string
  nomeStudio: string
  logoUrl: string
  logoUrlTemaEscuro: string
  autoplay: boolean
  intervaloSegundos: number
  resultados: ResultadoStudio[]
}

export const CONFIGURACAO_RESULTADOS_STUDIO_PADRAO: ConfiguracaoResultadosStudio = {
  ativo: false,
  chamada: 'Produtos testados e aprovados por:',
  nomeStudio: 'Studio parceiro',
  logoUrl: '/logo-salao-preta.png',
  logoUrlTemaEscuro: '/logo-salao-branca.png',
  autoplay: true,
  intervaloSegundos: 6,
  resultados: [],
}

const textoLimitado = (valor: unknown, limite: number) =>
  typeof valor === 'string' ? valor.trim().slice(0, limite) : ''

const urlImagemValida = (valor: unknown) => {
  const url = textoLimitado(valor, 1000)
  return url.startsWith('/') || url.startsWith('https://') ? url : ''
}

const intervaloValido = (valor: unknown) => {
  const intervalo = Number(valor)
  if (!Number.isInteger(intervalo)) {
    return CONFIGURACAO_RESULTADOS_STUDIO_PADRAO.intervaloSegundos
  }
  return Math.min(10, Math.max(4, intervalo))
}

export const normalizarConfiguracaoResultadosStudio = (
  valor: string | null | undefined,
): ConfiguracaoResultadosStudio => {
  if (!valor) return CONFIGURACAO_RESULTADOS_STUDIO_PADRAO

  try {
    const configuracao = JSON.parse(valor) as Record<string, unknown>
    const ids = new Set<string>()
    const resultados = Array.isArray(configuracao.resultados)
      ? configuracao.resultados.flatMap((item, indice) => {
          if (!item || typeof item !== 'object') return []
          const resultado = item as Record<string, unknown>
          const imagemUrl = urlImagemValida(resultado.imagemUrl)
          if (!imagemUrl) return []

          const idInformado = textoLimitado(resultado.id, 100)
          const idBase = idInformado || `resultado-${indice}`
          const id = ids.has(idBase) ? `${idBase}-${indice}` : idBase
          ids.add(id)

          return [
            {
              id,
              imagemUrl,
              titulo: textoLimitado(resultado.titulo, 80),
              descricao: textoLimitado(resultado.descricao, 180),
              ativo: resultado.ativo !== false,
            },
          ]
        }).slice(0, 12)
      : []

    return {
      ativo: configuracao.ativo === true,
      chamada:
        textoLimitado(configuracao.chamada, 80) ||
        CONFIGURACAO_RESULTADOS_STUDIO_PADRAO.chamada,
      nomeStudio:
        textoLimitado(configuracao.nomeStudio, 80) ||
        CONFIGURACAO_RESULTADOS_STUDIO_PADRAO.nomeStudio,
      logoUrl:
        urlImagemValida(configuracao.logoUrl) ||
        CONFIGURACAO_RESULTADOS_STUDIO_PADRAO.logoUrl,
      logoUrlTemaEscuro:
        urlImagemValida(configuracao.logoUrlTemaEscuro) ||
        CONFIGURACAO_RESULTADOS_STUDIO_PADRAO.logoUrlTemaEscuro,
      autoplay: configuracao.autoplay !== false,
      intervaloSegundos: intervaloValido(configuracao.intervaloSegundos),
      resultados,
    }
  } catch {
    return CONFIGURACAO_RESULTADOS_STUDIO_PADRAO
  }
}

export const criarIdResultadoStudio = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `resultado-${Date.now()}`
}
