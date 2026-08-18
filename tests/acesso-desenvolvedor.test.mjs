import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ID_DESENVOLVEDOR,
  USUARIO_DESENVOLVEDOR,
  VERSAO_PERMISSOES_DESENVOLVEDOR,
  ehCredencialDesenvolvedor,
  ehDesenvolvedor,
  idAtorParaAuditoria,
  perfilDesenvolvedor,
} from '../src/lib/server/acesso-desenvolvedor.mjs'

// 1. a credencial
test('o par exato entra', () => {
  assert.equal(ehCredencialDesenvolvedor('dzndev', '1503'), true)
})

test('usuário é comparado sem caixa e sem espaço nas pontas', () => {
  assert.equal(ehCredencialDesenvolvedor('  DZNDEV ', '1503'), true)
})

test('senha não é normalizada: espaço a mais é senha errada', () => {
  assert.equal(ehCredencialDesenvolvedor('dzndev', '1503 '), false)
  assert.equal(ehCredencialDesenvolvedor('dzndev', ' 1503'), false)
})

test('senha errada não entra', () => {
  assert.equal(ehCredencialDesenvolvedor('dzndev', '1504'), false)
  assert.equal(ehCredencialDesenvolvedor('dzndev', ''), false)
})

test('outro usuário com a mesma senha não entra', () => {
  assert.equal(ehCredencialDesenvolvedor('james_fortes', '1503'), false)
})

test('entrada que não é string não derruba a comparação', () => {
  for (const lixo of [null, undefined, 0, {}, [], true]) {
    assert.equal(ehCredencialDesenvolvedor(lixo, '1503'), false)
    assert.equal(ehCredencialDesenvolvedor('dzndev', lixo), false)
  }
})

// 2. o perfil sintético
test('perfil vem com papel admin e o id sentinela', () => {
  const perfil = perfilDesenvolvedor()
  assert.equal(perfil.id, ID_DESENVOLVEDOR)
  assert.equal(perfil.papel, 'admin')
  assert.equal(perfil.nomeUsuario, USUARIO_DESENVOLVEDOR)
  assert.equal(perfil.permissoesVersao, VERSAO_PERMISSOES_DESENVOLVEDOR)
})

test('perfil resolve as permissões de administrador', () => {
  const perfil = perfilDesenvolvedor()
  for (const chave of ['acessos.criar', 'financas.ver', 'dashboard.ver_receita']) {
    assert.equal(perfil.permissoes[chave], true, `faltou ${chave}`)
  }
})

test('cada chamada devolve um objeto novo — mutar um não contamina o próximo', () => {
  const primeiro = perfilDesenvolvedor()
  primeiro.papel = 'atendente'
  primeiro.permissoes['acessos.criar'] = false

  const segundo = perfilDesenvolvedor()
  assert.equal(segundo.papel, 'admin')
  assert.equal(segundo.permissoes['acessos.criar'], true)
})

test('o id sentinela é um UUID válido para o regex das rotas', () => {
  const UUID_VALIDO =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  assert.match(ID_DESENVOLVEDOR, UUID_VALIDO)
})

// 3. reconhecimento e auditoria
test('ehDesenvolvedor só reconhece o id sentinela', () => {
  assert.equal(ehDesenvolvedor(ID_DESENVOLVEDOR), true)
  assert.equal(ehDesenvolvedor('08448776-167b-434f-8d30-5df912fc91b2'), false)
  assert.equal(ehDesenvolvedor(null), false)
})

/*
 * `acessos_auditoria.ator_id` é FK para `usuarios_sistema(id)`. O desenvolvedor
 * não tem linha, então gravar o id sentinela levantaria 23503 e derrubaria a
 * operação inteira. `null` é o valor honesto: a ação existiu, o ator não é um
 * usuário do sistema.
 */
test('ator de auditoria vira null para o desenvolvedor', () => {
  assert.equal(idAtorParaAuditoria(ID_DESENVOLVEDOR), null)
})

test('ator de auditoria preserva o id de um usuário real', () => {
  const real = '08448776-167b-434f-8d30-5df912fc91b2'
  assert.equal(idAtorParaAuditoria(real), real)
})

// 4. a credencial não pode vazar para o navegador
test('o módulo mora sob src/lib/server — fora do alcance de componente client', async () => {
  const { readFileSync, existsSync } = await import('node:fs')
  const caminho = new URL('../src/lib/server/acesso-desenvolvedor.mjs', import.meta.url)
  assert.equal(existsSync(caminho), true)
  assert.match(readFileSync(caminho, 'utf8'), /dzndev/)
})
