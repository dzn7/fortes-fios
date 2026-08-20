/**
 * Paginação por número de página.
 *
 * A janela de páginas (`janelaDePaginas`) vivia presa dentro de
 * `src/features/pedidos/components/PaginacaoPedidos.tsx`. Subiu para cá no
 * segundo uso — o catálogo do cliente — porque dentro de um `.tsx` ela fica
 * fora do alcance do `node --test`, que é o único teste que este projeto aceita
 * (§3.4 do AGENTS.md). É "generalizar o existente" (§5), não código novo.
 *
 * Spec: specs/paginacao-catalogo-cliente.md
 */

/** @typedef {number | 'inicio-ellipsis' | 'fim-ellipsis'} ItemPagina */

const inteiroPositivo = (valor) => {
  const numero = Math.trunc(Number(valor))
  return Number.isFinite(numero) && numero > 0 ? numero : 0
}

/**
 * @param {unknown} totalItens
 * @param {unknown} porPagina
 * @returns {number} 0 quando não há item ou o tamanho de página é inválido.
 */
export const totalDePaginas = (totalItens, porPagina) => {
  const itens = inteiroPositivo(totalItens)
  const tamanho = inteiroPositivo(porPagina)
  if (itens === 0 || tamanho === 0) return 0
  return Math.ceil(itens / tamanho)
}

/**
 * Prende a página no intervalo válido. Sem páginas devolve 1 — devolver 0
 * deixaria a grade sem nada para mostrar mesmo quando a lista se enche depois.
 *
 * @param {unknown} pagina
 * @param {unknown} totalPaginas
 * @returns {number}
 */
export const normalizarPagina = (pagina, totalPaginas) => {
  const total = inteiroPositivo(totalPaginas)
  if (total === 0) return 1
  const alvo = Math.trunc(Number(pagina))
  if (!Number.isFinite(alvo)) return 1
  return Math.min(Math.max(alvo, 1), total)
}

/**
 * Fatia da página, com os índices 1-based que a barra exibe ("25–48 de 505").
 *
 * @template T
 * @param {T[]} itens
 * @param {unknown} pagina
 * @param {unknown} porPagina
 * @returns {{ visiveis: T[], primeiro: number, ultimo: number, pagina: number, totalPaginas: number }}
 */
export const fatiarPagina = (itens, pagina, porPagina) => {
  const vazio = { visiveis: [], primeiro: 0, ultimo: 0, pagina: 1, totalPaginas: 0 }
  if (!Array.isArray(itens) || itens.length === 0) return vazio

  const tamanho = inteiroPositivo(porPagina)
  if (tamanho === 0) return vazio

  const total = totalDePaginas(itens.length, tamanho)
  const atual = normalizarPagina(pagina, total)
  const inicio = (atual - 1) * tamanho
  const visiveis = itens.slice(inicio, inicio + tamanho)

  return {
    visiveis,
    primeiro: inicio + 1,
    ultimo: inicio + visiveis.length,
    pagina: atual,
    totalPaginas: total,
  }
}

/** Acima disto a lista de botões vira números + elipse em vez de tudo. */
const LIMITE_SEM_ELIPSE = 7

/**
 * Botões a desenhar. Sempre inclui a primeira, a última e a atual, sempre em
 * ordem crescente e sem repetir.
 *
 * @param {number} paginaAtual
 * @param {number} totalPaginas
 * @returns {ItemPagina[]}
 */
export const janelaDePaginas = (paginaAtual, totalPaginas) => {
  const total = inteiroPositivo(totalPaginas)
  if (total === 0) return []

  const atual = normalizarPagina(paginaAtual, total)

  if (total <= LIMITE_SEM_ELIPSE) {
    return Array.from({ length: total }, (_, indice) => indice + 1)
  }

  if (atual <= 4) {
    return [1, 2, 3, 4, 5, 'fim-ellipsis', total]
  }

  if (atual >= total - 3) {
    return [1, 'inicio-ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, 'inicio-ellipsis', atual - 1, atual, atual + 1, 'fim-ellipsis', total]
}
