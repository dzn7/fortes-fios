// Lápide do service worker do site.
//
// O site da Fortes Fios não usa mais service worker. Este arquivo existe só para
// desinstalar o worker que versões anteriores deixaram instalado no navegador de
// quem já visitou a loja.
//
// Por que o arquivo não foi simplesmente apagado: um service worker mora no
// aparelho da pessoa, não no servidor. Apagar `sw.js` não remove o que já está
// instalado — só destrói o único canal capaz de alcançá-lo, e aquele worker
// seguiria rodando indefinidamente. Manter esta URL respondendo é o que faz o
// worker antigo morrer.
//
// Como ela chega até lá: o registro anterior usava `updateViaCache: 'none'`,
// então o navegador busca este script na rede a cada verificação de atualização,
// e essa verificação acontece na navegação — sem depender de a página chamar
// `register()`. Na próxima visita o navegador encontra esta lápide.
//
// Quando não houver mais tráfego relevante de navegadores que ainda carregam o
// worker antigo, este arquivo pode ser removido de vez.

// `caches` é compartilhado pela origem. Admin, garçom e entregador têm os deles
// (`edienai-lanches-admin-*`, `-garcom-*`, `-entregador-*`) e não podem ser
// levados junto — o worker anterior levava, porque varria todo o prefixo
// `edienai-lanches-`.
const PREFIXOS_DE_CACHE_DO_SITE = ['fortes-fios-client-', 'edienai-lanches-client-']

const ehCacheDoSite = (nome) =>
  PREFIXOS_DE_CACHE_DO_SITE.some((prefixo) => nome.startsWith(prefixo))

self.addEventListener('install', () => {
  // Ativa sem esperar as abas fecharem: quanto antes ativar, antes some.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys()
      await Promise.all(nomes.filter(ehCacheDoSite).map((nome) => caches.delete(nome)))

      await self.registration.unregister()
    })(),
  )
})

// Deliberadamente ausentes:
//
// - `fetch`: sem handler, o navegador nem consulta o worker. É o que garante que
//   ele não tem como derrubar navegação nem requisição alguma enquanto não morre.
// - `clients.claim()` e `client.navigate()`: nada recarrega a página sozinho. As
//   abas abertas seguem como estão e a navegação seguinte já acontece sem worker.
// - `push` / `notificationclick`: o site nunca assinou push. Eram herança do
//   projeto de restaurante.
