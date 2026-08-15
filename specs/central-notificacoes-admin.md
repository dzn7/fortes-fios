# Spec — Central de Notificações do Admin

**Status:** proposta para implementação
**Data:** 2026-08-15
**Escopo:** projeto Fortes Fios, sem tenant, slug ou multi-tenant
**Depende de:** `specs/controle-estoque.md` (estado derivado de estoque já implementado)

## 1. Objetivo

Dar ao administrador uma central interna de notificações que mostre, de forma persistente e sem
repetição, o que realmente precisa de atenção na operação da loja — começando por estoque e
pedidos — e tornar o estoque baixo imediatamente perceptível na listagem de Estoque.

Não é push do navegador, e-mail, WhatsApp nem notificação do sistema operacional. É estado
interno do Admin, gravado no banco.

## 2. Estado atual verificado

Verificado em 2026-08-15 pela Management API do projeto `tjljhspczbaxtpbxlyjd` e por leitura do código.

### 2.1 Banco

- `produtos` já possui `estoque_quantidade`, `estoque_minimo` e `bloquear_venda_sem_estoque`.
  O estado (`em_estoque` / `baixo` / `esgotado`) é **derivado**, nunca persistido — regra em
  `src/lib/estoque-produto.mjs` e repetida como autoridade no banco.
- Somente `produtos` tem estoque. `bebidas`, `combos` e `adicionais` têm zero colunas de estoque.
- Já existem triggers de estoque (`trg_sincronizar_estoque_item_pedido`,
  `trg_reconciliar_estoque_status_pedido`) e RPCs atômicas (`ajustar_estoque_produto`,
  `definir_estoque_produto`). **Toda escrita de estoque passa pelo banco.**
- `pedidos.status` tem default `pendente`; o ciclo usado pelo Admin é
  `aguardando_pagamento → pendente → confirmado → preparando → pronto → saiu_para_entrega → entregue`,
  mais `cancelado` (`STATUS_PEDIDO_ADMIN` em `src/features/pedidos/components/FiltroPedidosAdmin.tsx`).
- **A publication `supabase_realtime` está vazia.** `pg_publication_rel` só contém
  `realtime.messages_*`. A migration `202607280016_realtime.sql` existe no repositório mas nunca
  foi aplicada a este projeto. Consequência verificada: o `postgres_changes` de
  `src/app/admin/estoque/page.tsx` **nunca dispara hoje**. Corrigir isso é task própria.
- Nenhuma tabela tem RLS; `anon`/`authenticated` têm grant total. Vale o §3.9 do `AGENTS.md`:
  consulta nova vai por route handler com `service_role`.

### 2.2 O que a loja realmente usa (versus legado do sistema antigo)

`ROTAS_ADMIN_OCULTAS` em `src/components/admin/AdminLayout.tsx` redireciona para o dashboard as
telas herdadas do restaurante: `pdv`, `mesas`, `salao`, `impressora`, `garcons`, `produtividade`,
`painel`, `caixa`, `crediario`, `combos`, `adicionais`, `whatsapp`, `anos-anteriores`.

As telas ativas são as de `GRUPOS_MENU_ADMIN`: visão geral, **pedidos**, novo pedido, pagamentos,
entregas, equipe, clientes, cidades de entrega, produtos, **estoque**, vitrine, cupons, finanças,
análise diária e relatórios.

Contagem atual das tabelas: `produtos` 5, `usuarios_sistema` 1, e **zero** linhas em `pedidos`,
`itens_pedido`, `crediario_contas`, `caixas` e `cupons` — a loja ainda não operou.

**Conclusão:** gerar notificação de crediário ou de caixa seria construir sobre fluxo desativado.
Os dois domínios que importam são **estoque** e **pedidos**.

### 2.3 Frontend

- `src/app/admin/layout.tsx` é o ponto onde providers globais do Admin são montados
  (`AdminAuthProvider`, `ImpressoraProvider`, `OnboardingProvider` + `OnboardingRoot`).
