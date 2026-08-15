# Spec — Reconstrução do módulo de Ajuda do Admin

**Status:** aprovada para implementação  
**Data:** 2026-08-15  
**Escopo:** conteúdo e descoberta da Ajuda em `/admin`, alinhados ao produto Fortes Fios em uso. Sem tours novos, sem reativar telas legadas, sem dependência nova.

## 1. Objetivo

O usuário do painel precisa de uma Ajuda que descreva **somente** o que está acessível hoje: rotas do menu, ações reais de cada tela e o comportamento implementado. A lista atual de treinamentos não é fonte da verdade.

## 2. Estado atual verificado

### 2.1 Admin real (fonte da verdade)

Menu em `src/lib/admin-sidebar-routes.ts`, visível e alcançável (salvo personalização/`/dzn`):

| Grupo | Rota | Título na UI |
|---|---|---|
| Pedidos | `/admin/dashboard` | Visão geral |
| Pedidos | `/admin/pedidos` | Pedidos |
| Pedidos | `/admin/pedidos/novo` | Novo pedido |
| Loja | `/admin/formas-pagamento` | Pagamentos |
| Loja | `/admin/entregas` | Entregas |
| Loja | `/admin/funcionarios` | Equipe |
| Loja | `/admin/usuarios` | Clientes e acessos |
| Loja | `/admin/bairros` | Cidades de entrega |
| Catálogo | `/admin/produtos` | Produtos e categorias |
| Catálogo | `/admin/estoque` | Estoque |
| Catálogo | `/admin/vitrine` | Vitrine |
| Catálogo | `/admin/cupons` | Cupons |
| Gestão | `/admin/financas` | Finanças |
| Gestão | `/admin/analise-diaria` | Análise diária |
| Gestão | `/admin/relatorios` | Relatórios |

Também acessíveis sem item próprio de menu: detalhe/edição de pedido (`/admin/pedidos/[id]`, `.../editar`), sino de notificações no header, personalizar menu.

`/admin` não tem `page.tsx`; a entrada operacional é `/admin/dashboard` (e login em `/admin/login`, fora da Ajuda).

### 2.2 Rotas existentes no repo mas **fora** da Ajuda

`ROTAS_ADMIN_OCULTAS` em `AdminLayout.tsx` redireciona para o dashboard. Não documentar:

`/admin/pdv`, `/mesas`, `/salao`, `/impressora`, `/garcons`, `/produtividade`, `/painel`, `/caixa`, `/crediario`, `/combos`, `/adicionais`, `/whatsapp`, `/anos-anteriores`.

Também fora: `/admin/dev`, `/dzn`, pagamento online, WhatsApp, mesa/comanda/cozinha, frete diário (não existe no código acessível).

### 2.3 Ajuda atual (incorreta)

O painel (`help-panel` + `module-catalog`) lista o menu e marca **Em breve** quando não há `TourConfig`. Só existem três tours registrados: **Painel**, **Crediário** e **Finanças**. Os dois primeiros apontam a rotas ocultas e usam linguagem de lanchonete. O progresso conta `0 de 3` mesmo com Crediário/Painel invisíveis no catálogo. Não há busca. Não há artigo de Estoque nem de Vitrine. Finanças tem tour, mas o passo de Lucro não explica o cálculo real.

### 2.4 Decisão de produto da Ajuda

A Ajuda passa a ser **documentação por artigo**, indexada pela rota do menu. Tours guiados continuam opcionais e só para telas reais; nesta entrega permanece o tour de Finanças, com textos corrigidos. Não criar tours interativos novos (evita demo stores e viola o orçamento).

## 3. Regras

