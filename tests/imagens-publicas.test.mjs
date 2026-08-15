import test from 'node:test'
import assert from 'node:assert/strict'

import {
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
  assert.deepEqual(
    criarFontesResponsivasBanner({
      desktop: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/desktop.webp',
      mobile: 'https://f005.backblazeb2.com/file/derick-mackenzie/vitrine/mobile.webp',
    }),
    {
      srcDesktop: '/api/upload?arquivo=vitrine%2Fdesktop.webp',
      srcMobile: '/api/upload?arquivo=vitrine%2Fmobile.webp',
      mediaMobile: '(max-width: 639px)',
    },
  )
})

test('hero sem arte mobile reutiliza desktop sem source alternativo', () => {
  assert.deepEqual(
    criarFontesResponsivasBanner({ desktop: '/banner.webp', mobile: '' }),
    {
      srcDesktop: '/banner.webp',
      srcMobile: '',
      mediaMobile: '(max-width: 639px)',
    },
  )
})
