/**
 * Endereço público do produto.
 *
 * ```
 * /produto/mascara-hidratacao-profunda-9ceea5e4-5fa6-4677-b85d-d89bcb22b7ce
 *          └────────── decoração legível ──────────┘└──────── a chave ────────┘
 * ```
 *
 * **O nome é decoração; quem identifica o produto é o uuid no fim.** Escolhido
 * com o usuário no lugar de uma coluna `slug`, e o motivo não é preguiça:
 *
 * - não exige migração nem coluna para manter em dia;
 * - **renomear o produto não quebra link já compartilhado** — o id não muda, e a
 *   parte legível é recalculada sozinha;
 * - a busca é pela chave primária. Medido em produção: `Index Scan using
 *   produtos_pkey`, 3 buffers, 1,3 ms — não há índice a acrescentar.
 *
 * Spec: specs/pagina-publica-produto.md
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A parte legível existe para a pessoa reconhecer o link, não para caber tudo. */
const LIMITE_PARTE_LEGIVEL = 60

/**
 * Acento vira letra simples, o resto vira `-`. `NFD` separa a letra do acento e
 * a faixa `̀-ͯ` remove só o acento, preservando a letra.
 *
 * @param {unknown} valor
 * @returns {string}
 */
const higienizar = (valor) =>
  (typeof valor === 'string' ? valor : '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * @param {unknown} produto
 * @returns {string} vazio quando não há id válido — sem id não há link.
 */
export const slugDoProduto = (produto) => {
  if (typeof produto !== 'object' || produto === null) return ''
  const { id, nome } = /** @type {{ id?: unknown, nome?: unknown }} */ (produto)
  if (typeof id !== 'string' || !UUID.test(id)) return ''

  const legivel = higienizar(nome)
    .slice(0, LIMITE_PARTE_LEGIVEL)
    // O corte pode cair em cima de um hífen; sem isto sairia `nome--uuid`.
    .replace(/-+$/, '')

  return legivel ? `${legivel}-${id.toLowerCase()}` : id.toLowerCase()
}

/**
 * O uuid dos últimos 36 caracteres. Ler pelo fim, e não por `split('-')`, é o
 * que permite o nome ter quantos hífens quiser.
 *
 * @param {unknown} slug
 * @returns {string | null}
 */
export const idDoSlug = (slug) => {
  if (typeof slug !== 'string') return null
  const limpo = slug.trim()
  if (limpo.length < 36) return null

  const candidato = limpo.slice(-36)
  return UUID.test(candidato) ? candidato.toLowerCase() : null
}

/**
 * @param {unknown} produto
 * @returns {string}
 */
export const caminhoDoProduto = (produto) => {
  const slug = slugDoProduto(produto)
  return slug ? `/produto/${slug}` : ''
}

/**
 * URL absoluta para copiar. Sem origem devolve o caminho relativo — melhor um
 * link relativo que um `undefined/produto/…` colado no WhatsApp.
 *
 * @param {unknown} produto
 * @param {unknown} origem
 * @returns {string}
 */
export const urlPublicaDoProduto = (produto, origem) => {
  const caminho = caminhoDoProduto(produto)
  if (!caminho) return ''

  const base = typeof origem === 'string' ? origem.trim().replace(/\/+$/, '') : ''
  return base ? `${base}${caminho}` : caminho
}