1. Um artigo por item de `GRUPOS_MENU_ADMIN`, com `rota`, `título`, `categoria`, `resumo`, `seções` e `palavras-chave`.
2. Artigo extra **Notificações** (`virtual`): aparece no catálogo/busca, nunca vence o artigo da rota atual.
3. `obterArtigoPorRota(pathname)` usa o prefixo mais longo entre artigos não virtuais (`/admin/pedidos/novo` vence `/admin/pedidos`).
4. `buscarArtigos(termo)` casa título, categoria, resumo, seções e palavras-chave, sem acento e sem maiúsculas.
5. Nenhum artigo aponta a rota oculta. Nenhum texto ensina Crediário, Painel Kanban, PDV, WhatsApp, mesa ou combo como funcionalidade a usar.
6. Linguagem para o operador da loja: para que serve, onde fica, como usar, o que acontece depois. Sem jargão técnico.
7. Conteúdo curto e escaneável (títulos + parágrafos curtos).
8. Lucro documenta a regra **confirmada no código** (`obter_lucro_produtos` + `useFinancas` + `PainelLucro`), não uma fórmula inventada.
9. Estoque documenta estados derivados, alerta visual, ajuste `− / valor / +`, zerar, “Bloquear venda no zero” e a diferença entre quantidade zero e “Disponível no catálogo”.
10. Vitrine documenta só as abas reais: Banners, Mais vendidos, Ofertas, Studio, Cabeçalho.

## 4. Contratos

Módulo `src/features/onboarding/help/catalogo.mjs`:

```
ARTIGOS_AJUDA: ArtigoAjuda[]
ROTAS_ADMIN_REAIS: string[]
ROTAS_ADMIN_OCULTAS_AJUDA: string[]

obterArtigoPorRota(pathname: string) -> ArtigoAjuda | null
buscarArtigos(termo: string) -> ArtigoAjuda[]
listarArtigosPorCategoria() -> { categoria, artigos }[]
auditarCoberturaAjuda() -> { faltando: string[], extrasOcultos: string[] }
```

`ArtigoAjuda`: `{ id, rota | null, titulo, categoria, virtual?, palavrasChave[], resumo, secoes: { titulo, corpo }[] }`

A UI do painel consome esse catálogo. O catálogo de treinamentos deixa de ser a lista do menu com “Em breve”.

## 5. Cenários

| # | Cenário | Esperado |
|---|---|---|
| 1 | Cobertura | Toda rota de `ROTAS_ADMIN_REAIS` tem artigo não virtual |
| 2 | Exclusão | Nenhuma rota de `ROTAS_ADMIN_OCULTAS_AJUDA` tem artigo |
| 3 | Contexto `/admin/estoque` | Artigo título Estoque |
| 4 | Contexto `/admin/pedidos/novo` | Artigo Novo pedido, não Pedidos |
| 5 | Contexto `/admin/pedidos/<id>` | Artigo Pedidos |
| 6 | Busca `estoque baixo` | Encontra Estoque |
| 7 | Busca `lucro bruto` | Encontra Finanças e o texto explica venda − custo histórico |
| 8 | Busca `crediário` / `kanban` / `whatsapp` | Não devolve artigo desses módulos |
| 9 | Vitrine | Artigo cita Banners, Mais vendidos, Ofertas, Studio e Cabeçalho |
| 10 | Estoque zero vs indisponível | Texto distingue bloqueio no zero de “Disponível no catálogo” |

## 6. Critérios de aceite

- Abrir Ajuda em qualquer tela do menu mostra o artigo daquela tela no topo.
- Dá para ler a Ajuda de outra área sem sair da página (catálogo + busca).
- Não existe rótulo “Em breve” para tela real do menu.
- Crediário e Painel não entram no progresso nem no catálogo.
- Estoque, Vitrine e Finanças/Lucro estão documentados conforme o código.
- Mobile: Sheet inferior; desktop: Sheet à direita (comportamento atual do `Sheet`).
- `node --test tests/ajuda-admin.test.mjs` verde.

## 7. Fora de escopo

- Tours guiados novos (Estoque, Vitrine, etc.).
- Reativar telas de `ROTAS_ADMIN_OCULTAS`.
- Apagar arquivos de demo/tour de Crediário e Painel (código morto permanece; só deixa de ser registrado).
- Corrigir “Fiado do dia” na Análise diária ou “Combo” no formulário de cupom (legado na tela; a Ajuda não ensina a usar).
- Busca no menu lateral do Admin.
- Testes de browser.

## 8. Correção sem teste de UI

A renderização do painel não tem framework de componente. A regressão de conteúdo, cobertura, contexto e busca fica no módulo `.mjs`. A montagem React é conferida por typecheck e leitura do diff.
