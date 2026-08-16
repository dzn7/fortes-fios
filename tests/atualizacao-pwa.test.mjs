import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ACOES_ATUALIZACAO,
  decidirAcaoAoTrocarControlador,
} from '../src/lib/atualizacao-pwa.mjs'

// 1. A regra que corrige o bug: nada de recarregar por conta própria.
test('nenhuma combinação recarrega sem a pessoa pedir', () => {
  for (const tinhaControlador of [true, false]) {
    const acao = decidirAcaoAoTrocarControlador({ tinhaControlador })
    assert.notEqual(
      acao,
      ACOES_ATUALIZACAO.RECARREGAR,
      `tinhaControlador=${tinhaControlador} recarregou sozinho`,
    )
  }
})

// 2. Primeira instalação: a página já está correta, mexer nela só atrapalha.
test('primeira instalação não faz nada com a página aberta', () => {
  const acao = decidirAcaoAoTrocarControlador({ tinhaControlador: false })
  assert.equal(acao, ACOES_ATUALIZACAO.IGNORAR)
})

// 3. Versão nova assumindo: avisa, não age.
test('troca de versão apenas oferece a atualização', () => {
  const acao = decidirAcaoAoTrocarControlador({ tinhaControlador: true })
  assert.equal(acao, ACOES_ATUALIZACAO.OFERECER)
})

// 4. O único caminho para recarregar é o clique.
test('recarrega quando a pessoa pediu', () => {
  const acao = decidirAcaoAoTrocarControlador({
    tinhaControlador: true,
    pedidoPelaPessoa: true,
  })
  assert.equal(acao, ACOES_ATUALIZACAO.RECARREGAR)
})

test('pedido da pessoa vale mesmo na primeira instalação', () => {
  const acao = decidirAcaoAoTrocarControlador({
    tinhaControlador: false,
    pedidoPelaPessoa: true,
  })
  assert.equal(acao, ACOES_ATUALIZACAO.RECARREGAR)
})

// 5. Entrada ausente ou estranha não pode virar reload.
test('entrada inválida nunca recarrega', () => {
  for (const entrada of [undefined, null, {}, { tinhaControlador: 'sim' }, 'texto', 42]) {
    const acao = decidirAcaoAoTrocarControlador(entrada)
    assert.notEqual(acao, ACOES_ATUALIZACAO.RECARREGAR, `${JSON.stringify(entrada)} recarregou`)
    assert.ok(Object.values(ACOES_ATUALIZACAO).includes(acao), `ação desconhecida: ${acao}`)
  }
})
