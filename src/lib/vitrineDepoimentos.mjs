/**
 * Depoimentos da vitrine.
 *
 * Segue o mesmo modelo do Estúdio (`vitrineResultadosStudio.ts`): a seção
 * inteira mora em uma linha de `configuracoes_loja`, como JSON, e a normalização
 * é defensiva — o campo é texto e pode conter qualquer coisa.
 *
 * A diferença que justifica um módulo próprio é o **formato por item**. Um print
 * de celular (9:16) e um screenshot de tela larga não cabem na mesma moldura:
 * forçar proporção única corta a conversa ou deixa faixa vazia. Cada depoimento
 * carrega o seu, e o carrossel do site pergunta a este módulo qual moldura usar.
 */

export const CHAVE_DEPOIMENTOS = 'vitrine_depoimentos'

/** Teto igual ao do Estúdio: carrossel com mais que isso ninguém percorre. */
export const LIMITE_DEPOIMENTOS = 12

/**
 * Catálogo de formatos — só o que é semântico.
 *
 * As classes de Tailwind ficam no componente, não aqui. Este arquivo é `.mjs` em
 * `src/lib/`, e o `content` do `tailwind.config` cobre apenas
 * `pages|components|features|app` com extensão `{js,ts,jsx,tsx,mdx}`: classe
 * escrita aqui **nunca é gerada**. Foi assim que os cards perderam largura e
 * proporção e a seção virou uma fileira de nomes sem imagem.
 *
 * Além do bug, é a fronteira certa: domínio não conhece folha de estilo.
 */
export const FORMATOS_DEPOIMENTO = [
  {
    id: 'vertical',
    rotulo: 'Vertical 9:16',
    ajuda: 'Print de celular, story, conversa',
    proporcao: 9 / 16,
  },
  {
    id: 'horizontal',
    rotulo: 'Horizontal',
    ajuda: 'Print de tela larga, captura de comentário',
    proporcao: 16 / 10,
  },
]

const FORMATO_PADRAO = FORMATOS_DEPOIMENTO[0]

export const CONFIGURACAO_DEPOIMENTOS_PADRAO = Object.freeze({
  ativo: false,
  titulo: 'Quem já comprou',
  chamada: 'Depoimentos reais de quem levou nossos produtos',
  depoimentos: [],
})

const textoLimitado = (valor, limite) =>
  typeof valor === 'string' ? valor.trim().slice(0, limite) : ''

/**
 * Só caminho do próprio site ou HTTPS. `http://` e `javascript:` ficam de fora —
 * a URL vem de um campo de texto e vai direto para o `src` de uma `<img>`.
 */
const urlImagemValida = (valor) => {
  const url = textoLimitado(valor, 1000)
  if (url.startsWith('/')) return url
  if (url.startsWith('https://')) return url
  return ''
}

const formatoValido = (valor) =>
  FORMATOS_DEPOIMENTO.some((formato) => formato.id === valor) ? valor : FORMATO_PADRAO.id

/** @param {string} id */
export const formatoDepoimento = (id) =>
  FORMATOS_DEPOIMENTO.find((formato) => formato.id === id) || FORMATO_PADRAO

/** @param {string|null|undefined} valor */
export const normalizarConfiguracaoDepoimentos = (valor) => {
  if (!valor) return { ...CONFIGURACAO_DEPOIMENTOS_PADRAO, depoimentos: [] }

  let bruto
  try {
    bruto = JSON.parse(valor)
  } catch {
    return { ...CONFIGURACAO_DEPOIMENTOS_PADRAO, depoimentos: [] }
  }

  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
    return { ...CONFIGURACAO_DEPOIMENTOS_PADRAO, depoimentos: [] }
  }

  const idsUsados = new Set()
  const depoimentos = (Array.isArray(bruto.depoimentos) ? bruto.depoimentos : [])
    .flatMap((item, indice) => {
      if (!item || typeof item !== 'object') return []

      const imagemUrl = urlImagemValida(item.imagemUrl)
      if (!imagemUrl) return []

      // Id repetido viraria `key` duplicada e o React embaralha os cards ao
      // reordenar. Desambiguar aqui é mais barato que caçar depois.
      const idBase = textoLimitado(item.id, 100) || `depoimento-${indice}`
      const id = idsUsados.has(idBase) ? `${idBase}-${indice}` : idBase
      idsUsados.add(id)

      return [
        {
          id,
          nome: textoLimitado(item.nome, 80),
          imagemUrl,
          formato: formatoValido(item.formato),
          ativo: item.ativo !== false,
        },
      ]
    })
    .slice(0, LIMITE_DEPOIMENTOS)

  return {
    ativo: bruto.ativo === true,
    titulo: textoLimitado(bruto.titulo, 80) || CONFIGURACAO_DEPOIMENTOS_PADRAO.titulo,
    chamada: textoLimitado(bruto.chamada, 160) || CONFIGURACAO_DEPOIMENTOS_PADRAO.chamada,
    depoimentos,
  }
}

/**
 * O que o site renderiza. Seção desligada devolve lista vazia — o componente usa
 * isso para não ocupar espaço nem baixar imagem nenhuma.
 */
export const depoimentosVisiveis = (configuracao) => {
  if (!configuracao?.ativo) return []
  return (configuracao.depoimentos || []).filter((item) => item.ativo)
}

/**
 * Move um item `direcao` posições. Fora dos limites devolve a lista intacta, em
 * vez de perder ou duplicar depoimento.
 *
 * @param {Array} lista @param {number} indice @param {number} direcao
 */
export const reordenarDepoimentos = (lista, indice, direcao) => {
  const itens = Array.isArray(lista) ? [...lista] : []
  const destino = indice + direcao

  if (indice < 0 || indice >= itens.length) return itens
  if (destino < 0 || destino >= itens.length) return itens

  const [movido] = itens.splice(indice, 1)
  itens.splice(destino, 0, movido)
  return itens
}

export const criarIdDepoimento = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `depoimento-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