- `src/components/admin/AdminLayout.tsx` desenha o header; o menu do usuário fica em
  `DropdownMenu` no canto direito, ao lado do botão de tema.
- `Dialog` (`src/components/ui/dialog.tsx`) já troca sozinho para `Drawer` vaul abaixo de 768 px,
  com botão de fechar de 44 px e ajuste de teclado virtual.
- `src/components/ui/overlay-layer.tsx` é a fonte única de `z-index`; nenhum overlay carrega
  número literal.
- `AdminAuthContext.usuarioAtual` é `null` nos logins hardcoded (`edienailanches`, `dzndev`);
  só o login por `usuarios_sistema` popula o usuário.
- Persistência por usuário já tem precedente: tabela `admin_sidebar_config` + route handler
  `src/app/api/admin/sidebar-config/route.ts` com `service_role`.
- `ModalNotificacao.tsx` e `ModalAlerta.tsx` são caixas genéricas de mensagem pontual
  (sucesso/erro/confirmação). Não são central de notificações e não serão reaproveitados como tal.

## 3. Referência: como o Juridiq resolve

Analisado em `documents/juridiq-/juridiq` e `documents/juridiq-/Juridiq-server`.

| Aspecto | Juridiq | O que adotamos |
|---|---|---|
| Modelo | `Alert` (module + itemId) agrupa; `AlertContent` guarda cada ocorrência | Adotado como conceito: **chave de deduplicação** identifica a condição; cada ocorrência é uma linha |
| Leitura | Tabelas à parte por usuário (`AlertOnResponsible.isRead`, `ResponsibleAlertContent.isRead`) | Adotado: `notificacoes_leitura` por usuário |
| Badge | `COUNT(DISTINCT …)` separado da lista (`summary.unreadAlerts`) | Adotado e reforçado com índice parcial |
| Busca | Dropdown pede `limit: 1` fechado e `limit: 10` aberto | Adaptado: **uma** requisição por sessão serve badge, painel e modal |
| Prioridade | Não existe coluna; é derivada do `type` | **Divergimos**: `prioridade` é coluna explícita, como a task exige |
| Navegação | Item clicável leva ao contexto (`/alerts/{id}`, `/publications/{id}`) | Adotado: leva ao produto/pedido |
| "Não mostrar novamente" | `onboarding/storage.ts`: `preferences.dontShowAgain`, fonte da verdade no banco, localStorage como cache, união cumulativa | Adotado o princípio (servidor manda, preferência nunca é revertida por cache velho) |
| Modal de entrada | Não existe equivalente direto | Desenhado aqui |

O que **não** copiamos: `react-query` (o projeto usa Context), `dangerouslySetInnerHTML` no
conteúdo da notificação (o conteúdo aqui é texto), e gradientes/animações pesadas no item da
lista — o `UI.md` proíbe excesso de sombra/gradiente em superfície operacional.

## 4. Modelo de domínio

### 4.1 Notificação

Uma notificação representa **uma condição que precisa de atenção**, não um evento de log.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `uuid` | pk |
| `tipo` | `text` | `estoque_esgotado` · `estoque_baixo` · `pedido_novo` |
| `prioridade` | `text` | `urgente` · `normal` |
| `titulo` | `text` | curto, sem o nome da entidade |
| `mensagem` | `text` | frase completa, com nome e número |
| `entidade_tipo` | `text` | `produto` · `pedido` (para o link de contexto) |
| `entidade_id` | `uuid` | id da entidade |
| `dados` | `jsonb` | fotografia no momento (quantidade, mínimo, total) |
| `estado` | `text` | `ativa` · `resolvida` |
| `chave_dedupe` | `text` | `<tipo>:<entidade_id>` |
| `criada_em` / `atualizada_em` / `resolvida_em` | `timestamptz` | |

