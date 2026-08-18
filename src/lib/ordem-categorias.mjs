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
