/**
 * Filtragem e ordenação do catálogo do cliente.
 *
 * Estava tudo dentro de um `useMemo` de `page.tsx`: a busca só olhava
 * `produto.nome`, era sensível a acento (quem digitava "mascara" não achava
 * "Máscara") e a ordenação tinha três opções escritas à mão no meio do JSX.
 *
 * Aqui, como `frete.mjs` e `whatsapp.mjs`: JS puro, sem React e sem banco, para
 * a regra ser testável com `node --test` — que é o único teste que este projeto
 * aceita (AGENTS §3.4).
 *
 * Spec: specs/filtros-catalogo-cliente.md
 */

/** Sentinela de "sem filtro de categoria". A tela usa o rótulo configurável. */
export const CATEGORIA_TODOS = 'todos'

export const ORDENACAO_PADRAO = 'recomendados'

/**
 * As opções oferecidas ao cliente, na ordem em que aparecem.
 *
 * "Maiores descontos" vem logo depois de "Recomendados" porque é o atalho para
 * a intenção mais comum de quem abre uma loja de cosméticos sem produto
 * decidido: ver o que está mais barato que o normal.
 */
export const ORDENACOES_CATALOGO = [
  { id: 'recomendados', rotulo: 'Recomendados' },
  { id: 'maior_desconto', rotulo: 'Maiores descontos' },
  { id: 'menor_preco', rotulo: 'Menor preço' },
  { id: 'maior_preco', rotulo: 'Maior preço' },
  { id: 'lancamentos', rotulo: 'Novidades' },
]

const IDS_ORDENACAO = ORDENACOES_CATALOGO.map((opcao) => opcao.id)

/** @param {unknown} valor */
export const normalizarOrdenacao = (valor) =>
  IDS_ORDENACAO.includes(valor) ? valor : ORDENACAO_PADRAO

// Faixa ̀-ͯ = marcas de acento separadas pelo NFD (escapada de propósito, como
// em `cadastro-equipe.ts`: colar os combinantes crus quebra em alguns editores).
const DIACRITICOS = /[̀-ͯ]/g

/**
 * Chave de comparação: sem acento, minúscula, sem espaço repetido. É o que faz
 * "oleo" encontrar "Óleo" — e "Óleo" encontrar "oleo".
 *
 * @param {unknown} valor
 */
export const chaveTexto = (valor) =>
  typeof valor === 'string'
    ? valor.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().replace(/\s+/g, ' ').trim()
    : ''