### 4.2 Ciclo de vida

São dois eixos, porque quem resolve o problema é a operação e quem lê é a pessoa:

```
notificação (sistema):     ativa ─────────────────► resolvida
por usuário (leitura):     nova → visualizada → lida
                                    └─ silenciada (não volta ao modal)
```

- `nova`: não existe linha em `notificacoes_leitura`.
- `visualizada`: apareceu no modal de entrada ou o painel foi aberto → `visualizada_em`.
- `lida`: o usuário marcou explicitamente, ou clicou para ir ao contexto → `lida_em`.
- `resolvida`: a condição deixou de valer (estoque reposto, pedido atendido). É automática,
  vem do banco, e **não** depende de ninguém ter lido.

Uma notificação `resolvida` some do badge e do modal; permanece consultável no painel em
"Resolvidas" para o administrador entender o que aconteceu.

### 4.3 Tipos e prioridade

| Tipo | Prioridade | Abre quando | Resolve quando |
|---|---|---|---|
| `estoque_esgotado` | `urgente` | `estoque_quantidade = 0` | `estoque_quantidade > 0` |
| `estoque_baixo` | `urgente` | `0 < estoque_quantidade <= estoque_minimo` | sai da faixa (repôs, ou zerou e virou esgotado) |
| `pedido_novo` | `normal`, escala para `urgente` após 12 h | pedido criado ou parado em `pendente` / `aguardando_pagamento` | status avança ou vira `cancelado` |

Justificativa da prioridade: o §3 da task classifica estoque baixo e esgotado como urgentes, e
pede que nem tudo vire urgente. Pedido novo é informação relevante mas não é problema — nasce
`normal`. Se ninguém o atendeu em 12 h, aí sim virou problema e escala **na mesma linha**, sem
criar uma segunda notificação para o mesmo pedido. Doze horas evita urgência falsa durante a
madrugada.

Um produto nunca tem `estoque_baixo` e `estoque_esgotado` ativos ao mesmo tempo: são faixas
mutuamente exclusivas e a sincronização resolve uma ao abrir a outra.

**Fora do escopo desta entrega:** crediário (tela oculta, zero linhas), caixa (tela oculta, zero
linhas), cupons (zero linhas), vitrine e entregas. A tabela e as funções nascem genéricas
(`tipo` / `prioridade` / `chave_dedupe` / `entidade_*`), então um gerador futuro é uma função SQL
nova — sem migration de schema.

### 4.4 Deduplicação e idempotência

O contrato é um **índice único parcial**:

```sql
create unique index notificacoes_dedupe_ativa_uidx
  on public.notificacoes (chave_dedupe) where estado = 'ativa';
```

Isso torna estruturalmente impossível existirem duas notificações ativas para a mesma condição —
não é disciplina de código, é o banco recusando.

A geração é feita por **trigger na escrita da entidade**, nunca na leitura da tela:

1. escrita em `produtos` (qualquer origem: RPC de estoque, formulário, trigger de item de pedido);
2. escrita em `pedidos` (INSERT ou mudança de `status`).

Abrir uma notificação usa `on conflict do nothing`; se já existe a ativa, apenas `dados`,
`mensagem` e `atualizada_em` são atualizados. Abrir a página **não gera nada**.

Sequência exigida pelo §5 e §7 da task:

| Momento | Efeito |
|---|---|
| `10 → 3` (mínimo 5) | abre `estoque_baixo:<id>` |
| `3 → 2` | **não** abre outra; atualiza `dados` da mesma linha |
| `2 → 0` | resolve `estoque_baixo`, abre `estoque_esgotado` |
| `0 → 20` | resolve `estoque_esgotado` |
| dias depois `20 → 2` | abre **linha nova** de `estoque_baixo` — nova ocorrência, id novo, volta ao modal mesmo que a anterior tenha sido silenciada |

### 4.5 Estado por usuário

