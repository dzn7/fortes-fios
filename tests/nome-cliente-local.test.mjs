import test from 'node:test'
import assert from 'node:assert/strict'

import {
  nomeClienteParaPedido,
  nomeClienteParaPontoSalao,
  nomeClientePessoalValido
} from '../src/lib/nome-cliente-local.mjs'

test('local parceiro nao vira nome do cliente', () => {
  assert.equal(nomeClientePessoalValido('Marcelo', { localParceiro: true }), false)
  assert.equal(nomeClienteParaPedido({ nomeCliente: 'Marcelo', tipoEntrega: 'local', localParceiro: true }), 'Cliente')
  assert.equal(nomeClienteParaPontoSalao({ nomeCliente: 'Marcelo', localParceiro: true }), null)
})

test('mesa e comanda nao viram nome de cliente', () => {
  assert.equal(nomeClientePessoalValido('Mesa 2'), false)
  assert.equal(nomeClientePessoalValido('Comanda 17'), false)
  assert.equal(nomeClienteParaPedido({ nomeCliente: 'Mesa 2', tipoEntrega: 'local' }), 'Cliente')
  assert.equal(nomeClienteParaPedido({ nomeCliente: 'Mesa 2', tipoEntrega: 'retirada' }), 'Cliente')
})

test('nome pessoal continua sendo usado', () => {
  assert.equal(nomeClientePessoalValido('Vivian Filha Da Nozinha'), true)
  assert.equal(nomeClienteParaPedido({ nomeCliente: 'Vivian Filha Da Nozinha', tipoEntrega: 'local' }), 'Vivian Filha Da Nozinha')
  assert.equal(nomeClienteParaPontoSalao({ nomeCliente: 'Vivian', localParceiro: false }), 'Vivian')
})
