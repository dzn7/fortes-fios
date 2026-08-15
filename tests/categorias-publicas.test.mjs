import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAVE_ROTULO_CATEGORIA_TODOS,
  ROTULO_CATEGORIA_TODOS_PADRAO,
  normalizarRotuloCategoriaTodos,
} from '../src/lib/categorias-publicas.mjs'

test('filtro geral usa o nome padrão voltado a cabelos quando não há configuração', () => {
  assert.equal(
    normalizarRotuloCategoriaTodos(undefined),
    'Todos os tipos de cabelo',
  )
  assert.equal(ROTULO_CATEGORIA_TODOS_PADRAO, 'Todos os tipos de cabelo')
})

test('rótulo geral remove espaços externos e repetidos', () => {
  assert.equal(
    normalizarRotuloCategoriaTodos('  Todos   os fios  '),
    'Todos os fios',
  )
})

test('rótulo vazio retorna ao padrão', () => {
  assert.equal(normalizarRotuloCategoriaTodos('   '), ROTULO_CATEGORIA_TODOS_PADRAO)
})

test('rótulo configurado válido é preservado', () => {
  assert.equal(
    normalizarRotuloCategoriaTodos('Catálogo completo'),
    'Catálogo completo',
  )
})

test('configuração do filtro geral possui chave estável e separada das categorias', () => {
  assert.equal(CHAVE_ROTULO_CATEGORIA_TODOS, 'rotulo_categoria_todos')
})