```sql
notificacoes_leitura (notificacao_id, usuario_chave, visualizada_em, lida_em, silenciada_em)
  primary key (notificacao_id, usuario_chave)
```

`usuario_chave` é `text`, não FK `uuid`, porque `usuarioAtual` é `null` nos logins hardcoded.
Vale `usuarioAtual.id` quando existe e `'admin-local'` caso contrário — mesmo critério do
`'default'` já usado em `src/features/onboarding/storage.ts`.

### 4.6 "Não mostrar novamente"

Duas semânticas distintas, porque o usuário espera coisas diferentes de fechar e de marcar:

| Ação | Efeito | Alcance |
|---|---|---|
| Fechar o modal (X, Escape, "Entendi") | `visualizada_em` nas notificações exibidas | Aquelas ocorrências não voltam ao modal. Uma notificação **nova** reabre o modal. |
| Marcar "Não mostrar novamente" | além do acima, `notificacoes_preferencias.modal_entrada_ativo = false` | O modal de entrada não abre mais para esse usuário, até ele reativar |

```sql
notificacoes_preferencias (usuario_chave text primary key, modal_entrada_ativo boolean default true, atualizado_em)
```

Persistido no banco → sobrevive a refresh, logout/login, fechar e reabrir o navegador e troca de
dispositivo. O sino e o badge continuam funcionando normalmente; o painel mostra
"Reativar alertas ao entrar" quando a preferência está desligada, para a decisão não ser
irreversível.

O `silenciada_em` fica reservado para silenciar uma ocorrência específica sem desligar o modal
inteiro, acionado pelo "Dispensar" de cada item do painel.

## 5. Banco — migration proposta

Aplicada **somente pela Management API** (`AGENTS.md` §3.8), arquivo em `supabase/migrations/`.

1. `notificacoes`, `notificacoes_leitura` e `notificacoes_preferencias` com os campos acima e
   `check` de domínio em `tipo`, `prioridade` e `estado`.
2. Índices, seguindo `supabase-postgres-best-practices`:
   - `unique (chave_dedupe) where estado = 'ativa'` — a garantia de não duplicar;
   - `(prioridade) include (id) where estado = 'ativa'` — **índice parcial e coberto**, para o
     badge sair de index-only scan sem tocar o heap;
   - `(criada_em desc) where estado = 'ativa'` — ordenação do painel;
   - `(entidade_tipo, entidade_id) where estado = 'ativa'` — sincronização por entidade;
   - `(usuario_chave)` em `notificacoes_leitura` — o lado FK precisa do próprio índice.
3. Funções:
   - `sincronizar_notificacoes_estoque(p_produto_id uuid)` — resolve e abre conforme §4.3;
   - `sincronizar_notificacoes_pedido(p_pedido_id uuid)` — idem para pedido;
   - `reconciliar_notificacoes()` — passada **conjunta** (`set-based`, sem laço linha a linha)
     que corrige estado pré-existente e escala `pedido_novo` parado há mais de 12 h;
   - `resumo_notificacoes(p_usuario_chave text)` — contadores do badge;
   - `listar_notificacoes(p_usuario_chave text, p_limite int)` — lista já com estado do usuário.
4. Triggers `AFTER INSERT OR UPDATE OF …` em `produtos` e `pedidos`, disparando as funções de
   sincronização. `UPDATE OF` restringe as colunas para não reprocessar em escrita irrelevante.
5. Backfill idempotente no fim da migration: uma chamada a `reconciliar_notificacoes()`.
6. Nenhuma alteração em RLS, grants, publication de Realtime ou nas tabelas existentes.

Limite de segurança conhecido e não resolvido aqui: o banco continua sem RLS. Esta task não cria
endpoint privilegiado sem autenticação real nem alega corrigir esse risco; as notificações são
dados operacionais da loja, não expõem nada mais sensível do que já está exposto.

