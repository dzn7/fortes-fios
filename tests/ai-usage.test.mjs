import test from 'node:test'
import assert from 'node:assert/strict'

import { calcularCustoEstimadoIa } from '../src/lib/ai-usage.mjs'

test('calcula custo do DeepSeek V4 Flash separando cache, entrada e saida', () => {
  const custo = calcularCustoEstimadoIa({
    provedor: 'deepseek',
    modelo: 'deepseek-v4-flash',
    runtime: {
      prompt_tokens: 10_000,
      completion_tokens: 2_000,
      cache_hit_tokens: 6_000,
      cache_miss_tokens: 4_000,
    },
  })

  assert.equal(custo.disponivel, true)
  assert.equal(custo.tokensEntradaSemCache, 4_000)
  assert.equal(custo.tokensCache, 6_000)
  assert.equal(custo.tokensSaida, 2_000)
  assert.equal(custo.totalUsd, 0.0011368)
})

test('calcula custo do GPT-5 mini sem cobrar cache como entrada integral', () => {
  const custo = calcularCustoEstimadoIa({
    provedor: 'openai',
    modelo: 'gpt-5-mini',
    runtime: {
      prompt_tokens: 8_000,
      completion_tokens: 1_000,
      cache_hit_tokens: 3_000,
    },
  })

  assert.equal(custo.disponivel, true)
  assert.equal(custo.tokensEntradaSemCache, 5_000)
  assert.equal(custo.totalUsd, 0.003325)
})

test('nao inventa gasto para modelo sem tarifa cadastrada', () => {
  const custo = calcularCustoEstimadoIa({
    provedor: 'openai',
    modelo: 'modelo-futuro',
    runtime: { prompt_tokens: 1000, completion_tokens: 100 },
  })

  assert.equal(custo.disponivel, false)
  assert.equal(custo.totalUsd, null)
})
