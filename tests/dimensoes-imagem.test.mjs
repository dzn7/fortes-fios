import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LARGURAS_PERMITIDAS,
  QUALIDADE_PADRAO,
  deveConverter,
  larguraDeSaida,
  normalizarLargura,
  normalizarQualidade,
} from '../src/lib/dimensoes-imagem.mjs'

/*
 * Estes limites não são gosto: são exatamente as larguras que o projeto emite.
 * `imageSizes` + `deviceSizes` do Next (conferidos em .next/images-manifest.json)
 * mais as que o hero declara. Aceitar largura arbitrária transformaria cada
 * requisição numa chave de cache nova — o oposto do problema que a rota resolve.
 */

test('largura da lista permitida é aceita', () => {
  for (const largura of LARGURAS_PERMITIDAS) {
    assert.equal(normalizarLargura(String(largura)), largura)
  }
})

test('largura fora da lista é recusada', () => {
  for (const lixo of ['641', '10000', '0', '-640', 'abc', '', null, undefined, '64.5']) {
    assert.equal(normalizarLargura(lixo), null, `aceitou ${String(lixo)}`)
  }
})

test('qualidade inválida cai no padrão', () => {
  for (const lixo of ['', null, undefined, 'abc', '0', '101', '-1']) {
    assert.equal(normalizarQualidade(lixo), QUALIDADE_PADRAO)
  }
})

test('qualidade válida é preservada', () => {
  assert.equal(normalizarQualidade('60'), 60)
  assert.equal(normalizarQualidade('100'), 100)
  assert.equal(normalizarQualidade('1'), 1)
})

test('GIF não é convertido, para não perder a animação', () => {
  assert.equal(deveConverter('image/gif'), false)
})

test('formatos estáticos são convertidos', () => {
  for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(deveConverter(tipo), true, `recusou ${tipo}`)
  }
})

test('tipo desconhecido ou ausente não é convertido', () => {
  for (const tipo of ['application/octet-stream', '', null, undefined]) {
    assert.equal(deveConverter(tipo), false)
  }
})

test('nunca amplia: largura pedida maior que a fonte usa a fonte', () => {
  assert.equal(larguraDeSaida(640, 400), 400)
  assert.equal(larguraDeSaida(1920, 1200), 1200)
})

test('largura pedida menor que a fonte é respeitada', () => {
  assert.equal(larguraDeSaida(640, 1200), 640)
})

test('fonte de largura desconhecida usa a largura pedida', () => {
  assert.equal(larguraDeSaida(640, null), 640)
  assert.equal(larguraDeSaida(640, 0), 640)
})
