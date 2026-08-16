import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DURACAO_SESSAO_SEGUNDOS,
  assinarSessao,
  verificarSessao,
} from '../src/lib/sessao-token.mjs'

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente-1234567890'
const OUTRO_SEGREDO = 'outro-segredo-de-teste-com-tamanho-suficiente-098'

const AGORA = 1_800_000_000 // segundos

const carga = (sobrescritas = {}) => ({
  usuarioId: '08448776-167b-434f-8d30-5df912fc91b2',
  papel: 'atendente',
  versao: 3,
  ...sobrescritas,
})

// 1. ida e volta
test('sessão assinada volta com a mesma carga', () => {
  const token = assinarSessao(carga(), SEGREDO, AGORA)
  const lida = verificarSessao(token, SEGREDO, AGORA)

  assert.equal(lida?.usuarioId, '08448776-167b-434f-8d30-5df912fc91b2')
  assert.equal(lida?.papel, 'atendente')
  assert.equal(lida?.versao, 3)
  assert.equal(lida?.exp, AGORA + DURACAO_SESSAO_SEGUNDOS)
})

// 2. adulterar a carga invalida a assinatura — é o ponto inteiro do HMAC
test('carga adulterada é rejeitada', () => {
  const token = assinarSessao(carga({ papel: 'atendente' }), SEGREDO, AGORA)
  const [cargaB64, assinatura] = token.split('.')

  const adulterada = Buffer.from(
    JSON.stringify({ ...carga({ papel: 'admin' }), exp: AGORA + DURACAO_SESSAO_SEGUNDOS }),
    'utf8',
  ).toString('base64url')

  assert.equal(verificarSessao(`${adulterada}.${assinatura}`, SEGREDO, AGORA), null)
  assert.notEqual(adulterada, cargaB64)
})

// 3. assinatura de outro segredo não vale
test('token assinado com outro segredo é rejeitado', () => {
  const token = assinarSessao(carga(), OUTRO_SEGREDO, AGORA)
  assert.equal(verificarSessao(token, SEGREDO, AGORA), null)
})

// 4. expiração
test('token expirado é rejeitado', () => {
  const token = assinarSessao(carga(), SEGREDO, AGORA)

  assert.notEqual(verificarSessao(token, SEGREDO, AGORA + DURACAO_SESSAO_SEGUNDOS - 1), null)
  assert.equal(verificarSessao(token, SEGREDO, AGORA + DURACAO_SESSAO_SEGUNDOS + 1), null)
})

// 5. entrada malformada não derruba o servidor
test('token malformado devolve null sem lançar', () => {
  for (const entrada of ['', 'sem-ponto', 'a.b.c', 'ñ.ñ', null, undefined, 42, '.', 'a.']) {
    assert.equal(verificarSessao(entrada, SEGREDO, AGORA), null)
  }
})

// 6. segredo ausente não pode virar sessão válida
test('segredo vazio recusa assinar e recusa verificar', () => {
  assert.throws(() => assinarSessao(carga(), '', AGORA))
  assert.throws(() => assinarSessao(carga(), 'curto', AGORA))
  assert.equal(verificarSessao('qualquer.coisa', '', AGORA), null)
})

// 7. carga inválida não vira token
test('carga sem usuarioId é recusada', () => {
  assert.throws(() => assinarSessao({ papel: 'admin', versao: 1 }, SEGREDO, AGORA))
  assert.throws(() => assinarSessao(carga({ versao: 'tres' }), SEGREDO, AGORA))
})
