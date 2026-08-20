/**
 * Regras de redimensionamento das imagens públicas.
 *
 * **Por que isto existe.** `GET /api/upload` recebia `w` e `q` e devolvia o
 * objeto original, byte a byte. O loader do Next monta um `srcset` de 15
 * larguras por imagem; as 15 devolviam o mesmo arquivo em tamanho cheio, cada
 * uma ocupando uma chave de cache diferente no CDN. Resultado medido em
 * produção: dois banners do hero de 1,9 MB e 1,15 MB chegando inteiros num
 * aparelho de 390 px, e fotos de produto lentas justamente nas larguras que
 * ainda não estavam quentes no cache.
 *
 * A decisão de tamanho mora aqui, e não na rota, porque a rota é TypeScript
 * dentro do runtime do Next — fora do alcance do `node --test`, que é o único
 * teste que este projeto aceita (§3.4 do AGENTS.md).
 *
 * Spec: specs/desempenho-catalogo-mobile.md
 */

/**
 * Exatamente as larguras que o projeto emite: `imageSizes` + `deviceSizes` do
 * Next (conferidos em `.next/images-manifest.json`) mais as do hero, que já
 * estão contidas nessa lista.
 *
 * A lista é fechada de propósito. Aceitar largura arbitrária deixaria qualquer
 * requisição abrir uma chave de cache nova e uma invocação serverless nova —
 * o oposto do problema que a rota resolve.
 */
export const LARGURAS_PERMITIDAS = Object.freeze([
  32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
])

const PERMITIDAS = new Set(LARGURAS_PERMITIDAS)

export const QUALIDADE_PADRAO = 75

/** GIF fica de fora: reencodar sem `animated` congelaria no primeiro quadro. */
const TIPOS_CONVERSIVEIS = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * @param {unknown} valor
 * @returns {number | null} a largura pedida, ou `null` para servir o original.
 */
export const normalizarLargura = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const texto = String(valor)
  if (!/^\d+$/.test(texto)) return null
  const numero = Number(texto)
  return PERMITIDAS.has(numero) ? numero : null
}

/**
 * @param {unknown} valor
 * @returns {number} 1–100; qualquer outra coisa cai no padrão.
 */
export const normalizarQualidade = (valor) => {
  if (typeof valor !== 'string' && typeof valor !== 'number') return QUALIDADE_PADRAO
  const texto = String(valor)
  if (!/^\d+$/.test(texto)) return QUALIDADE_PADRAO
  const numero = Number(texto)
  return numero >= 1 && numero <= 100 ? numero : QUALIDADE_PADRAO
}

/**
 * @param {unknown} tipoMime
 * @returns {boolean}
 */
export const deveConverter = (tipoMime) =>
  typeof tipoMime === 'string' && TIPOS_CONVERSIVEIS.has(tipoMime.toLowerCase())

/**
 * Nunca amplia: ampliar não cria detalhe, só peso. Fonte de largura
 * desconhecida (metadado ausente) confia na largura pedida — o `sharp` aplica
 * `withoutEnlargement` de qualquer forma.
 *
 * @param {number} pedida
 * @param {number | null | undefined} daFonte
 * @returns {number}
 */
export const larguraDeSaida = (pedida, daFonte) =>
  typeof daFonte === 'number' && daFonte > 0 ? Math.min(pedida, daFonte) : pedida
