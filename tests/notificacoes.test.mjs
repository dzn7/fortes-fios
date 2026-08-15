import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HORAS_PEDIDO_URGENTE,
  LIMITE_MODAL,
  PRIORIDADES,
  TIPOS_NOTIFICACAO,
  agruparPorPrioridade,
  chaveDedupe,
  descreverNotificacaoEstoque,
  descreverNotificacaoPedido,
  estadoLeitura,
  notificacaoAbreModal,
  resumirNotificacoes,
  rotaDaNotificacao,
  selecionarNotificacoesDoModal,
} from '../src/lib/notificacoes.mjs'

const AGORA = new Date('2026-08-15T12:00:00.000Z')

const produto = (sobrescritas = {}) => ({
  id: 'produto-1',
  nome: 'Creme de Pentear 3 em 1 500ml',
  estoque_quantidade: 2,
  estoque_minimo: 5,
  bloquear_venda_sem_estoque: false,
  ...sobrescritas,
})

const pedido = (sobrescritas = {}) => ({
  id: 'pedido-1',
  numero_pedido: 123,
  nome_cliente: 'Maria',
  status: 'pendente',
  total: 189.9,
  created_at: '2026-08-15T11:00:00.000Z',
  ...sobrescritas,
})

const notificacao = (sobrescritas = {}) => ({
  id: 'notificacao-1',
  tipo: TIPOS_NOTIFICACAO.ESTOQUE_BAIXO,
  prioridade: PRIORIDADES.URGENTE,
  titulo: 'Estoque baixo',
  mensagem: 'Creme de Pentear 3 em 1 500ml possui apenas 2 unidades.',
  entidade_tipo: 'produto',
  entidade_id: 'produto-1',
  dados: {},
  estado: 'ativa',
  chave_dedupe: 'estoque_baixo:produto-1',
  criada_em: '2026-08-15T11:00:00.000Z',
  visualizada_em: null,
  lida_em: null,
  silenciada_em: null,
  ...sobrescritas,
})

// 1. produto que entra em estoque baixo produz descritor urgente
test('produto em estoque baixo gera descritor urgente com a quantidade na mensagem', () => {
  const descritor = descreverNotificacaoEstoque(produto())

  assert.equal(descritor.tipo, TIPOS_NOTIFICACAO.ESTOQUE_BAIXO)
  assert.equal(descritor.prioridade, PRIORIDADES.URGENTE)
  assert.equal(descritor.titulo, 'Estoque baixo')
  assert.equal(
    descritor.mensagem,
    'Creme de Pentear 3 em 1 500ml possui apenas 2 unidades.',
  )
  assert.equal(descritor.entidade_tipo, 'produto')
  assert.equal(descritor.entidade_id, 'produto-1')
  assert.deepEqual(descritor.dados, { quantidade: 2, minimo: 5 })
})

test('mensagem de estoque baixo concorda em número na última unidade', () => {
  const descritor = descreverNotificacaoEstoque(produto({ estoque_quantidade: 1 }))
  assert.equal(
    descritor.mensagem,
    'Creme de Pentear 3 em 1 500ml possui apenas 1 unidade.',
  )
})

// 2. produto esgotado gera esgotado urgente, e nunca os dois ao mesmo tempo
test('produto esgotado gera apenas o descritor de esgotado', () => {
  const descritor = descreverNotificacaoEstoque(
    produto({ nome: 'Fluido Liso Mágico Eico PRO 200ml', estoque_quantidade: 0 }),
  )

  assert.equal(descritor.tipo, TIPOS_NOTIFICACAO.ESTOQUE_ESGOTADO)
  assert.equal(descritor.prioridade, PRIORIDADES.URGENTE)
  assert.equal(descritor.titulo, 'Produto esgotado')
  assert.equal(descritor.mensagem, 'Fluido Liso Mágico Eico PRO 200ml está sem estoque.')
  assert.notEqual(descritor.tipo, TIPOS_NOTIFICACAO.ESTOQUE_BAIXO)
})

