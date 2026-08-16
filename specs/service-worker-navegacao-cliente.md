# Spec — Service worker do site não pode reprovar a navegação

**Status:** implementada e validada
**Data:** 2026-08-16

## Sintoma relatado

Ao entrar no site, recarregar, ou voltar ao navegador que ficou aberto, o Chrome no
Android mostra a própria tela de erro ("This page couldn't load. Reload to try again,
or go back."). Apertar *Reload* resolve. O comportamento é intermitente.

A tela é do navegador, não do app: o documento nunca chegou a ser renderizado. Logo o
que falhou foi a **requisição de navegação**, antes de qualquer código de página rodar.

## Evidência coletada

1. Build de produção servido localmente e aberto sem service worker (origem LAN, contexto
   inseguro → `'serviceWorker' in navigator === false`, `PWAManager` retorna cedo):
   a página carrega íntegra, título correto, **zero erros de console**.
   Isso isola o service worker como o componente que diferencia os dois cenários.
2. `public/sw.js` intercepta **toda** navegação:
   `if (request.mode === 'navigate') return event.respondWith(networkNavigation(request))`.
3. `networkNavigation` devolve `Response.error()` quando o `fetch` falha e `/offline.html`
   não está no cache. Uma `Response.error()` entregue a `respondWith` **é** a falha de
   navegação que o Chrome desenha como "This page couldn't load".
4. `install` chama `skipWaiting()` e `activate` chama `clients.claim()`. `clients.claim()`
   dispara `controllerchange` numa página que carregou **sem** controlador.
5. `PWAManager` responde a `controllerchange` com `window.location.reload()` após 100 ms —
   ou seja, recarrega a página no meio do carregamento inicial, e essa recarga já passa
   pelo worker recém-ativado.

## Causa raiz

Duas decisões somadas transformam qualquer soluço de rede numa falha dura de documento:

- **O worker assume a navegação sem precisar.** Ele não guarda HTML (e não deve — UI.md),
  então interceptar não traz benefício nenhum; traz só um caminho a mais para falhar.
  Sem worker, o próprio navegador serve o documento do cache HTTP/bfcache e, se falhar,
  mostra um erro *reaproveitável*. Com worker, o erro vira `Response.error()` definitivo.
- **A página se recarrega sozinha assim que o worker a reivindica.** Na primeira visita
  (e a cada versão nova do worker) há uma recarga automática, disparada durante o
  carregamento, atendida por um worker que acabou de ativar. É a corrida que explica o
  "na entrada falha, no reload manual funciona": o reload manual acontece já com o worker
  estável e com o `sessionStorage` suprimindo novo registro.

## Comportamento esperado

- O `fetch` do service worker **nunca** chama `respondWith` para `request.mode === 'navigate'`,
  em nenhum caminho, nem com a rede caída. O documento é sempre assunto do navegador.
- O service worker nunca produz `Response.error()`, nem `undefined`, para uma navegação.
- Payloads RSC (`RSC: 1`, `_rsc`, `/_next/data`) continuam indo direto à rede, sem cache.
- `/_next/static` continua servido por cache-first (é imutável e versionado por hash).
- O worker não chama `clients.claim()`: uma página que carregou sem controlador termina
  sem controlador, e por isso não sofre `controllerchange` durante o carregamento.
- Nenhum reload é disparado por código. A troca de controlador apenas **oferece** a
  atualização no banner que já existe; o reload só acontece quando a pessoa clica.

## Decisões que revertem escolhas anteriores (registradas)

- `Progress.md` (SW admin `v4.3.5`) registrou "recarrega uma única vez na troca de
  controller" como acerto. **Está revertido aqui para o site**: recarregar sozinho durante
  o carregamento é justamente a corrida que derruba a navegação.
- `Progress.md` registrou "a navegação usa rede com fallback apenas para a página offline".
  **O fallback de navegação sai.** Consequência aceita: sem rede, quem aparece é a tela
  offline do próprio Chrome, não `/offline.html`. O arquivo continua no repositório e no
  cache; ele hoje está com a identidade de outro projeto ("Divina Pastelaria"), então
  deixar de exibi-lo não é perda.
- A regra de UI.md "nunca armazenar HTML nem payload RSC no service worker" continua
  valendo — não interceptar é a forma mais forte de cumpri-la.

## Testes de regressão

1. Navegação comum não é interceptada (`respondWith` não é chamado).
2. Navegação com a rede caída também não é interceptada.
3. Nenhuma resposta do handler é `Response.error()` ou `undefined` para navegação.
4. Requisição RSC vai à rede e não é cacheada.
5. `/_next/static` continua sendo servido pelo worker (cache-first preservado).
6. `/admin` continua ignorado pelo worker do cliente.
7. `activate` não chama `clients.claim()`.
8. A decisão de atualização nunca resulta em reload automático; só com pedido da pessoa.

## Fora de escopo

- `sw-admin.js`, `sw-garcom.js`, `sw-entregador.js` e seus gerenciadores, que têm o mesmo
  defeito de navegação (e, no caso de garçom/entregador, um `respondWith(undefined)`
  possível quando `/offline.html` não está no cache). Mesma edição em ≥3 arquivos exige
  proposta antes (AGENTS §0.2.2) — proposto, não alterado.
- Reescrever ou rebrandar `/offline.html`.
- Remover o service worker do site, que é a pergunta maior por trás deste bug.
