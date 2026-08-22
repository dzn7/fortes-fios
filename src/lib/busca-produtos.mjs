import { chaveTexto } from './filtros-catalogo.mjs'

/**
 * Busca do header, sobre o catálogo **já carregado no browser**.
 *
 * **Por que não vai ao banco.** Medido antes de escrever, com os 510 produtos
 * reais de produção: filtrar em memória custa **1,7 ms por tecla e zero
 * queries**. A alternativa server-side com `ilike '%termo%'` faz `Seq Scan` —
 * a regra `advanced-full-text-search` da skill está certa, curinga à esquerda
 * não usa índice — e, pior que a varredura, paga **ida e volta de rede a cada
 * tecla**: 50 a 300 ms num celular. Índice nenhum torna uma requisição mais
 * rápida que uma varredura de 510 itens em memória.
 *
 * O argumento se inverte quando o catálogo não couber mais em memória (ordem de
 * 2 000 produtos). Aí a busca vai para o servidor **com `tsvector` + GIN**,
 * nunca com `ilike`.
 *
 * Spec: specs/busca-no-header.md
 */

/** Abaixo disto a busca traria quase o catálogo inteiro e não ajudaria ninguém. */
export const TERMO_MINIMO = 2

/** Teto do que é desenhado. Lista de 500 linhas trava o toque; o total continua exibido. */
export const LIMITE_RESULTADOS = 20

/**
 * Quanto menor, mais perto do que a pessoa quis dizer.
 *
 * Sem isto, digitar "sh" devolveria 92 produtos na ordem do catálogo, e o
 * primeiro seria o que estivesse na frente da lista — não o mais parecido.
 */
const RELEVANCIA = {
  NOME_COMECA: 0,
  NOME_CONTEM: 1,
  CATEGORIA: 2,
  DESCRICAO: 3,
  NENHUMA: 99,
}

/**
 * @param {{ nome?: unknown, categoria?: unknown, descricao?: unknown }} produto
 * @param {string[]} termos
 * @returns {number}
 */
const relevancia = (produto, termos) => {
  const nome = chaveTexto(produto.nome)
  const categoria = chaveTexto(produto.categoria)
  const descricao = chaveTexto(produto.descricao)

  // Todos os termos precisam casar em algum campo: "kit hidratacao" não pode
  // trazer todo kit nem toda hidratação.
  const todosCasam = termos.every(
    (termo) => nome.includes(termo) || categoria.includes(termo) || descricao.includes(termo),
  )
  if (!todosCasam) return RELEVANCIA.NENHUMA

  // O nível é decidido pelo primeiro termo, que é o que a pessoa digitou antes
  // de refinar.
  const [primeiro] = termos
  if (nome.startsWith(primeiro)) return RELEVANCIA.NOME_COMECA
  if (nome.includes(primeiro)) return RELEVANCIA.NOME_CONTEM
  if (categoria.includes(primeiro)) return RELEVANCIA.CATEGORIA
  return RELEVANCIA.DESCRICAO
}

/**
 * @template {{ id?: unknown, disponivel?: unknown }} T
 * @param {T[]} produtos
 * @param {unknown} busca
 * @param {number} limite
 * @returns {{ itens: T[], total: number, temMais: boolean }}
 */
export const buscarProdutos = (produtos, busca, limite = LIMITE_RESULTADOS) => {
  const vazio = { itens: [], total: 0, temMais: false }
  if (!Array.isArray(produtos)) return vazio

  const termos = chaveTexto(busca).split(' ').filter(Boolean)
  const bruto = typeof busca === 'string' ? busca.trim() : ''
  if (bruto.length < TERMO_MINIMO || termos.length === 0) return vazio

  const pontuados = []
  produtos.forEach((produto, posicao) => {
    if (!produto || produto.disponivel === false) return
    const nivel = relevancia(produto, termos)
    if (nivel === RELEVANCIA.NENHUMA) return
    // `posicao` guardada explicitamente: o desempate é a ordem do catálogo, a
    // curadoria da loja, e não o acaso do algoritmo de ordenação.
    pontuados.push({ produto, nivel, posicao })
  })

  pontuados.sort((a, b) => a.nivel - b.nivel || a.posicao - b.posicao)

  const itens = pontuados.slice(0, Math.max(0, limite)).map((registro) => registro.produto)
  return { itens, total: pontuados.length, temMais: pontuados.length > itens.length }
}