// 3. produto acima do mínimo não notifica
test('produto acima do estoque mínimo não gera notificação', () => {
  assert.equal(descreverNotificacaoEstoque(produto({ estoque_quantidade: 20 })), null)
})

// 4. o limite exato conta como baixo
test('quantidade exatamente igual ao mínimo já é estoque baixo', () => {
  const descritor = descreverNotificacaoEstoque(
    produto({ estoque_quantidade: 5, estoque_minimo: 5 }),
  )
  assert.equal(descritor.tipo, TIPOS_NOTIFICACAO.ESTOQUE_BAIXO)

  assert.equal(
    descreverNotificacaoEstoque(produto({ estoque_quantidade: 6, estoque_minimo: 5 })),
    null,
  )
})

// 5. chave de deduplicação estável por condição e distinta por tipo
test('chave de deduplicação é estável por condição e distinta entre tipos', () => {
  assert.equal(
    chaveDedupe(TIPOS_NOTIFICACAO.ESTOQUE_BAIXO, 'produto-1'),
    'estoque_baixo:produto-1',
  )

  const baixoAgora = descreverNotificacaoEstoque(produto({ estoque_quantidade: 2 }))
  const baixoDepois = descreverNotificacaoEstoque(produto({ estoque_quantidade: 1 }))
  assert.equal(baixoAgora.chave_dedupe, baixoDepois.chave_dedupe)

  const esgotado = descreverNotificacaoEstoque(produto({ estoque_quantidade: 0 }))
  assert.notEqual(baixoAgora.chave_dedupe, esgotado.chave_dedupe)
})

// 6. pedido aguardando atendimento é normal, não urgente
test('pedido recém-criado gera notificação normal, não urgente', () => {
  const descritor = descreverNotificacaoPedido(pedido(), AGORA)

  assert.equal(descritor.tipo, TIPOS_NOTIFICACAO.PEDIDO_NOVO)
  assert.equal(descritor.prioridade, PRIORIDADES.NORMAL)
  assert.equal(descritor.titulo, 'Pedido novo')
  assert.equal(descritor.mensagem, 'Pedido #123 de Maria aguarda atendimento.')
  assert.equal(descritor.entidade_tipo, 'pedido')
  assert.equal(descritor.entidade_id, 'pedido-1')
})

test('pedido aguardando pagamento também aguarda atendimento', () => {
  const descritor = descreverNotificacaoPedido(
    pedido({ status: 'aguardando_pagamento' }),
    AGORA,
  )
  assert.equal(descritor.tipo, TIPOS_NOTIFICACAO.PEDIDO_NOVO)
})

// 7. pedido parado escala de prioridade sem trocar de chave
test('pedido parado além do limite escala para urgente mantendo a mesma chave', () => {
  const recente = descreverNotificacaoPedido(pedido(), AGORA)
  const parado = descreverNotificacaoPedido(
    pedido({ created_at: '2026-08-14T20:00:00.000Z' }),
    AGORA,
  )

  assert.equal(HORAS_PEDIDO_URGENTE, 12)
  assert.equal(parado.prioridade, PRIORIDADES.URGENTE)
  assert.equal(parado.titulo, 'Pedido parado')
  assert.equal(parado.mensagem, 'Pedido #123 de Maria está há 16 horas sem atendimento.')
  assert.equal(parado.chave_dedupe, recente.chave_dedupe)
})

// 8. pedido já atendido ou cancelado não notifica
test('pedido em status avançado ou cancelado não gera notificação', () => {
  for (const status of ['confirmado', 'preparando', 'pronto', 'saiu_para_entrega', 'entregue', 'cancelado']) {
    assert.equal(
      descreverNotificacaoPedido(pedido({ status }), AGORA),
      null,
      `status ${status} não deveria notificar`,
    )
  }
})

// 9. estado de leitura derivado
test('estado de leitura deriva de visualizada e lida, nesta ordem', () => {
  assert.equal(estadoLeitura(notificacao()), 'nova')
  assert.equal(
    estadoLeitura(notificacao({ visualizada_em: '2026-08-15T11:30:00.000Z' })),
    'visualizada',
  )
  assert.equal(
    estadoLeitura(
      notificacao({
        visualizada_em: '2026-08-15T11:30:00.000Z',
        lida_em: '2026-08-15T11:40:00.000Z',
      }),
    ),
    'lida',
  )
})

