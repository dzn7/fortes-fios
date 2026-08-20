import { QUALIDADE_PADRAO } from './dimensoes-imagem.mjs'

const HOST_BACKBLAZE_PUBLICO = 'f005.backblazeb2.com'
const BUCKET_PUBLICO = 'derick-mackenzie'
const DIRETORIOS_PERMITIDOS = new Set([
  'vitrine',
  'geral',
  'produtos',
  'bebidas',
  'combos',
  'adicionais',
])

/**
 * Larguras que o hero pede. O banner mobile gravado tem 960 px de largura e o
 * desktop 1200 px, então pedir acima disso só criaria chave de cache sem ganho
 * de pixel — a rota não amplia.
 */
export const LARGURAS_BANNER_MOBILE = Object.freeze([640, 750, 828])
export const LARGURAS_BANNER_DESKTOP = Object.freeze([828, 1080, 1200])

function obterChaveBackblaze(src) {
  if (typeof src !== 'string' || !src.startsWith('https://')) return null

  try {
    const url = new URL(src)
    if (url.hostname !== HOST_BACKBLAZE_PUBLICO) return null

    const partes = url.pathname.split('/').filter(Boolean)
    if (partes[0] !== 'file' || partes[1] !== BUCKET_PUBLICO) return null

    const chave = partes.slice(2).map(decodeURIComponent).join('/')
    const [diretorio] = chave.split('/')

    if (!DIRETORIOS_PERMITIDOS.has(diretorio)) return null
    if (!/^[a-zA-Z0-9/_\-. ]+\.(jpe?g|png|webp|gif)$/i.test(chave)) return null

    return chave
  } catch {
    return null
  }
}

export function criarUrlImagemResiliente(src) {
  const chave = obterChaveBackblaze(src)
  if (!chave) return src

  return `/api/upload?arquivo=${encodeURIComponent(chave)}`
}

/**
 * URL com largura declarada. Fora do bucket devolve a origem intacta: imagem
 * local, `data:` e host externo não passam pela rota.
 */
function criarUrlDimensionada(src, largura, qualidade = QUALIDADE_PADRAO) {
  const url = criarUrlImagemResiliente(src)
  if (url === src) return src

  return `${url}&w=${largura}&q=${qualidade}`
}

/** `"<url> 640w, <url> 750w, …"`. Vazio para imagem que não passa pela rota. */
function criarConjuntoFontes(src, larguras) {
  if (criarUrlImagemResiliente(src) === src) return ''

  return larguras
    .map((largura) => `${criarUrlDimensionada(src, largura)} ${largura}w`)
    .join(', ')
}

/**
 * Fontes do hero.
 *
 * O `srcset` é a metade que faltava: sem largura declarada, o `<img>` do hero
 * — que é tag pura, sem o loader do Next — pedia a arte inteira. Dois banners
 * gravados têm 1,9 MB e 1,15 MB, e chegavam assim num aparelho de 390 px.
 *
 * Spec: specs/desempenho-catalogo-mobile.md
 */
export function criarFontesResponsivasBanner({ desktop, mobile }) {
  const larguraBase = LARGURAS_BANNER_DESKTOP[LARGURAS_BANNER_DESKTOP.length - 1]

  return {
    srcDesktop: criarUrlDimensionada(desktop, larguraBase),
    srcSetDesktop: criarConjuntoFontes(desktop, LARGURAS_BANNER_DESKTOP),
    srcMobile: mobile
      ? criarUrlDimensionada(mobile, LARGURAS_BANNER_MOBILE[LARGURAS_BANNER_MOBILE.length - 1])
      : '',
    srcSetMobile: mobile ? criarConjuntoFontes(mobile, LARGURAS_BANNER_MOBILE) : '',
    mediaMobile: '(max-width: 639px)',
    /** O hero ocupa a largura toda nos dois tamanhos. */
    tamanhos: '100vw',
  }
}

export default function carregadorImagemPublica({ src, width, quality }) {
  const url = criarUrlImagemResiliente(src)
  if (url === src) return src

  return `${url}&w=${width}&q=${quality ?? QUALIDADE_PADRAO}`
}