## 6. Estratégia de atualização e egress

Restrição declarada pelo usuário: **não consumir o egress do plano free (5 GB)**.

Decisão: **não abrir subscription de Realtime.** Motivos verificados:

1. a publication está vazia — Realtime não funcionaria sem alterar a publication;
2. websocket aberto e broadcast de linha inteira a cada evento gastam egress de forma contínua,
   inclusive com o painel ocioso;
3. há **um** usuário administrador; o ganho de propagação entre abas não paga o custo.

No lugar:

| Gatilho | O que busca | Custo |
|---|---|---|
| Montagem do provider (uma vez por sessão do Admin) | `?modo=completo` — reconcilia, devolve resumo + até 20 notificações | uma requisição, poucos KB |
| Mutação de estoque ou de pedido na própria aba | invalida e refaz `?modo=completo` | só quando o usuário age |
| Janela volta ao foco, com throttle de 60 s | `?modo=resumo` — só contadores | dezenas de bytes; só busca a lista se os contadores mudarem |

Não há polling por intervalo. O cenário do §8 da task (`10 → 3` gera alerta, `3 → 20` limpa) é
coberto pelo caminho de mutação, que é justamente quem alterou o estoque.

Regras de consulta aplicadas:

- nenhum `select('*')`; todas as colunas são explícitas;
- badge nunca lê linhas — `resumo_notificacoes` devolve inteiros por index-only scan;
- lista e contadores vêm na **mesma** resposta, sem segunda ida ao servidor ao abrir o sino;
- `reconciliar_notificacoes()` é uma passada conjunta, não um laço por produto (sem N+1);
- provider único no layout do Admin → uma origem de dados, sem consulta duplicada por tela;
- leitura e escrita vão por route handler com `service_role`, não por query anon no browser.

## 7. Contratos

### 7.1 Route handler `src/app/api/admin/notificacoes/route.ts`

```
GET  ?usuarioChave=<texto>&modo=resumo|completo
     → { sucesso, resumo: { urgentes, normais, naoLidas, total },
         notificacoes?: Notificacao[], modalAtivo: boolean }

POST { usuarioChave, acao: 'visualizadas'|'lida'|'lidas_todas'|'silenciada'|'preferencia_modal',
       ids?: string[], ativo?: boolean }
     → { sucesso, resumo }
```

Um único arquivo de rota, uma ação por requisição, resposta sempre com o resumo atualizado para
o badge não precisar de uma segunda chamada.

### 7.2 Módulo de domínio `src/lib/notificacoes.mjs`

Espelha em JavaScript a regra que o banco aplica, para ser testável sem banco — mesmo padrão de
`src/lib/estoque-produto.mjs`:

- `TIPOS_NOTIFICACAO`, `PRIORIDADES`, `LIMITE_MODAL`, `HORAS_PEDIDO_URGENTE`
- `chaveDedupe(tipo, entidadeId)`
- `descreverNotificacaoEstoque(produto)` → descritor ou `null`
- `descreverNotificacaoPedido(pedido)` → descritor ou `null`
- `estadoLeitura(notificacao)` → `nova | visualizada | lida`
- `notificacaoAbreModal(notificacao)` → `boolean`
- `selecionarNotificacoesDoModal(lista, limite)` → urgentes primeiro, depois mais recentes
- `agruparPorPrioridade(lista)` → `{ urgentes, normais }`
- `resumirNotificacoes(lista)` → contadores
- `rotaDaNotificacao(notificacao)` → destino do clique

### 7.3 Contratos de UI alterados

`src/components/admin/AdminLayout.tsx` ganha o sino no header, entre o botão de tema e o menu do
usuário. Nenhuma prop pública muda; o componente passa a consumir o contexto novo. Call sites
não são afetados.

## 8. Experiência

### 8.1 Estoque baixo na tela de Estoque (§1 da task)