// 10. só entra no modal o que está ativo, não visto e não silenciado
test('modal recebe apenas notificação ativa, não visualizada, não lida e não silenciada', () => {
  assert.equal(notificacaoAbreModal(notificacao()), true)
  assert.equal(notificacaoAbreModal(notificacao({ estado: 'resolvida' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ visualizada_em: '2026-08-15T11:30:00.000Z' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ lida_em: '2026-08-15T11:30:00.000Z' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ silenciada_em: '2026-08-15T11:30:00.000Z' })), false)
})

// 11. seleção do modal: urgentes primeiro, respeitando o limite
test('modal ordena urgentes primeiro, depois mais recentes, e respeita o limite', () => {
  const lista = [
    notificacao({ id: 'n1', prioridade: PRIORIDADES.NORMAL, criada_em: '2026-08-15T11:50:00.000Z' }),
    notificacao({ id: 'n2', prioridade: PRIORIDADES.URGENTE, criada_em: '2026-08-15T10:00:00.000Z' }),
    notificacao({ id: 'n3', prioridade: PRIORIDADES.URGENTE, criada_em: '2026-08-15T11:00:00.000Z' }),
    notificacao({ id: 'n4', prioridade: PRIORIDADES.NORMAL, criada_em: '2026-08-15T09:00:00.000Z' }),
    notificacao({ id: 'n5', prioridade: PRIORIDADES.URGENTE, silenciada_em: '2026-08-15T09:00:00.000Z' }),
  ]

  assert.equal(LIMITE_MODAL, 3)
  assert.deepEqual(
    selecionarNotificacoesDoModal(lista).map((item) => item.id),
    ['n3', 'n2', 'n1'],
  )
  assert.deepEqual(
    selecionarNotificacoesDoModal(lista, 2).map((item) => item.id),
    ['n3', 'n2'],
  )
})

// 12. agrupamento por prioridade
test('agrupamento separa urgentes de normais preservando a ordem recebida', () => {
  const lista = [
    notificacao({ id: 'n1', prioridade: PRIORIDADES.NORMAL }),
    notificacao({ id: 'n2', prioridade: PRIORIDADES.URGENTE }),
    notificacao({ id: 'n3', prioridade: PRIORIDADES.NORMAL }),
  ]

  const { urgentes, normais } = agruparPorPrioridade(lista)
  assert.deepEqual(urgentes.map((item) => item.id), ['n2'])
  assert.deepEqual(normais.map((item) => item.id), ['n1', 'n3'])
})

// 13. resumo para o badge
test('resumo conta urgentes, normais e não lidas apenas entre as ativas', () => {
  const lista = [
    notificacao({ id: 'n1', prioridade: PRIORIDADES.URGENTE }),
    notificacao({ id: 'n2', prioridade: PRIORIDADES.NORMAL, lida_em: '2026-08-15T11:00:00.000Z' }),
    notificacao({ id: 'n3', prioridade: PRIORIDADES.NORMAL }),
    notificacao({ id: 'n4', prioridade: PRIORIDADES.URGENTE, estado: 'resolvida' }),
  ]

  assert.deepEqual(resumirNotificacoes(lista), {
    urgentes: 1,
    normais: 2,
    naoLidas: 2,
    total: 3,
  })
})

// 14. rota de contexto
test('rota de contexto aponta para o produto e para o pedido', () => {
  assert.equal(
    rotaDaNotificacao(notificacao({ entidade_tipo: 'produto', entidade_id: 'produto-1' })),
    '/admin/estoque?produto=produto-1',
  )
  assert.equal(
    rotaDaNotificacao(notificacao({ entidade_tipo: 'pedido', entidade_id: 'pedido-1' })),
    '/admin/pedidos/pedido-1',
  )
  assert.equal(rotaDaNotificacao(notificacao({ entidade_tipo: null, entidade_id: null })), null)
})
