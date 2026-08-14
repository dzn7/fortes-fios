import test from 'node:test'
import assert from 'node:assert/strict'

import {
  montarMensagemCobrancaCrediario,
  normalizarTelefoneCobranca,
  resolverTelefoneCobranca,
} from '../src/lib/crediario-cobranca.mjs'

test('monta cobranca personalizada com pedido, dia e saldo real', () => {
  const mensagem = montarMensagemCobrancaCrediario({
    clienteNome: 'Maria de Sousa',
    saldoAtual: 12,
    referenciaEm: '2026-08-03T01:35:18.588939+00:00',
    movimentos: [{
      tipo: 'consumo',
      status: 'ativo',
      valor: 12,
      descricao: 'Pedido #43',
      realizado_em: '2026-08-03T01:35:18.588939+00:00',
      criado_em: '2026-08-03T01:35:18.588939+00:00',
      itens: [{ nome: 'Pastel de frango', quantidade: 2 }],
    }],
  })

  assert.match(mensagem, /^oi, Maria 😊 tudo bem\?/)
  assert.match(mensagem, /\*pedido #43 · 02\/08\/2026\*/)
  assert.match(mensagem, /• 2x Pastel de frango/)
  assert.match(mensagem, /\*saldo total em aberto: R\$ 12,00\*/)
  assert.match(mensagem, /crediário aqui do Edienai Lanches/)
  assert.doesNotMatch(mensagem, /aqui da Edienai/)
  assert.match(mensagem, /regularizar sua conta/)
  assert.match(mensagem, /se você já pagou, pode desconsiderar/)
})

test('resume somente o ciclo ainda em aberto depois de uma quitacao anterior', () => {
  const mensagem = montarMensagemCobrancaCrediario({
    clienteNome: 'Joao',
    saldoAtual: 15,
    movimentos: [
      { tipo: 'consumo', status: 'ativo', valor: 10, descricao: 'Pedido #1', realizado_em: '2026-06-01T12:00:00Z', itens: [{ nome: 'Pedido antigo', quantidade: 1 }] },
      { tipo: 'pagamento', status: 'ativo', valor: 10, descricao: 'Pagamento', realizado_em: '2026-06-02T12:00:00Z', itens: [] },
      { tipo: 'consumo', status: 'ativo', valor: 12, descricao: 'Pedido #2', realizado_em: '2026-07-01T12:00:00Z', itens: [{ nome: 'Pastel', quantidade: 2 }] },
      { tipo: 'consumo', status: 'ativo', valor: 8, descricao: 'Pedido #3', realizado_em: '2026-07-02T12:00:00Z', itens: [{ nome: 'Suco', quantidade: 1 }] },
      { tipo: 'pagamento', status: 'ativo', valor: 5, descricao: 'Pagamento parcial', realizado_em: '2026-07-03T12:00:00Z', itens: [] },
    ],
  })

  assert.doesNotMatch(mensagem, /Pedido antigo/)
  assert.match(mensagem, /2x Pastel/)
  assert.match(mensagem, /1x Suco/)
  assert.match(mensagem, /saldo total em aberto: R\$ 15,00/)
})

test('limita o resumo sem esconder que existem outras compras', () => {
  const movimentos = Array.from({ length: 5 }, (_, indice) => ({
    tipo: 'consumo',
    status: 'ativo',
    valor: 5,
    descricao: `Pedido #${indice + 1}`,
    realizado_em: `2026-07-${String(indice + 1).padStart(2, '0')}T12:00:00Z`,
    itens: [{ nome: `Item ${indice + 1}`, quantidade: 1 }],
  }))

  const mensagem = montarMensagemCobrancaCrediario({
    clienteNome: 'Ana',
    saldoAtual: 25,
    movimentos,
  })

  assert.match(mensagem, /e mais 2 compras anotadas/)
  assert.ok(mensagem.length < 900)
})

test('normaliza apenas telefones brasileiros validos para a Evolution', () => {
  assert.equal(normalizarTelefoneCobranca('(86) 98141-8723'), '5586981418723')
  assert.equal(normalizarTelefoneCobranca('5586981418723'), '5586981418723')
  assert.equal(normalizarTelefoneCobranca('123'), '')
})

test('aceita numero informado somente quando a conta ainda nao tem telefone valido', () => {
  assert.deepEqual(
    resolverTelefoneCobranca(null, '(86) 98141-8723'),
    { telefone: '5586981418723', deveCadastrar: true },
  )
  assert.deepEqual(
    resolverTelefoneCobranca('(86) 99999-0000', '(86) 98141-8723'),
    { telefone: '5586999990000', deveCadastrar: false },
  )
  assert.deepEqual(
    resolverTelefoneCobranca(null, '123'),
    { telefone: '', deveCadastrar: false },
  )
})
