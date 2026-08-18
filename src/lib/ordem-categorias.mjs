/**
 * Operações de reordenação da lista de categorias.
 *
 * JS puro, como `filtros-catalogo.mjs` e `frete.mjs`, para a regra ser testável
 * com `node --test` — a única verificação que este projeto aceita (AGENTS §3.4).
 * O modal fica só com a superfície.
 *
 * **Nada aqui muta a lista recebida.** O modal mantém dois retratos ao mesmo
 * tempo, o rascunho e o original, porque é o original que o "Cancelar"
 * restaura; mutar destruiria o segundo no primeiro clique de seta.
 *
 * Spec: specs/ordem-categorias-modal.md
 */

const ehLista = (valor) => Array.isArray(valor)

/** Índice utilizável: inteiro dentro da faixa. Qualquer outra coisa é ruído. */
const indiceValido = (valor, tamanho) =>
  Number.isInteger(valor) && valor >= 0 && valor < tamanho

/**
 * Tira o item de `de` e o insere em `para`, empurrando os do caminho.
 *
 * Índice inválido devolve a lista intacta em vez de lançar: a origem é gesto de
 * interface (arrasto solto fora da lista, clique repetido no fim), e derrubar a
 * tela por isso seria pior que não fazer nada.
 *
 * @param {string[]} lista
 * @param {number} de
 * @param {number} para
 */
export const moverItem = (lista, de, para) => {
  if (!ehLista(lista)) return []

  const copia = [...lista]
  if (!indiceValido(de, copia.length) || !indiceValido(para, copia.length)) return copia
  if (de === para) return copia

  const [item] = copia.splice(de, 1)
  copia.splice(para, 0, item)
  return copia
}

/**
 * @param {string[]} lista
 * @param {number} indice
 */
export const moverParaCima = (lista, indice) => moverItem(lista, indice, indice - 1)

/**
 * @param {string[]} lista
 * @param {number} indice
 */
export const moverParaBaixo = (lista, indice) => moverItem(lista, indice, indice + 1)

/** @param {number} indice */
export const podeSubir = (indice) => Number.isInteger(indice) && indice > 0

/**
 * @param {number} indice
 * @param {number} total
 */
export const podeDescer = (indice, total) =>
  Number.isInteger(indice) && Number.isInteger(total) && indice < total - 1

/**
 * Houve mudança de ordem? Comparação **posicional**: os mesmos nomes em
 * sequência diferente são uma mudança — é justamente o que este modal edita.
 *
 * @param {string[]} antes
 * @param {string[]} depois
 */
export const ordemMudou = (antes, depois) => {
  if (!ehLista(antes) || !ehLista(depois)) return ehLista(antes) !== ehLista(depois)
  if (antes.length !== depois.length) return true
  return antes.some((item, indice) => item !== depois[indice])
}

// Faixa de marcas de acento separadas pelo NFD, escapada de propósito: colar os
// combinantes crus quebra dependendo do editor. Mesmo critério de `categorias.mjs`.
const DIACRITICOS = /[\u0300-\u036f]/g

const chaveNome = (valor) =>
  typeof valor === 'string'
    ? valor.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
    : ''

/**
 * Converte a ordem escolhida no modal em atualizações de
 * `categorias_cardapio.ordem` — a coluna que o catálogo do cliente realmente
 * consulta.
 *
 * **Por que existe.** O modal gravava apenas
 * `configuracoes_loja.ordem_categorias_produtos`, enquanto
 * `/api/vitrine/categorias` ordena por `categorias_cardapio.ordem`. Duas
 * gavetas: reordenar no Admin salvava de verdade, e o site continuava na
 * sequência antiga. A chave em `configuracoes_loja` é herança da época em que
 * categoria era só uma string no produto, antes da tabela existir.
 *
 * Nome sem linha correspondente é ignorado — não há o que atualizar, e inventar
 * linha seria pior. A numeração sai contígua (1..N) sobre o que existe: buraco
 * na sequência devolve empate para o `order by` resolver, que é o problema de
 * origem.
 *
 * @param {string[]} nomes ordem escolhida
 * @param {Array<{ id?: string, nome?: string }>} categorias linhas de `categorias_cardapio`
 * @returns {Array<{ id: string, ordem: number }>}
 */
export const ordenarParaBanco = (nomes, categorias) => {
  if (!ehLista(nomes) || !ehLista(categorias)) return []

  const idPorNome = new Map()
  for (const categoria of categorias) {
    const chave = chaveNome(categoria?.nome)
    if (!chave || typeof categoria?.id !== 'string' || !categoria.id) continue
    if (!idPorNome.has(chave)) idPorNome.set(chave, categoria.id)
  }

  const usados = new Set()
  const atualizacoes = []

  for (const nome of nomes) {
    const id = idPorNome.get(chaveNome(nome))
    if (!id || usados.has(id)) continue
    usados.add(id)
    atualizacoes.push({ id, ordem: atualizacoes.length + 1 })
  }

  // Linha que existe na tabela e não veio na lista entra no fim, na ordem em
  // que o banco a devolveu. Deixá-la com a `ordem` antiga criaria número
  // repetido, e aí quem decide a posição no site é o desempate do `order by` —
  // que é a origem deste bug, não a solução. Aconteceu de verdade: a tabela
  // tinha 11 categorias e a lista salva pelo modal, 10.
  for (const id of idPorNome.values()) {
    if (usados.has(id)) continue
    usados.add(id)
    atualizacoes.push({ id, ordem: atualizacoes.length + 1 })
  }

  return atualizacoes
}
