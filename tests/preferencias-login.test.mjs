import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAVE_LOGIN_LEMBRADO,
  lerLoginLembrado,
  montarLoginLembrado,
} from '../src/lib/preferencias-login.mjs'

// 1. a regra que não se negocia
test('a preferência guarda o usuário e nunca a senha', () => {
  const guardado = montarLoginLembrado({
    nomeUsuario: 'james_fortes',
    senha: 'senha-secreta-123',
    lembrar: true,
  })

  const serializado = JSON.stringify(guardado)
  assert.ok(!serializado.includes('senha-secreta-123'))
  assert.ok(!('senha' in guardado))
  assert.equal(guardado.nomeUsuario, 'james_fortes')
  assert.equal(guardado.lembrar, true)
})

test('não lembrar devolve preferência vazia, sem usuário', () => {
  const guardado = montarLoginLembrado({
    nomeUsuario: 'james_fortes',
    senha: 'x',
    lembrar: false,
  })

  assert.equal(guardado.nomeUsuario, '')
  assert.equal(guardado.lembrar, false)
})

// 2. o usuário é normalizado igual ao login
test('usuário é gravado em minúsculas e sem espaço', () => {
  const guardado = montarLoginLembrado({ nomeUsuario: '  James_Fortes  ', lembrar: true })
  assert.equal(guardado.nomeUsuario, 'james_fortes')
})

test('usuário vazio não vira preferência lembrada', () => {
  assert.equal(montarLoginLembrado({ nomeUsuario: '   ', lembrar: true }).lembrar, false)
  assert.equal(montarLoginLembrado({ lembrar: true }).lembrar, false)
})

// 3. leitura defensiva: o storage é do usuário e pode conter qualquer coisa
test('conteúdo inválido no storage devolve preferência vazia', () => {
  for (const entrada of [null, undefined, '', '{quebrado', '[]', '"texto"', '42']) {
    const lido = lerLoginLembrado(entrada)
    assert.equal(lido.lembrar, false)
    assert.equal(lido.nomeUsuario, '')
  }
})

test('preferência válida é lida de volta', () => {
  const guardado = montarLoginLembrado({ nomeUsuario: 'james_fortes', lembrar: true })
  const lido = lerLoginLembrado(JSON.stringify(guardado))

  assert.equal(lido.nomeUsuario, 'james_fortes')
  assert.equal(lido.lembrar, true)
})

// 4. resíduo do modelo antigo, que guardava senha em texto claro
test('preferência antiga com senha é lida sem a senha', () => {
  const antigo = JSON.stringify({
    nomeUsuario: 'james_fortes',
    senha: 'senha-em-texto-claro',
    lembrar: true,
  })

  const lido = lerLoginLembrado(antigo)
  assert.equal(lido.nomeUsuario, 'james_fortes')
  assert.ok(!('senha' in lido))
  assert.ok(!JSON.stringify(lido).includes('senha-em-texto-claro'))
})

test('a chave de storage é estável', () => {
  assert.equal(typeof CHAVE_LOGIN_LEMBRADO, 'string')
  assert.ok(CHAVE_LOGIN_LEMBRADO.length > 0)
})
