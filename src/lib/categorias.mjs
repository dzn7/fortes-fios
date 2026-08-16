/**
 * Categorias do catálogo.
 *
 * A tela antiga pedia só o nome, num campo solto. Categoria é o que organiza a
 * navegação da loja inteira — merece ícone, que é o que o cliente reconhece de
 * relance no filtro, e uma validação que impeça o erro real do dia a dia:
 * criar "Cachos" quando já existe "cachos".
 *
 * Aqui ficam apenas ids e palavras. O mapeamento id → componente de ícone mora
 * no componente: classe e import de ícone são assunto de apresentação, e
 * `src/lib/*.mjs` está fora do `content` do Tailwind de qualquer forma.
 */

export const ICONE_CATEGORIA_PADRAO = 'etiqueta'

/**
 * Catálogo enxuto e específico da loja. Um punhado reconhecível vale mais que
 * uma biblioteca inteira onde ninguém acha o que quer.
 *
 * `palavras` alimenta a sugestão automática — sem acento, porque a comparação
 * normaliza os dois lados.
 */
export const ICONES_CATEGORIA = [
  { id: 'etiqueta', rotulo: 'Etiqueta', palavras: ['outros', 'geral', 'diversos'] },
  { id: 'banho', rotulo: 'Banho', palavras: ['shampoo', 'condicionador', 'banho', 'lavagem'] },
  { id: 'cachos', rotulo: 'Cachos', palavras: ['cacho', 'cacheado', 'crespo', 'ondulado'] },
  { id: 'liso', rotulo: 'Liso', palavras: ['liso', 'progressiva', 'alisamento', 'escova'] },
  { id: 'tratamento', rotulo: 'Tratamento', palavras: ['tratamento', 'reconstrucao', 'hidratacao', 'nutricao', 'ressecado', 'pos-quimica', 'quimica'] },
  { id: 'kit', rotulo: 'Kit', palavras: ['kit', 'promopack', 'combo', 'pack'] },
  { id: 'coloracao', rotulo: 'Coloração', palavras: ['tintura', 'coloracao', 'cor', 'matizador', 'tonalizante'] },
  { id: 'infantil', rotulo: 'Infantil', palavras: ['infantil', 'kids', 'crianca', 'baby'] },
  { id: 'ferramenta', rotulo: 'Ferramentas', palavras: ['ferramenta', 'acessorio', 'escova', 'pente', 'secador'] },
  { id: 'maquiagem', rotulo: 'Maquiagem', palavras: ['maquiagem', 'make', 'batom', 'mary kay', 'perfumaria'] },
  { id: 'pele', rotulo: 'Pele', palavras: ['pele', 'skin', 'facial', 'corporal', 'hidratante'] },
  { id: 'promocao', rotulo: 'Promoção', palavras: ['promocao', 'oferta', 'desconto', 'liquidacao'] },
]

const IDS_VALIDOS = new Set(ICONES_CATEGORIA.map((icone) => icone.id))

/** @param {unknown} id */
export const iconeValido = (id) =>
  typeof id === 'string' && IDS_VALIDOS.has(id) ? id : ICONE_CATEGORIA_PADRAO

// Faixa de marcas de acento separadas pelo NFD, escapada de propósito: colar os
// caracteres combinantes crus quebra dependendo do editor.
const DIACRITICOS = /[̀-ͯ]/g

const semAcento = (valor) =>
  String(valor || '')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .trim()

/** @param {unknown} nome */
export const normalizarNomeCategoria = (nome) =>
  typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : ''

/**
 * Palpite pelo nome, para o caso comum não exigir escolha nenhuma. A pessoa
 * digita "Cabelos cacheados" e o ícone de cachos já vem marcado — continua
 * trocável, mas ninguém precisa procurar.
 *
 * A ordem importa: o primeiro ícone cuja palavra aparecer no nome vence, e o
 * catálogo está ordenado do mais genérico para o mais específico, de modo que
 * o específico não seja engolido.
 *
 * @param {unknown} nome
 */
export const sugerirIconePorNome = (nome) => {
  const alvo = semAcento(nome)
  if (!alvo) return ICONE_CATEGORIA_PADRAO

  for (const icone of ICONES_CATEGORIA) {
    if (icone.id === ICONE_CATEGORIA_PADRAO) continue
    if (icone.palavras.some((palavra) => alvo.includes(palavra))) return icone.id
  }

  return ICONE_CATEGORIA_PADRAO
}

/**
 * Mensagem de erro, ou `null`. O duplicado ignora acento e caixa porque é
 * assim que ele acontece de verdade: ninguém cria "Cachos" duas vezes igual,
 * cria "cachos" achando que é outra coisa.
 *
 * @param {{ id?: string, nome?: string }} categoria
 * @param {Array<{ id?: string, nome?: string }>} existentes
 */
export const validarCategoria = (categoria, existentes = []) => {
  const nome = normalizarNomeCategoria(categoria?.nome)

  if (!nome) return 'Dê um nome para a categoria.'
  if (nome.length < 2) return 'O nome precisa de ao menos 2 caracteres.'
  if (nome.length > 60) return 'O nome está longo demais.'

  const alvo = semAcento(nome)
  const colide = (Array.isArray(existentes) ? existentes : []).some(
    (item) => item?.id !== categoria?.id && semAcento(item?.nome) === alvo,
  )

  if (colide) return `Já existe uma categoria chamada "${nome}".`
  return null
}
