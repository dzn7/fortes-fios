import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

/**
 * O site não usa mais service worker. `public/sw.js` virou uma lápide: existe só
 * para desinstalar o worker que versões anteriores deixaram no aparelho de quem
 * já visitou a loja.
 *
 * O arquivo real é avaliado num contexto `vm` — não uma simulação dele — para
 * que o teste falhe se a lápide voltar a fazer qualquer coisa.
 */
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CODIGO_DO_WORKER = readFileSync(path.join(RAIZ, 'public/sw.js'), 'utf8')

const CACHES_DO_SITE = [
  'fortes-fios-client-client-v3.0.0',
  'fortes-fios-client-client-v2.10.12',
  'edienai-lanches-client-v1',
]

// `caches` é compartilhado pela origem — estes três não são do site e precisam
// sobreviver. O worker anterior apagava todos: eles começam com o mesmo prefixo
// que ele varria.
const CACHES_DE_OUTROS_PERFIS = [
  'edienai-lanches-admin-admin-v4.3.5',
  'edienai-lanches-garcom-garcom-v1.5.0',
  'edienai-lanches-entregador-entregador-v2.8.2',
]

const montarWorker = ({ cachesExistentes = [...CACHES_DO_SITE, ...CACHES_DE_OUTROS_PERFIS] } = {}) => {
  const ouvintes = new Map()
  const espiao = {
    pulouEspera: false,
    desregistrou: false,
    reivindicou: false,
    cachesApagados: [],
    abasNavegadas: [],
  }

  const escopo = {
    location: new URL('https://fortesfios.exemplo/sw.js'),
    caches: {
      keys: async () => [...cachesExistentes],
      delete: async (nome) => {
        espiao.cachesApagados.push(nome)
        return true
      },
      open: async () => ({ addAll: async () => {}, put: async () => {}, match: async () => undefined }),
      match: async () => undefined,
    },
    clients: {
      claim: async () => {
        espiao.reivindicou = true
      },
      matchAll: async () => [
        {
          url: 'https://fortesfios.exemplo/',
          navigate(destino) {
            espiao.abasNavegadas.push(destino)
          },
        },
      ],
    },
    fetch: async () => new Response('conteudo', { status: 200 }),
    Response,
    Headers,
    URL,
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
  }

  escopo.self = escopo
  escopo.skipWaiting = () => {
    espiao.pulouEspera = true
  }
  escopo.registration = {
    unregister: async () => {
      espiao.desregistrou = true
      return true
    },
  }
  escopo.addEventListener = (tipo, ouvinte) => {
    if (!ouvintes.has(tipo)) ouvintes.set(tipo, [])
    ouvintes.get(tipo).push(ouvinte)
  }

  vm.createContext(escopo)
  vm.runInContext(CODIGO_DO_WORKER, escopo)

  const disparar = async (tipo) => {
    const pendentes = []
    for (const ouvinte of ouvintes.get(tipo) ?? []) {
      ouvinte({ waitUntil: (promessa) => pendentes.push(promessa) })
    }
    await Promise.all(pendentes)
  }

  return { disparar, espiao, ouvintes }
}

// 1. A garantia mais forte: sem handler de fetch, o navegador nem consulta o
//    worker. Ele não tem como derrubar navegação nem requisição nenhuma.
test('a lápide não registra nenhum handler de fetch', () => {
  const { ouvintes } = montarWorker()
  assert.equal(ouvintes.has('fetch'), false, 'a lápide ainda intercepta requisição')
})

test('a lápide não registra push nem notificationclick', () => {
  const { ouvintes } = montarWorker()
  assert.equal(ouvintes.has('push'), false)
  assert.equal(ouvintes.has('notificationclick'), false)
})

// 2. Ativa sem esperar as abas fecharem — quanto antes ativar, antes some.
test('install ativa sem esperar', async () => {
  const worker = montarWorker()
  await worker.disparar('install')

  assert.equal(worker.espiao.pulouEspera, true)
})

// 3. O ponto da lápide: sumir.
test('activate desregistra o próprio worker', async () => {
  const worker = montarWorker()
  await worker.disparar('activate')

  assert.equal(worker.espiao.desregistrou, true)
})

test('activate apaga os caches do site', async () => {
  const worker = montarWorker()
  await worker.disparar('activate')

  for (const nome of CACHES_DO_SITE) {
    assert.ok(worker.espiao.cachesApagados.includes(nome), `${nome} não foi apagado`)
  }
})

// 4. O defeito que o worker anterior tinha: levava junto o cache dos outros.
test('activate não toca nos caches de admin, garçom e entregador', async () => {
  const worker = montarWorker()
  await worker.disparar('activate')

  for (const nome of CACHES_DE_OUTROS_PERFIS) {
    assert.ok(
      !worker.espiao.cachesApagados.includes(nome),
      `${nome} foi apagado e não pertence ao site`,
    )
  }
})

// 5. Nada recarrega a página sozinho — nem por claim, nem navegando abas.
test('a lápide não reivindica nem recarrega abas abertas', async () => {
  const worker = montarWorker()
  await worker.disparar('install')
  await worker.disparar('activate')

  assert.equal(worker.espiao.reivindicou, false, 'a lápide reivindicou abas')
  assert.deepEqual(worker.espiao.abasNavegadas, [], 'a lápide recarregou abas')
})