Decisão aprovada pelo usuário: **baixo = âmbar, esgotado = vermelho**. Vermelho fica reservado ao
problema terminal (não vende mais), coerente com o `UI.md`, que exige status por texto + ícone e
proíbe comunicar só por cor.

Cada linha ganha:

- barra vertical de 3 px à esquerda — transparente em estoque normal, âmbar em baixo, vermelha em
  esgotado;
- ícone junto ao badge (`AlertTriangle` em baixo, `PackageX` em esgotado);
- quantidade em destaque tabular, com a cor do estado, e não só o badge;
- card de resumo "Esgotados" passa de cinza para vermelho, para o topo da tela contar a mesma
  história que a lista.

Nada além disso: a task pede evidência, não uma tela vermelha. Com 4 dos 5 produtos hoje
esgotados, saturar de vermelho destruiria a hierarquia.

### 8.2 Sino no header (§3)

- `Bell` ao lado do avatar. Badge com o total de ativas não lidas; vermelho quando há urgente,
  neutro quando só há normais. Com mais de 9, mostra `9+`.
- `aria-label` descrevendo a contagem; sem depender de cor.
- Abre um painel com duas seções: **Precisa de atenção** (urgentes, acento vermelho) e
  **Informações** (normais). Cada item traz ícone do tipo, título, mensagem, tempo relativo e,
  quando aplicável, botão de ir ao contexto.
- Ações por item: marcar como lida, dispensar. Ação geral: marcar todas como lidas.
- Rodapé: alternar "Mostrar resolvidas" e, quando desligado, "Reativar alertas ao entrar".
- Superfície: `Dialog` compartilhado, que já vira `Drawer` no mobile — mesmo padrão do atalho ⌘K
  que o header já usa. Sem `z-index` literal: a camada vem de `overlay-layer.tsx`.

### 8.3 Modal ao entrar (§4)

- Abre uma vez por sessão do Admin, se houver notificação ativa **não visualizada** e a
  preferência `modal_entrada_ativo` estiver ligada.
- Não abre em `/admin/login`, nem sem usuário autenticado.
- Mostra no máximo 3 itens, urgentes primeiro, com "e mais N" quando houver excedente.
- Ações: "Ver todas" (abre o painel), "Entendi" (fecha e marca como visualizadas) e o checkbox
  "Não mostrar novamente".
- Não bloqueia a navegação: fecha com Escape, clique fora e botão de 44 px.

### 8.4 Mobile (§11)

Herdado dos primitivos, mais o que é específico:

- `Dialog` → `Drawer` vaul abaixo de 768 px, com handle, swipe e `useAjusteTecladoVirtual`;
- lista com `min-h-0 flex-1 overflow-y-auto` — sem `max-h-[80vh]`, proibido pelo `UI.md`;
- rodapé fora da área que rola, com `pb-[max(1rem,env(safe-area-inset-bottom))]`;
- mensagens longas com `break-words` e título com `line-clamp`, sem estourar a largura;
- badge do sino não altera a altura do header; o botão respeita alvo de 44 px;
- camadas via `overlay-layer.tsx`, então o modal de entrada e o painel podem coexistir com o
  drawer da sidebar sem inverter backdrop.

## 9. Testes escritos antes da implementação

Sem dependência nova: `node:test` sobre `src/lib/notificacoes.mjs`, no padrão `.mjs` já usado, e
um teste SQL transacional com `rollback` pela Management API, como `tests/estoque-banco.sql`.

`tests/notificacoes.test.mjs` — domínio:

