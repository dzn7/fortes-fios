import test from 'node:test'
import assert from 'node:assert/strict'

import carregadorImagemPublica, {
  LARGURAS_BANNER_DESKTOP,
  LARGURAS_BANNER_MOBILE,
  criarFontesResponsivasBanner,
  criarUrlImagemResiliente,
} from '../src/lib/imagem-publica.mjs'

test('URL pública do Backblaze usa a rota same-origin e preserva a chave', () => {
  assert.equal(
    criarUrlImagemResiliente(
      'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/banner principal.webp',
    ),
    '/api/upload?arquivo=vitrine%2Fbanner%20principal.webp',
  )
})

test('imagem local não é alterada', () => {
  assert.equal(criarUrlImagemResiliente('/logo.webp'), '/logo.webp')
})

test('host externo que não pertence ao bucket não é alterado', () => {
  const url = 'https://images.example.com/produto.webp'
  assert.equal(criarUrlImagemResiliente(url), url)
})

test('hero usa desktop como base e mobile somente até 639px', () => {
  const fontes = criarFontesResponsivasBanner({
    desktop: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/desktop.webp',
    mobile: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/mobile.webp',
  })

  assert.match(fontes.srcDesktop, /^\/api\/upload\?arquivo=vitrine%2Fdesktop\.webp&/)
  assert.match(fontes.srcMobile, /^\/api\/upload\?arquivo=vitrine%2Fmobile\.webp&/)
  assert.equal(fontes.mediaMobile, '(max-width: 639px)')
})

test('hero sem arte mobile reutiliza desktop sem source alternativo', () => {
  assert.deepEqual(
    criarFontesResponsivasBanner({ desktop: '/banner.webp', mobile: '' }),
    {
      srcDesktop: '/banner.webp',
      srcSetDesktop: '',
      srcMobile: '',
      srcSetMobile: '',
      mediaMobile: '(max-width: 639px)',
      tamanhos: '100vw',
    },
  )
})

/*
 * A partir daqui: spec `desempenho-catalogo-mobile`.
 *
 * O loader já mandava `w` e `q`, mas o hero — que é <img> puro, sem loader do
 * Next — pedia a arte inteira. Com dois banners de 1,9 MB e 1,15 MB gravados,
 * era o maior peso isolado da home no celular, bem no caminho do LCP.
 */

test('o loader do Next carrega largura e qualidade na URL same-origin', () => {
  assert.equal(
    carregadorImagemPublica({
      src: 'https://f005.backblazeb2.com/file/derick-mackenzie/produtos/foto.jpg',
      width: 640,
      quality: 60,
    }),
    '/api/upload?arquivo=produtos%2Ffoto.jpg&w=640&q=60',
  )
})

test('o loader usa a qualidade padrão quando o Next não passa uma', () => {
  assert.match(
    carregadorImagemPublica({
      src: 'https://f005.backblazeb2.com/file/derick-mackenzie/produtos/foto.jpg',
      width: 750,
    }),
    /&w=750&q=75$/,
  )
})

test('imagem fora do bucket passa direto pelo loader, sem w nem q', () => {
  assert.equal(
    carregadorImagemPublica({ src: '/logo.webp', width: 640, quality: 75 }),
    '/logo.webp',
  )
})

test('o hero declara srcset com largura, e não a arte inteira', () => {
  const fontes = criarFontesResponsivasBanner({
    desktop: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/desktop.webp',
    mobile: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/mobile.webp',
  })

  for (const largura of LARGURAS_BANNER_MOBILE) {
    assert.ok(
      fontes.srcSetMobile.includes(`w=${largura}`),
      `srcset mobile não pediu ${largura}`,
    )
    assert.ok(fontes.srcSetMobile.includes(`${largura}w`))
  }
  for (const largura of LARGURAS_BANNER_DESKTOP) {
    assert.ok(
      fontes.srcSetDesktop.includes(`w=${largura}`),
      `srcset desktop não pediu ${largura}`,
    )
  }

  assert.equal(fontes.tamanhos, '100vw')
  assert.match(fontes.srcDesktop, /^\/api\/upload\?arquivo=vitrine%2Fdesktop\.webp&w=\d+/)
})

test('hero sem arte mobile não declara source alternativo', () => {
  const fontes = criarFontesResponsivasBanner({
    desktop: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/desktop.webp',
    mobile: '',
  })
  assert.equal(fontes.srcMobile, '')
  assert.equal(fontes.srcSetMobile, '')
})

test('banner fora do bucket não ganha srcset inventado', () => {
  const fontes = criarFontesResponsivasBanner({ desktop: '/banner.webp', mobile: '' })
  assert.equal(fontes.srcDesktop, '/banner.webp')
  assert.equal(fontes.srcSetDesktop, '')
})
