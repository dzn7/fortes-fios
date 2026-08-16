import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

/**
 * O service worker do site é script clássico e roda num escopo que o Node não
 * tem. Em vez de simular o comportamento (o que testaria a simulação, não o
 * worker), o arquivo real é avaliado num contexto `vm` com o mínimo de globais
 * que ele usa. Assim o teste falha se `public/sw.js` mudar de ideia.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEM = 'https://fortesfios.exemplo'
const CODIGO_DO_WORKER = readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8')

const chaveDoCache = (requisicao) =>
  typeof requisicao === 'string' ? new URL(requisicao, ORIGEM).toString() : requisicao.url

const montarWorker = ({ aoBuscar, itensNoCache = new Map() } = {}) => {
  const ouvintes = new Map()
  const espiao = { reivindicou: false, buscas: [], gravacoes: [] }

  const cache = {
    addAll: async () => {},
    put: async (requisicao) => {
      espiao.gravacoes.push(chaveDoCache(requisicao))
    },
    delete: async () => true,
    match: async (requisicao) => itensNoCache.get(chaveDoCache(requisicao)),
  }

  const escopo = {
    location: new URL(`${ORIGEM}/sw.js`),
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async (requisicao) => itensNoCache.get(chaveDoCache(requisicao)),
    },
    clients: {
      claim: async () => {
        espiao.reivindicou = true
      },
      matchAll: async () => [],
    },
    fetch: async (requisicao) => {
      espiao.buscas.push(chaveDoCache(requisicao))
      if (aoBuscar) return aoBuscar(requisicao)
      return new Response('conteudo', { status: 200 })
    },
    Response,
    Headers,
    URL,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
  }

  escopo.self = escopo
  escopo.addEventListener = (tipo, ouvinte) => {
    if (!ouvintes.has(tipo)) ouvintes.set(tipo, [])
    ouvintes.get(tipo).push(ouvinte)
  }

  vm.createContext(escopo)
  vm.runInContext(CODIGO_DO_WORKER, escopo)

  const disparar = (tipo, evento) => {
    for (const ouvinte of ouvintes.get(tipo) ?? []) ouvinte(evento)
  }

  return { disparar, espiao, ouvintes }
}

const criarRequisicao = (caminho, { mode = 'no-cors', method = 'GET', headers = {} } = {}) => ({
  url: new URL(caminho, ORIGEM).toString(),
  method,
  mode,
  headers: new Headers(headers),
})

const dispararFetch = (worker, requisicao) => {
  const registro = { respondeu: false, valor: undefined }
  worker.disparar('fetch', {
    request: requisicao,
    respondWith(valor) {
      registro.respondeu = true
      registro.valor = valor
    },
    waitUntil() {},
  })
  return registro
}

// `/api/...` entra na lista de propósito: aquele ramo respondia com `fetch`
// antes da checagem de navegação, e uma rejeição ali também derruba o documento.
const CAMINHOS_DE_NAVEGACAO = ['/', '/contato', '/qualquer-coisa', '/api/qualquer']

// 1. O núcleo do bug: o documento é assunto do navegador, nunca do worker.
test('navegação normal não é interceptada pelo service worker', () => {
  const worker = montarWorker()

  for (const caminho of CAMINHOS_DE_NAVEGACAO) {
    const registro = dispararFetch(worker, criarRequisicao(caminho, { mode: 'navigate' }))
    assert.equal(registro.respondeu, false, `${caminho} foi interceptada`)
  }
})

// 2. É com a rede caída que o worker transformava soluço em falha definitiva.
test('navegação com a rede caída também não é interceptada', () => {
  const worker = montarWorker({
    aoBuscar: async () => {
      throw new TypeError('Failed to fetch')
    },
  })

  for (const caminho of CAMINHOS_DE_NAVEGACAO) {
    const registro = dispararFetch(worker, criarRequisicao(caminho, { mode: 'navigate' }))
    assert.equal(registro.respondeu, false, `${caminho} foi interceptada sem rede`)
  }
})

// 3. A tela "This page couldn't load" é exatamente uma Response.error() entregue
//    a respondWith. Nenhum caminho pode produzi-la — nem `undefined`.
test('nenhuma navegação recebe Response.error() nem undefined', async () => {
  const worker = montarWorker({
    aoBuscar: async () => {
      throw new TypeError('Failed to fetch')
    },
    itensNoCache: new Map(),
  })

  const registro = dispararFetch(worker, criarRequisicao('/', { mode: 'navigate' }))

  if (registro.respondeu) {
    const resposta = await registro.valor
    assert.notEqual(resposta, undefined, 'respondWith recebeu undefined')
    assert.notEqual(resposta?.type, 'error', 'respondWith recebeu Response.error()')
  }

  assert.equal(registro.respondeu, false)
})

// 4. Reivindicar uma página que carregou sem controlador é o que dispara o
//    controllerchange no meio do carregamento.
test('activate não reivindica páginas já carregadas', async () => {
  const worker = montarWorker()
  const pendentes = []

  worker.disparar('activate', {
    waitUntil: (promessa) => pendentes.push(promessa),
  })
  await Promise.all(pendentes)

  assert.equal(worker.espiao.reivindicou, false)
})

// 5. Regressões do que o worker deve continuar fazendo (UI.md §service worker).
test('payload RSC vai à rede e não entra no cache', async () => {
  const worker = montarWorker()

  const registro = dispararFetch(worker, criarRequisicao('/?_rsc=abc123'))
  assert.equal(registro.respondeu, true, 'RSC deveria ser atendido pelo worker')

  await registro.valor
  assert.deepEqual(worker.espiao.gravacoes, [], 'RSC não pode ser gravado em cache')
})

test('requisição com header RSC também vai à rede sem cache', async () => {
  const worker = montarWorker()

  const registro = dispararFetch(worker, criarRequisicao('/contato', { headers: { RSC: '1' } }))
  assert.equal(registro.respondeu, true)

  await registro.valor
  assert.deepEqual(worker.espiao.gravacoes, [])
})

test('estático do Next continua servido pelo worker', async () => {
  const worker = montarWorker()

  const registro = dispararFetch(worker, criarRequisicao('/_next/static/chunks/main-abc.js'))
  assert.equal(registro.respondeu, true, 'o worker deve continuar cacheando estático')

  await registro.valor
  assert.ok(worker.espiao.buscas.some((url) => url.includes('/_next/static/')))
})

test('rota do admin é ignorada pelo worker do cliente', () => {
  const worker = montarWorker()

  const navegacao = dispararFetch(worker, criarRequisicao('/admin/pedidos', { mode: 'navigate' }))
  const recurso = dispararFetch(worker, criarRequisicao('/admin/algum-dado.json'))

  assert.equal(navegacao.respondeu, false)
  assert.equal(recurso.respondeu, false)
})