1. produto que entra em estoque baixo produz descritor `estoque_baixo` urgente;
2. produto esgotado produz `estoque_esgotado` urgente e nunca os dois ao mesmo tempo;
3. produto acima do mínimo não produz descritor;
4. limite exato (`quantidade = estoque_minimo`) conta como baixo;
5. chave de deduplicação é estável para a mesma condição e distinta entre tipos;
6. pedido em `pendente`/`aguardando_pagamento` produz `pedido_novo` normal;
7. pedido parado além de 12 h escala para urgente sem trocar de chave;
8. pedido em status avançado ou cancelado não produz descritor;
9. estado de leitura deriva corretamente (`nova`/`visualizada`/`lida`);
10. só entra no modal o que está ativo, não visualizado e não silenciado;
11. seleção do modal ordena urgentes primeiro e respeita o limite;
12. agrupamento por prioridade separa urgentes de normais;
13. resumo conta urgentes, normais e não lidas sem varrer duas vezes;
14. rota de contexto aponta para o produto e para o pedido corretos.

`tests/notificacoes-banco.sql` — banco, em transação com `rollback`:

15. estoque cruza o limite → **uma** notificação ativa;
16. nova escrita com a condição ainda válida → continua **uma**, com `dados` atualizado;
17. índice único parcial recusa uma segunda ativa com a mesma chave;
18. esgotar resolve a de baixo e abre a de esgotado;
19. repor resolve a ativa e zera o badge;
20. cair de novo em baixo cria **linha nova**, com id diferente da anterior;
21. pedido novo abre `pedido_novo`; avançar o status resolve;
22. `reconciliar_notificacoes()` é idempotente — rodar duas vezes não muda contagem;
23. `resumo_notificacoes` bate com a contagem real;
24. leitura e silenciamento são por usuário e não vazam entre usuários.

Cobertura dos 15 itens exigidos na task: 1→(1,15); 2→(16,17); 3→(2,18); 4→(19); 5→(20);
6→(1,2,12); 7→(6,12); 8→(23) e §6 desta spec; 9→(11,12); 10→(9); 11→(10,11); 12→§4.6 e (24);
13/14→§8.4 e verificação por leitura de diff (o `AGENTS.md` §3.4 proíbe teste de browser);
15→§6 desta spec.

## 10. Critérios de aceite

- Os cenários acima verdes, depois de observados em RED.
- Condição contínua nunca gera mais de uma notificação ativa — garantido por índice, não por código.
- Condição resolvida e reincidente gera ocorrência nova.
- Badge não lê linhas; sai de contadores com índice parcial coberto.
- Uma origem de dados no Admin; nenhuma consulta ou subscription duplicada.
- Nenhum polling por intervalo.
- "Não mostrar novamente" sobrevive a refresh, logout/login e reabertura do navegador, e é reversível.
- Estoque baixo é perceptível em uma passada de olho, sem tela saturada de vermelho.
- Modal e painel corretos no mobile: sem overflow, sem conflito de overlay, com safe area.
- `npx tsc --noEmit` e `npm run build` executados; limitação conhecida do `npm run lint`
  (`next lint` incompatível com Next 16) relatada honestamente.

## 11. Fora de escopo

- push do navegador, e-mail, WhatsApp ou notificação do sistema operacional;
- notificação de crediário, caixa, cupons, vitrine e entregas;
- estoque de bebidas, combos ou adicionais — não existe coluna;
- corrigir a publication vazia do Realtime e o `postgres_changes` morto das outras telas;
- correção global de RLS/autenticação;
- redesign do header, da sidebar ou da tela de Estoque além do indicador de estado;
- preferência por tipo de notificação (silenciar "todos os alertas de estoque").

## 12. Decisões que dependeram do usuário

Respondidas em 2026-08-15:

1. **Atualização/egress:** seguir `supabase-postgres-best-practices` com o objetivo de não
   consumir o egress do plano free → sem Realtime, invalidação por mutação e revalidação por foco.
2. **Tipos:** além de estoque, **pedidos**. Crediário está fora porque nem é usado. A distinção
   entre ativo e legado saiu de `ROTAS_ADMIN_OCULTAS` e das contagens do banco.
3. **Cor do estoque:** baixo = âmbar, esgotado = vermelho.
