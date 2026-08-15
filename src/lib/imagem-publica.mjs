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

export function criarFontesResponsivasBanner({ desktop, mobile }) {
  return {
    srcDesktop: criarUrlImagemResiliente(desktop),
    srcMobile: mobile ? criarUrlImagemResiliente(mobile) : '',
    mediaMobile: '(max-width: 639px)',
  }
}

export default function carregadorImagemPublica({ src, width, quality }) {
  const url = criarUrlImagemResiliente(src)
  if (url === src) return src

  return `${url}&w=${width}&q=${quality ?? 75}`
}
