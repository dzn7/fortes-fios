import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FOLLOWUPS_CLIENTE,
  NUMERO_WHATSAPP_PADRAO,
  linkWhatsApp,
  mensagemPedidoParaLoja,
  montarFollowUp,
  normalizarNumeroWhatsApp,
  primeiroNome,
} from '../src/lib/whatsapp.mjs'

const pedido = (sobrescritas = {}) => ({
  numeroPedido: 42,
  nomeCliente: 'Derick Mackenzie',
  telefone: '(63) 98105-3014',
  tipoEntrega: 'retirada',
  formaPagamento: 'PIX',
  total: 75,
  itens: [
    { nome: 'Creme de Pentear 3 em 1 500ml', quantidade: 2, subtotal: 50 },
    { nome: 'Óleo Nutritivo Ox Nutre 120ml', quantidade: 1, subtotal: 25 },
  ],
  ...sobrescritas,
})

// 1. normalização do número
test('número vira formato internacional sem símbolo', () => {
  assert.equal(normalizarNumeroWhatsApp('(63) 98105-3014'), '5563981053014')
  assert.equal(normalizarNumeroWhatsApp('63 98105 3014'), '5563981053014')
  assert.equal(normalizarNumeroWhatsApp('5563981053014'), '5563981053014')
  assert.equal(normalizarNumeroWhatsApp('+55 (63) 98105-3014'), '5563981053014')
})

// 2. entrada inválida não vira link quebrado
test('número inválido devolve null em vez de link torto', () => {
  assert.equal(normalizarNumeroWhatsApp(''), null)
  assert.equal(normalizarNumeroWhatsApp('123'), null)
  assert.equal(normalizarNumeroWhatsApp(null), null)
  assert.equal(normalizarNumeroWhatsApp('abc'), null)
})

// 2.1 o botão de contato não some por falta de configuração
test('número ausente ou inválido cai no WhatsApp oficial da loja', () => {
  for (const entrada of ['', '123', null, undefined]) {
    const url = linkWhatsApp(entrada, 'oi')
    assert.ok(url, `entrada ${JSON.stringify(entrada)} deveria cair no padrão`)
    assert.ok(url.includes(NUMERO_WHATSAPP_PADRAO))
  }
})

test('número configurado vence o padrão', () => {
  const url = linkWhatsApp('(63) 98105-3014', 'oi')
  assert.ok(url.includes('5563981053014'))
  assert.ok(!url.includes(NUMERO_WHATSAPP_PADRAO))
})

// 3. o link usa api.whatsapp.com — o que sobrevive ao Safari iOS
test('link vai para api.whatsapp.com com texto codificado', () => {
  const url = linkWhatsApp('(63) 98105-3014', 'Olá, tudo bem?')

  assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=5563981053014'))
  assert.ok(url.includes('text=Ol%C3%A1%2C%20tudo%20bem%3F'))
  // quebra de linha precisa sobreviver à codificação
  assert.ok(linkWhatsApp('(63) 98105-3014', 'linha 1\nlinha 2').includes('%0A'))
})

// 4. primeiro nome
test('primeiro nome é o que vai na saudação', () => {
  assert.equal(primeiroNome('Derick Mackenzie'), 'Derick')
  assert.equal(primeiroNome('  maria  '), 'maria')
  assert.equal(primeiroNome(''), 'cliente')
  assert.equal(primeiroNome(null), 'cliente')
})

// 5. os follow-ups do cliente
test('existem três follow-ups, cada um com id, rótulo e texto', () => {
  assert.equal(FOLLOWUPS_CLIENTE.length, 3)

  for (const followup of FOLLOWUPS_CLIENTE) {
    assert.ok(followup.id)
    assert.ok(followup.rotulo)
    assert.ok(followup.descricao)

    const texto = montarFollowUp(followup.id, { nome: 'Derick Mackenzie' })
    assert.ok(texto.includes('Derick'), `${followup.id} não personaliza o nome`)
    assert.ok(texto.length > 20)
  }
})

test('follow-up desconhecido devolve null', () => {
  assert.equal(montarFollowUp('inexistente', { nome: 'Ana' }), null)
})

// 6. a mensagem do pedido: retirada
test('pedido de retirada lista itens, pagamento e total sem seção de entrega', () => {
  const texto = mensagemPedidoParaLoja(pedido())

  assert.ok(texto.includes('#42'))
  assert.ok(texto.includes('Derick Mackenzie'))
  assert.ok(texto.includes('Retirada'))
  assert.ok(texto.includes('PIX'))
  assert.ok(texto.includes('2x Creme de Pentear 3 em 1 500ml'))
  assert.ok(texto.includes('1x Óleo Nutritivo Ox Nutre 120ml'))
  assert.ok(texto.includes('3 itens'))
  assert.ok(texto.includes('R$ 75,00'))
  assert.ok(!texto.includes('Entrega em'), 'retirada não deve trazer endereço')
})

// 7. entrega traz os dados de entrega
test('pedido de entrega inclui endereço, bairro, referência e taxa', () => {
  const texto = mensagemPedidoParaLoja(
    pedido({
      tipoEntrega: 'entrega',
      endereco: 'Rua das Flores, 120',
      bairro: 'Centro',
      cidade: 'Gurupi',
      pontoReferencia: 'Perto da praça',
      taxaEntrega: 8,
      total: 83,
    }),
  )

  assert.ok(texto.includes('Entrega'))
  assert.ok(texto.includes('Rua das Flores, 120'))
  assert.ok(texto.includes('Centro'))
  assert.ok(texto.includes('Gurupi'))
  assert.ok(texto.includes('Perto da praça'))
  assert.ok(texto.includes('R$ 8,00'))
  assert.ok(texto.includes('R$ 83,00'))
})

// 8. observações e troco só aparecem quando existem
test('observações e troco entram apenas quando informados', () => {
  const semExtras = mensagemPedidoParaLoja(pedido())
  assert.ok(!semExtras.includes('Observações'))
  assert.ok(!semExtras.includes('Troco'))

  const comExtras = mensagemPedidoParaLoja(
    pedido({
      observacoes: 'Sem sacola, por favor',
      formaPagamento: 'Dinheiro',
      trocoPara: 100,
    }),
  )
  assert.ok(comExtras.includes('Observações'))
  assert.ok(comExtras.includes('Sem sacola, por favor'))
  assert.ok(comExtras.includes('Troco para'))
  assert.ok(comExtras.includes('R$ 100,00'))
})

// 9. quantidade de itens conta unidades, não linhas
test('a contagem soma quantidades, não linhas do carrinho', () => {
  const texto = mensagemPedidoParaLoja(
    pedido({ itens: [{ nome: 'A', quantidade: 5, subtotal: 10 }] }),
  )
  assert.ok(texto.includes('5 itens'))

  const umItem = mensagemPedidoParaLoja(
    pedido({ itens: [{ nome: 'A', quantidade: 1, subtotal: 10 }] }),
  )
  assert.ok(umItem.includes('1 item'), 'singular precisa concordar')
})

// 10. pedido sem itens não quebra
test('pedido sem itens ainda gera mensagem válida', () => {
  const texto = mensagemPedidoParaLoja(pedido({ itens: [] }))
  assert.ok(texto.includes('#42'))
  assert.ok(typeof texto === 'string' && texto.length > 0)
})
