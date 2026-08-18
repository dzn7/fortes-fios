import test from 'node:test'
import assert from 'node:assert/strict'

import { topicoUnico } from '../src/lib/canal-realtime.mjs'

/*
 * O defeito que este módulo existe para impedir:
 *
 *   supabase.channel(`configuracoes-loja-${Date.now()}`)
 *
 * `RealtimeClient.channel()` DEVOLVE o canal existente quando o tópico bate:
 *
 *   channel(e) { const n = `realtime:${e}`
 *                const r = this.getChannels().find(c => c.topic === n)
 *                if (r) return r ... }
 *
 * e `.on('postgres_changes', …)` num canal já `joining`/`joined` LANÇA. Como
 * três componentes do site (page, Header, ModalCarrinho) assinam no mesmo
 * commit do React, `Date.now()` devolve o mesmo número para os três — e o
 * segundo derruba a página inteira.
 */

test('duas chamadas seguidas nunca colidem', () => {
  assert.notEqual(topicoUnico('config'), topicoUnico('config'))
})

test('mil chamadas no mesmo milissegundo geram mil tópicos distintos', () => {
  const topicos = new Set()
  for (let i = 0; i < 1000; i += 1) topicos.add(topicoUnico('config'))
  assert.equal(topicos.size, 1000)
})

test('prefixos diferentes nunca se cruzam', () => {
  const a = new Set(Array.from({ length: 200 }, () => topicoUnico('pedidos')))
  const b = new Set(Array.from({ length: 200 }, () => topicoUnico('mesas')))
  for (const topico of a) assert.equal(b.has(topico), false)
})

test('o prefixo aparece no começo, para o tópico ser legível no log', () => {
  assert.match(topicoUnico('configuracoes-loja'), /^configuracoes-loja-/)
})

test('prefixo vazio ou inválido ainda produz tópico utilizável', () => {
  for (const lixo of ['', null, undefined, 0, {}]) {
    const topico = topicoUnico(lixo)
    assert.equal(typeof topico, 'string')
    assert.ok(topico.length > 0, `prefixo ${String(lixo)} gerou tópico vazio`)
  }
})

test('o tópico não tem espaço nem caractere que precise de escape', () => {
  assert.match(topicoUnico('configuracoes loja'), /^[a-z0-9:_-]+$/i)
})
