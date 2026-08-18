# SPEC — Tópico único para canais do Supabase Realtime

> Status: corrigido e verificado com reprodução.
> Reportado pelo usuário com o console de produção: *"Encontrei o erro que
> quebra a pagina"*.

---

## 1. O erro

```
Uncaught Error: cannot add `postgres_changes` callbacks for
realtime:configuracoes-loja-1787062157414 after `subscribe()`.
```

Erro **não capturado**, lançado de dentro de um `useEffect`. Sem ninguém para
pegá-lo, o React desmonta a árvore e a home da loja deixa de renderizar.

## 2. Causa — duas peças, nenhuma delas óbvia

### 2.1 `channel()` não cria, reaproveita

Transcrito do bundle do `supabase-js` 2.112.2:

```js
channel(nome) {
  const topico = `realtime:${nome}`
  const existente = this.getChannels().find((c) => c.topic === topico)
  if (existente) return existente        // ← devolve o canal de OUTRA assinatura
  …
}
```

### 2.2 `.on()` recusa canal já assinado

```js
on(evento, ...) {
  const assinado = this.channelAdapter.isJoined() || this.channelAdapter.isJoining()
  if (assinado && evento === 'postgres_changes') throw Error('cannot add …')
}
```

### 2.3 O encontro das duas

`useStatusLoja` nomeava o canal assim:

```ts
supabase.channel(`configuracoes-loja-${Date.now()}`)
```

O sufixo parece garantir unicidade e **não garante**. O hook tem quatro
consumidores, e **três montam juntos na home do site**: `src/app/page.tsx`,
`src/components/Header.tsx` e `src/components/ModalCarrinho.tsx`. Os três
efeitos rodam no mesmo commit do React, logo `Date.now()` devolve o mesmo
número para os três.

Resultado: o segundo a chamar `.on()` recebe o canal do primeiro, já em
`joining`, e lança. **Não é corrida** — é determinístico, porque três efeitos do
mesmo commit sempre caem no mesmo milissegundo.

Explica também por que só o site do cliente quebrava: no admin há um único
consumidor (`ControleStatusLoja`).

## 3. Correção

`src/lib/canal-realtime.mjs` → `topicoUnico(prefixo)`, com **contador de
módulo**. Não depende da resolução do relógio: cada chamada devolve um número
diferente, ponto.

O prefixo continua na frente para o log do Supabase seguir dizendo de quem é o
canal.

### 3.1 Rede de segurança

A criação do canal passa a ficar em `try/catch`. Não é desculpa para o bug — é
a política certa para uma vitrine pública: as configurações já foram lidas por
`carregarConfiguracoes`, então sem realtime a loja apenas deixa de receber
atualização ao vivo. Derrubar a página inteira por causa de um canal é a troca
errada.

## 4. Prova

Modelo fiel das duas funções do `supabase-js`, três consumidores no mesmo
milissegundo:

```
ANTES  (configuracoes-loja-${Date.now()}):
  { quebrou: 'Header',
    mensagem: 'cannot add `postgres_changes` callbacks for
               realtime:configuracoes-loja-1787062416539 after `subscribe()`.' }

DEPOIS (topicoUnico):
  { quebrou: null, canais: 3 }
```

Mesma mensagem do console de produção, mesmo culpado: o segundo a montar.

## 5. Pendência conhecida

O padrão `` `algo-${Date.now()}` `` continua em **12 outros pontos**
(`useCaixa`, `useEntregador`, `usePagamentosEntregadores`, `ImpressoraContext`,
`dashboard`, `mesas`, `painel`, `salao`, `garcom`, `PainelAnotacoes`,
`ModalDetalhesPedido`, `caixa/saldos`).

Nenhum deles quebra hoje: foram conferidos um a um e **todos têm um único
consumidor montado por vez** — `useCaixa` aparenta ter dois, mas
`ModalAbrirCaixa` importa apenas um `type` de lá, não o hook. São armadilhas
latentes: basta um segundo consumidor aparecer para o erro voltar. Trocar os 12
por `topicoUnico` é tarefa própria (AGENTS §0.2.2: mesma edição em ≥3 arquivos
pede proposta antes).
