/**
 * Fatia o catálogo público em lotes.
 *
 * **Por que isto existe.** A aba "Todos" montava os 505 produtos disponíveis de
 * uma vez: 505 `<article>`, 505 `<img>` com `srcset` de 15 URLs cada (≈7 600
 * URLs para o parser do navegador) e 505 raízes de `Dialog`. O custo é de main
 * thread, não de rede — é a rolagem travada e o toque com atraso que o cliente
 * relatou no celular.
 *
 * O lote não some com produto nenhum: cresce sozinho conforme a pessoa rola.
 *
 * Spec: specs/desempenho-catalogo-mobile.md
 */

/**
 * 24 fecha 2 linhas no desktop (12 colunas), 6 no mobile (4 colunas) e ainda
 * ultrapassa a dobra, então o gatilho de "carregar mais" nunca fica visível de
 * saída — a lista parece inteira desde o primeiro quadro.
 */
export const TAMANHO_LOTE_CATALOGO = 24

/**
 * @template T
 * @param {T[]} itens
 * @param {number} limite
 * @returns {{ visiveis: T[], temMais: boolean, restantes: number }}
 */
export const fatiarCatalogo = (itens, limite = TAMANHO_LOTE_CATALOGO) => {
  if (!Array.isArray(itens)) return { visiveis: [], temMais: false, restantes: 0 }

  const teto = Math.max(0, Math.trunc(Number(limite) || 0))
  const visiveis = itens.slice(0, teto)
  const restantes = Math.max(0, itens.length - visiveis.length)

  return { visiveis, temMais: restantes > 0, restantes }
}

/**
 * Próximo teto, sempre parando no total. Um limite zerado ou negativo volta
 * para um lote: filtro trocado reinicia a contagem, e reiniciar em zero
 * deixaria a grade vazia.
 *
 * @param {number} limiteAtual
 * @param {number} total
 * @param {number} passo
 * @returns {number}
 */
export const proximoLimite = (limiteAtual, total, passo = TAMANHO_LOTE_CATALOGO) => {
  const atual = Number(limiteAtual) || 0
  const base = atual < passo ? 0 : atual
  return Math.min(base + passo, Math.max(0, Number(total) || 0))
}
