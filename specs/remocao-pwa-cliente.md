# Spec — Remoção do service worker do site (worker-lápide)

**Status:** implementada e validada
**Data:** 2026-08-16
**Sucede:** `specs/service-worker-navegacao-cliente.md`, que corrigiu o worker.
Esta spec o remove — a correção continua valendo para quem ainda não recebeu a lápide.

## Por que remover

Levantamento do que o worker do site entregava:

- **Cache de `/_next/static`** — redundante. Verificado no build servido: o Next responde
  `Cache-Control: public, max-age=31536000, immutable`, e os arquivos são versionados por
  hash. O cache HTTP do navegador já fazia isso, melhor.
- **Instalação** — não existe nenhum `beforeinstallprompt` no site. Ninguém é convidado a
  instalar.
- **Push** — não existe nenhum `pushManager` no cliente. Os `.subscribe()` do código são
  canais Realtime do Supabase. O handler `push` do worker era código morto herdado.
- **Navegar offline** — nunca funcionou: o catálogo vem do Supabase, que o worker nunca
  guardou. A página offline é de outro projeto ("Divina Pastelaria").

E cobrava um preço: `networkFirstWithTimeout` aborta em 3 s, o que derruba fonte e imagem
que teriam carregado numa conexão lenta de celular.

## Defeito adicional encontrado durante a remoção

O `activate` do worker do site apagava todo cache começando com `edienai-lanches-`. Os
workers do **admin**, **garçom** e **entregador** usam exatamente esse prefixo
(`edienai-lanches-admin-*`, `-garcom-*`, `-entregador-*`). Ou seja: o worker do site vinha
apagando o cache dos outros três a cada ativação. `caches` é compartilhado pela origem.

A lápide não pode repetir isso — ela apaga apenas os caches do site.

## Comportamento esperado

- `public/sw.js` continua existindo **na mesma URL**. É o único canal capaz de alcançar um
  worker já instalado no aparelho de quem visitou; apagar o arquivo deixaria esses workers
  rodando indefinidamente, sem controle remoto.
- A lápide **não registra handler de `fetch`**. Sem handler, o navegador nem consulta o
  worker: não há como ele derrubar navegação ou requisição alguma.
- `install` chama `skipWaiting()`, para ativar sem esperar as abas fecharem.
- `activate` apaga somente caches com prefixo `fortes-fios-client-` ou
  `edienai-lanches-client-`, e então chama `registration.unregister()`.
- Caches de admin, garçom e entregador permanecem intactos.
- **Nada recarrega a página.** Sem `clients.claim()` e sem `client.navigate()`: as abas
  abertas seguem como estão, e a navegação seguinte já acontece sem worker.
- O site deixa de registrar service worker: `<PWAManager />` sai do layout.
- `manifest.json` e `<ManifestManager />` permanecem — "adicionar à tela inicial" continua
  abrindo em tela cheia com o ícone certo, e isso não depende de service worker.

## Como a lápide alcança quem já tem o worker

O registro anterior usava `updateViaCache: 'none'`, então o navegador busca o script na
rede a cada verificação de atualização — e essa verificação acontece na navegação, sem
depender de a página chamar `register()`. Na próxima visita, o navegador encontra a lápide,
ela ativa e se desregistra.

## Testes de regressão

1. O worker não registra nenhum handler de `fetch`.
2. `install` chama `skipWaiting()`.
3. `activate` chama `registration.unregister()`.
4. `activate` apaga os caches do site (`fortes-fios-client-*` e `edienai-lanches-client-*`).
5. `activate` **não** apaga caches de admin, garçom e entregador.
6. O worker não chama `clients.claim()` nem navega abas — nenhum reload automático.

## Fora de escopo

- `sw-admin.js`, `sw-garcom.js`, `sw-entregador.js` e seus gerenciadores: continuam como
  estão, com o mesmo defeito de navegação descrito na spec anterior.
- `offline.html`, que deixa de ser usado pelo site mas permanece no repositório (o
  entregador tem o seu próprio, `offline-entregador.html`).
- Remover o `manifest.json` do site.