const numero = (valor) => {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

/**
 * Percentual de desconto **efetivo**, 0 quando não há.
 *
 * A regra é copiada de `CartaoProduto`: só é desconto quando existe percentual
 * **e** `preco_original` maior que o preço atual. Se a ordenação usasse um
 * critério mais frouxo, "Maiores descontos" traria para o topo produtos sem
 * tarja nenhuma no cartão — o cliente veria a promessa e não a promoção.
 *
 * @param {{ desconto?: unknown, preco?: unknown, preco_original?: unknown } | null} produto
 */
export const percentualDesconto = (produto) => {
  if (!produto) return 0

  const percentual = numero(produto.desconto)
  if (percentual <= 0) return 0

  const original = produto.preco_original
  if (typeof original !== 'number' || !Number.isFinite(original)) return 0
  if (original <= numero(produto.preco)) return 0

  return percentual
}

/** @param {object | null} produto */
export const produtoEmOferta = (produto) => percentualDesconto(produto) > 0

/**
 * Tudo que a busca alcança. Incluir descrição e categoria é o que faz a
 * promessa do campo ("Buscar shampoo, máscara, kit ou marca") virar verdade:
 * antes, só o nome era consultado.
 *
 * @param {{ nome?: unknown, descricao?: unknown, categoria?: unknown } | null} produto
 */
export const textoBuscavelProduto = (produto) =>
  produto
    ? chaveTexto([produto.nome, produto.descricao, produto.categoria].filter(Boolean).join(' '))
    : ''

/**
 * Todos os termos precisam aparecer, em qualquer ordem — "hidratante shampoo"
 * acha "Shampoo Hidratante". Casar por substring inteira obrigaria o cliente a
 * digitar o nome na ordem exata do cadastro.
 *
 * @param {object | null} produto
 * @param {unknown} busca
 */
export const produtoAtendeBusca = (produto, busca) => {
  const termos = chaveTexto(busca).split(' ').filter(Boolean)
  if (termos.length === 0) return true

  const alvo = textoBuscavelProduto(produto)
  return termos.every((termo) => alvo.includes(termo))
}

/**
 * @typedef {{
 *   busca?: unknown,
 *   categoria?: unknown,
 *   apenasOfertas?: unknown,
 *   ordenacao?: unknown,
 * }} FiltrosCatalogo
 */

/**
 * @param {object[]} produtos
 * @param {FiltrosCatalogo} filtros
 */
export const filtrarProdutos = (produtos, filtros = {}) => {
  const lista = Array.isArray(produtos) ? produtos : []
  const categoria = chaveTexto(filtros.categoria)
  const filtraCategoria = categoria !== '' && categoria !== CATEGORIA_TODOS

  return lista.filter((produto) => {
    if (filtraCategoria && chaveTexto(produto?.categoria) !== categoria) return false
    if (filtros.apenasOfertas && !produtoEmOferta(produto)) return false
    return produtoAtendeBusca(produto, filtros.busca)
  })
}

const instante = (valor) => {
  const data = new Date(valor ?? 0).getTime()
  return Number.isFinite(data) ? data : 0
}

const COMPARADORES = {
  recomendados: null,
  maior_desconto: (a, b) => percentualDesconto(b) - percentualDesconto(a),
  menor_preco: (a, b) => numero(a?.preco) - numero(b?.preco),
  maior_preco: (a, b) => numero(b?.preco) - numero(a?.preco),
  lancamentos: (a, b) => instante(b?.created_at) - instante(a?.created_at),
}

/**
 * Ordena sem mutar. `recomendados` devolve a ordem que veio do banco — que já é
 * a curadoria da loja (`ordem`, destaque), e sobrescrevê-la seria descartar o
 * trabalho feito no admin.
 *
 * `Array.prototype.sort` é estável, então empate mantém a ordem recomendada:
 * dois produtos com 20% de desconto continuam na sequência escolhida pela loja.
 *
 * @param {object[]} produtos
 * @param {unknown} ordenacao
 */
export const ordenarProdutos = (produtos, ordenacao) => {
  const lista = Array.isArray(produtos) ? [...produtos] : []
  const comparador = COMPARADORES[normalizarOrdenacao(ordenacao)]
  return comparador ? lista.sort(comparador) : lista
}

/**
 * Filtra e então ordena. Nesta ordem: ordenar antes seria trabalho jogado fora
 * sobre itens que o filtro descarta em seguida.
 *
 * @param {object[]} produtos
 * @param {FiltrosCatalogo} filtros
 */
export const aplicarFiltrosCatalogo = (produtos, filtros = {}) =>
  ordenarProdutos(filtrarProdutos(produtos, filtros), filtros.ordenacao)

/**
 * Quantos filtros o cliente ligou. Alimenta o contador do botão de filtros e
 * decide se o "limpar" aparece. **Ordenação não conta**: o catálogo sempre tem
 * alguma, e mostrar "1 filtro ativo" numa tela intocada seria mentira.
 *
 * @param {FiltrosCatalogo} filtros
 */
export const contarFiltrosAtivos = (filtros = {}) => {
  const categoria = chaveTexto(filtros.categoria)
  let total = 0

  if (chaveTexto(filtros.busca) !== '') total += 1
  if (categoria !== '' && categoria !== CATEGORIA_TODOS) total += 1
  if (filtros.apenasOfertas) total += 1

  return total
}
