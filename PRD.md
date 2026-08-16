# PRD — Fortes Fios

> **Estado confirmado em 2026-08-15** por leitura do repositório e consulta ao banco pela Supabase Management API (projeto `fortes-fios`, ref `tjljhspczbaxtpbxlyjd`). Versões anteriores deste documento descreviam o projeto **Edienai Lanches** (ref `bawysvqqeqwxasmggfcn`, restaurante/delivery), do qual este código foi derivado. Onde o texto antigo divergia do banco e do repositório reais, ele foi corrigido — ver §Legado.

> **Identidade:** o catálogo público e a página de contato usam o slogan e a paleta oliva/branco da Fortes Fios. Admin, login e entregas exibem a marca e a logo Fortes Fios, preservando os tokens e a paleta azul administrativa.

> **Regra de domínio ativa:** a Fortes Fios opera como e-commerce/catálogo de **produtos capilares**. Os únicos canais comerciais apresentados e contabilizados são **entrega** e **retirada na loja**. Mesa, salão, comanda, garçom, cozinha, consumo no local e impressão de cozinha são legado técnico fora da experiência Fortes Fios e não podem ser reintroduzidos em UI, relatórios ou novas regras.

## Problema

Oferecer um catálogo digital de produtos capilares, com navegação por categorias, carrinho e finalização de pedidos para a Fortes Fios.

## Usuários e casos de uso

| Perfil | Entrada | Uso principal |
|---|---|---|
| Cliente | `/` | Navegar pelos produtos capilares, montar carrinho, aplicar cupom, escolher entrega ou retirada e consultar pedidos pelo telefone |
| Administrador/operador | `/admin/*` | Operar pedidos, catálogo, estoque, entregas, finanças, clientes, análise diária, relatórios e configurações da loja |
| Superusuário | `/dzn` | Ocultar/exibir globalmente telas dos menus |

Os perfis **garçom** (`/garcom/*`) e **entregador** (`/entregador/*`) têm rotas e PWAs no repositório, mas pertencem ao legado do restaurante e não fazem parte da operação Fortes Fios (ver §Legado).

## Escopo (o que o produto é)

- Catálogo público responsivo com produtos capilares, categorias reais ordenadas em `categorias_cardapio`, busca, carrinho persistido, status da loja, vitrine configurável com artes independentes por tela, seção de mais vendidos em modo automático ou curadoria manual, ofertas selecionadas pelo administrador e prova social do studio parceiro com logo e resultados configuráveis.
- Checkout para entrega ou retirada na loja, com cidades atendidas, compra mínima por cidade, taxa de entrega, bairro/endereço livres, cupons, troco e formas de pagamento registradas no pedido. **Pagamento online não faz parte da operação** (ver §Legado).
- Painel administrativo com visão geral, listagem/histórico de pedidos, edição detalhada e criação manual de pedido.
- Catálogo: produtos, categorias, ordenação, imagens, disponibilidade, **controle de estoque** e condições comerciais por produto (desconto e parcelamento meramente informativo, configurável entre 2x e 12x).
- **Central de Notificações interna do Admin:** alertas de estoque baixo, produto esgotado e pedido aguardando atendimento, com sino no header, painel, modal de entrada e preferência de "não mostrar novamente" persistida por usuário. Não é push do navegador, e-mail nem WhatsApp.
- Gestão de entregas e cidades atendidas.
- Finanças: lançamentos, diárias e lucro bruto de produtos; análise diária e relatórios.
- Gestão de usuários de sistema e cadastro derivado de clientes.
- Controle global de visibilidade dos menus pelo superusuário em `/dzn`.
- PWA separada por perfil (arquivos `manifest*.json` e `sw*.js` em `public/`).

## Fora de escopo

- Mesa, salão, comanda, garçom, cozinha, consumo no local e impressão de cozinha.
- Pagamento online (Mercado Pago/PIX online).
- Atendimento por WhatsApp, manual ou automatizado.
- Produtividade de garçons e fechamento de anos anteriores.

Não existe lista formal de exclusões por tarefa. Para cada nova task, o solicitante deve definir explicitamente o que não será alterado, sobretudo quando a mudança tocar pedido, estoque ou finanças ao mesmo tempo.

## 🔴 Legado: código presente, banco ausente

Esta é a característica mais importante do estado atual e a que mais gera erro de premissa.

O banco deste projeto **não é** o banco do Edienai. Ele nasceu em 2026-08-13 de um dump estrutural de outro projeto (`supa-mk/00_public_schema.sql`, "MK Soluções", 27 tabelas), aplicado como a **única** migration do histórico remoto (`20260813210000 mk_public_schema`). O código do frontend, porém, veio do Edienai inteiro.

Resultado: **muitas telas existem em `src/app/admin/`, mas as tabelas e funções que elas consultam não existem no banco.**

`ROTAS_ADMIN_OCULTAS`, em `src/components/admin/AdminLayout.tsx`, redireciona essas rotas para o dashboard. Isso não é apenas uma preferência de menu: é o que impede a aplicação de quebrar.

| Módulo legado | Rota no repo | Tabelas ausentes | RPCs ausentes |
|---|---|---|---|
| Salão / mesas | `/admin/mesas`, `/admin/salao` | `mesas` | `limpar_mesas_expiradas` |
| PDV | `/admin/pdv` | depende de `mesas` | — |
| Painel Kanban | `/admin/painel` | `anotacoes_painel` | — |
| Impressão | `/admin/impressora` | `fila_impressao` | `configurar_fila_impressao` |
| Garçons | `/admin/garcons` | `atividade_garcom` | — |
| Produtividade | `/admin/produtividade` | `produtividade_config` | `produtividade_garcons`, `produtividade_serie_diaria`, `produtividade_ocorrencias`, `produtividade_ler_config`, `produtividade_salvar_config` |
| WhatsApp | `/admin/whatsapp`, `/admin/whatsapp-web` | todas as `whatsapp_*` | — |
| Anos anteriores | `/admin/anos-anteriores` | `historico_*`, `resumo_anual` | — |
| Crediário | `/admin/crediario` | *(tabelas existem)* | `quitar_crediario`, `registrar_pagamento_crediario`, `registrar_pagamento_item_crediario`, `cancelar_movimento_crediario`, `apagar_item_movimento_crediario`, `enviar_pedido_crediario` |
| Caixa | `/admin/caixa` | `caixa_automacao_config`, `pagamentos_entregadores` | — |
| Combos / adicionais | `/admin/combos`, `/admin/adicionais` | `categorias_adicionais` | — |
| Permissões `/dzn` | `/api/controle-acesso` | `permissoes_papel`, `permissoes_usuario`, `manutencao_modulos` | `obter_controle_acesso`, `salvar_controle_acesso`, `carregar_painel_controle_acesso` |
| Pagamento online | `/api/pagamentos/mercado-pago/*` | `pagamentos_online` | — |

Ao todo, o código chama **17 RPCs que não existem** no banco. `pedidos` mantém colunas `pagamento_online*` e `mesa_id`/`mesa`/`comanda`/`garcom_id` herdadas, mas sem as tabelas de apoio.

**Consequências práticas:**

1. Reativar uma dessas telas **não é** tirar a rota de `ROTAS_ADMIN_OCULTAS` — exige migration própria, com autorização.
2. `supabase/migrations/` **não é espelho do banco**. Vários arquivos ali foram transcritos do projeto antigo e nunca aplicados aqui (o caso mais relevante é `202607280016_realtime.sql`, ver §Realtime). Confirme sempre pelo banco, nunca pelo arquivo.
3. Ao ler código legado, não assuma que a estrutura que ele consulta existe.

Os subprojetos `edienai-lanches-impressora/`, `edienai-lanches-zap/`, `edienai-evolution-bot/` e a pasta `docs/`, citados em versões anteriores deste PRD, **não existem neste repositório**. As rotas `src/app/api/bot/*` continuam presentes e apontam para um serviço Evolution externo.

## 🔴 Segurança (verificado 2026-08-15 via Management API)

O modelo de acesso é uma **exposição de dados explorável**, não uma decisão de arquitetura. Registrado como risco de produto:

- **Nenhuma das 30 tabelas tem RLS habilitado** (zero policies).
- Os roles **`anon` e `authenticated` têm grant total** (SELECT/INSERT/UPDATE/DELETE/`TRUNCATE`) em 27 das 30 tabelas, incluindo `usuarios_sistema` (com `senha_hash` e `papel`), `usuarios_cliente`, `pedidos`, `pagamentos_pedido` e `crediario_contas`.
- A **anon key é pública** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, embutida no bundle por `src/lib/supabase.ts`) e **63 componentes client** consultam tabelas diretamente.
- As três exceções são `notificacoes`, `notificacoes_leitura` e `notificacoes_preferencias`, criadas em 2026-08-15 já **fechadas** para `anon`/`authenticated`. São o padrão a seguir daqui em diante, não a exceção a normalizar.

**Impacto:** qualquer pessoa com a anon key (extraível do site) pode, via PostgREST, ler todos os clientes, pedidos, pagamentos e os hashes de senha do sistema, e apagar ou `TRUNCATE` qualquer tabela. O login (`autenticacao.ts`, RPC `verificar_senha_usuario` + `localStorage`) é confiança no cliente: o banco já está aberto antes de qualquer autenticação.

**Atenuante real:** a loja ainda não operou (0 pedidos, 0 pagamentos, 1 cliente, 1 usuário de sistema). A remediação é muito mais barata agora do que depois.

**Remediação (tarefa própria, com autorização):** habilitar RLS + policies por tabela, revogar os grants amplos do `anon`, mover as consultas sensíveis para route handlers server-side com service role e rotacionar a service role. Ver `AGENTS.md §3.9` e `SKILLS.md §Segurança`.

> **Correção sobre `.env.local`:** neste repositório o arquivo **não está rastreado no git** e contém apenas quatro variáveis do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`). Não há `MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY` nem `VERCEL_OIDC_TOKEN`. O alerta do `AGENTS.md §3.10` descreve o repositório antigo e não se aplica aqui. `SUPABASE_SERVICE_ROLE_KEY` **está** configurada, ao contrário do que o PRD anterior afirmava.

## Arquitetura do repositório

| Parte | Caminho | Responsabilidade | Stack |
|---|---|---|---|
| Aplicação | `src/` | Site público, PWAs por perfil, admin, route handlers e integração com Supabase | Next.js 16 (App Router), React 18, TypeScript `strict`, Tailwind v3, shadcn/Radix, Supabase JS |
| Migrations | `supabase/migrations/` | SQL versionado. **Não é espelho do banco** — ver §Legado | SQL |
| Dump de origem | `supa-mk/` | Dump estrutural que originou o schema atual | SQL |
| Especificações | `specs/` | Spec por funcionalidade, escrita antes do código (`AGENTS.md §0.5`) | Markdown |
| Testes | `tests/` | `node:test` sobre módulos `.mjs` + testes SQL transacionais | JS ESM / SQL |
| Scripts operacionais | `scripts/` | Inventário e manutenção via Management API | Node.js ESM |

## Rotas e módulos

### Público

- `/`: catálogo e checkout.
- `/contato`: informações de contato.
- `/preview-mobile-frame`: renderização do catálogo dentro do preview administrativo.

### Administração

O menu de `src/lib/admin-sidebar-routes.ts` organiza o produto em quatro grupos:

- **Pedidos:** visão geral (`/admin/dashboard`), pedidos, novo pedido.
- **Loja:** pagamentos, entregas, equipe, clientes e acessos, cidades de entrega.
- **Catálogo:** produtos e categorias, estoque, vitrine, cupons.
- **Gestão:** finanças, análise diária, relatórios.

Há ainda detalhes/edição de pedido (`/admin/pedidos/[id]`, `/admin/pedidos/[id]/editar`), o login (`/admin/login`) e uma página técnica `/admin/dev`. Todas as demais rotas sob `src/app/admin/` estão em `ROTAS_ADMIN_OCULTAS` (§Legado).

### Superusuário

- `/dzn`: login exclusivo do usuário de sistema `dzn`; ativa ou oculta globalmente telas dos menus.
- A configuração reutiliza `admin_sidebar_config`; itens ocultos não aparecem na sidebar, em Mais, na busca, nos atalhos nem no personalizador.
- A aba de permissões por cargo/usuário **não funciona** neste banco (§Legado).
- Visibilidade não é barreira de segurança: não substitui RLS, sessão server-side ou autorização de mutação.

### Route handlers

25 handlers em `src/app/api/`. Ativos e com suporte no banco: `admin/notificacoes`, `admin/sidebar-config`, `dzn/visibilidade`, `upload`, `vitrine/*` (categorias, faixa-rodape, mais-vendidos, ofertas, resultados-studio). Presentes sem suporte no banco: `admin/produtividade/*`, `controle-acesso`, `crediario/cobranca`, `pagamentos/mercado-pago/*`, `bot/*`.

## Fluxos centrais

### 1. Catálogo e checkout do cliente

1. `src/app/page.tsx` carrega produtos e configurações de ordenação/merchandising; as categorias públicas ativas vêm de `/api/vitrine/categorias`, que expõe somente `id`, `nome` e `ordem` de `categorias_cardapio`. "Todos" é filtro universal da interface, com rótulo configurável, nunca categoria atribuível a produto.
2. Mais vendidos usa a ordem manual salva pelo administrador ou um ranking server-side por quantidade vendida; entram somente itens com `produto_id` em pedidos válidos de entrega/retirada, sem cancelados.
3. Ofertas usa a curadoria manual `vitrine_produtos_ofertas`, aparece logo depois de Mais vendidos somente quando está ativa e tem produtos disponíveis.
4. Desconto pertence ao produto: `preco_original` guarda a referência, `desconto` o percentual e `preco` o valor final usado no carrinho. A Vitrine é atalho para os mesmos campos, sem criar segunda fonte de preço.
5. `produtos.parcelamento_ativo` controla a visibilidade do parcelamento e `parcelas_sem_juros` define a quantidade entre 2 e 12; o valor é derivado de `preco / parcelas_sem_juros` e **nunca** é enviado ao checkout ou ao pedido. Registros legados sem quantidade usam 3x.
6. A seção de resultados do studio lê `vitrine_resultados_studio`, exibe somente fotos publicadas e some enquanto nenhum resultado estiver ativo.
7. `CarrinhoContext` mantém o carrinho no `localStorage`.
8. Produtos possuem quantidade física, limite de estoque baixo e regra opcional de bloqueio no zero. O estado é sempre derivado; o carrinho reconcilia alterações e o banco reserva atomicamente ao criar `itens_pedido`, restaurando ao remover ou cancelar.
9. `ModalCarrinho` revalida cupom, estoque e itens e calcula frete. Em entrega, o cliente seleciona uma cidade ativa, informa bairro e endereço em campos livres e pode acrescentar referência; a compra mínima é validada sobre o subtotal de produtos após descontos de item, antes de frete e cupom. Cada cidade tem dias semanais e compra mínima configuráveis. Checkout e confirmação informam a próxima data habilitada, persistida no pedido e na entrega. Os prazos de retirada e entrega são configurações independentes da loja.
10. Cria `pedidos`, grava `itens_pedido` e `item_adicionais`, registra cupom e cria a entrega quando necessário.
11. Se uma etapa crítica falhar, o frontend remove o uso do cupom e exclui o pedido criado, restaurando a reserva de estoque pela própria transação de itens.

### 2. Pedido interno (admin)

1. O operador escolhe catálogo, cliente, pagamento e tipo de entrega em `/admin/pedidos/novo`.
2. Itens, adicionais, pagamento e entrega são persistidos com `produto_id` preservado — sem esse vínculo, a regra de estoque do banco seria contornada.

### 3. Ciclo do pedido

- Estados usados pelo Admin: `aguardando_pagamento`, `pendente`, `confirmado`, `preparando`, `pronto`, `saiu_para_entrega`, `entregue` e `cancelado` (`STATUS_PEDIDO_ADMIN`).
- O dia operacional usa `America/Sao_Paulo` com corte às **03:00**.
- Concluir uma entrega sincroniza também `entregas`.
- Pagamentos parciais ficam em `pagamentos_pedido`.

### 4. Estoque

- `produtos` guarda `estoque_quantidade`, `estoque_minimo` e `bloquear_venda_sem_estoque`. O estado (`em_estoque` / `baixo` / `esgotado`) é **derivado**, nunca persistido — regra única em `src/lib/estoque-produto.mjs`, repetida no banco como autoridade.
- A reserva acontece na inserção de `itens_pedido` (trigger `trg_sincronizar_estoque_item_pedido`) e é restaurada ao remover o item ou cancelar o pedido (`trg_reconciliar_estoque_status_pedido`).
- Ajustes do Admin usam as RPCs atômicas `ajustar_estoque_produto` e `definir_estoque_produto`.
- Somente `produtos` tem estoque. `bebidas`, `combos` e `adicionais` não têm colunas de estoque.
- Spec: `specs/controle-estoque.md`.

### 5. Notificações do Admin

- Cruzar o limite de estoque, esgotar ou criar um pedido pendente abre uma notificação, gerada por **trigger no banco** — nunca pela leitura de uma tela. Abrir a página não cria nada.
- Uma condição contínua mantém **um** alerta ativo, garantido por índice único parcial (`chave_dedupe where estado = 'ativa'`). Resolver e reincidir gera **ocorrência nova**.
- Prioridade: estoque baixo e esgotado nascem `urgente`; pedido aguardando nasce `normal` e escala para `urgente` após 12 h parado, na mesma linha.
- Estado por usuário (`nova → visualizada → lida`, mais `silenciada`) e preferência do modal ficam no banco, então sobrevivem a refresh, logout/login e troca de dispositivo.
- Sem Realtime: uma busca ao montar, invalidação após mutação na própria aba e revalidação por foco com throttle. Sem polling por intervalo.
- Spec: `specs/central-notificacoes-admin.md`.

### 6. Entregas

- Pedido do tipo entrega gera ou atualiza `entregas`.
- Estados observados: `pendente`, `em_rota`, `entregue` e `cancelada`.
- Taxa, compra mínima e agenda derivam da cidade ativa cadastrada em `bairros`; bairro do endereço nunca é opção tarifada.

### 7. Finanças

- `movimentacoes_caixa` registra entrada/saída ligada a categoria, funcionário e pedido.
- Finanças concentra Lançamentos, Diárias (`financas_diarias`) e Lucro bruto de produtos.
- O custo de compra é opcional; quando informado, é copiado para o item no momento da venda (`trg_preencher_custo_unitario_item_pedido`). Mudar o custo no catálogo não altera o lucro de pedidos já realizados.
- Lucro bruto = venda líquida dos itens menos custo de compra. Itens antigos ou sem custo não entram e deixam o período explicitamente parcial.
- As tabelas de crediário (`crediario_contas`, `crediario_movimentos`) existem, mas as RPCs que as operam não (§Legado).

## Supabase/PostgreSQL

### Projeto ativo

| Campo | Valor |
|---|---|
| Nome | `fortes-fios` |
| Project ref | `tjljhspczbaxtpbxlyjd` |
| Região | `sa-east-1` |
| Criado em | 2026-08-13 |
| Estado em 2026-08-15 | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.155` |

O `.env.local` aponta para esse projeto. Scripts antigos ainda carregam refs históricas (o Edienai era `bawysvqqeqwxasmggfcn`); nunca assumir que a ref default de um script é o banco atual.

### Inventário estrutural (2026-08-15)

- 31 relações públicas: **30 tabelas e 1 view**.
- 365 colunas, 98 índices, 20 funções públicas e 5 triggers.
- O histórico remoto tem **uma** migration (`20260813210000 mk_public_schema`). O diretório `supabase/migrations/` local tem 20 arquivos, e a maior parte nunca foi aplicada aqui.

### Domínios de dados

| Domínio | Tabelas/views |
|---|---|
| Catálogo | `produtos`, `bebidas`, `combos`, `combo_itens`, `adicionais`, `produto_adicionais`, `categorias_cardapio` |
| Pedido e pagamento | `pedidos`, `itens_pedido`, `item_adicionais`, `formas_pagamento`, `pagamentos_pedido`, `cupons`, `cupons_usos` |
| Operação e identidade | `configuracoes_loja`, `bairros`, `entregas`, `funcionarios`, `usuarios_sistema`, `usuarios_cliente`, `admin_sidebar_config` |
| Financeiro | `caixas`, `categorias_caixa`, `movimentacoes_caixa`, `financas_diarias`, `crediario_contas`, `crediario_movimentos` |
| Notificações do Admin | `notificacoes`, `notificacoes_leitura`, `notificacoes_preferencias` — as únicas fechadas para `anon`/`authenticated`; o acesso é por route handler com `service_role` e os triggers funcionam por serem `SECURITY DEFINER` |
| Views | `vw_usuarios_cliente_metricas` |

Volume atual: 5 produtos, 7 categorias, 3 cidades, 1 cliente, 1 funcionário, 1 usuário de sistema e **0 pedidos** — a loja ainda não operou.

### Triggers

Cinco triggers, todos ligados a estoque e notificação:

| Tabela | Trigger | Evento | Papel |
|---|---|---|---|
| `itens_pedido` | `trg_preencher_custo_unitario_item_pedido` | INSERT | copia o custo do catálogo para o item |
| `itens_pedido` | `trg_sincronizar_estoque_item_pedido` | INSERT/UPDATE/DELETE | reserva e restaura estoque atomicamente |
| `pedidos` | `trg_reconciliar_estoque_status_pedido` | UPDATE | restaura/refaz reserva ao cancelar ou reabrir |
| `pedidos` | `trg_notificacoes_pedido` | INSERT/UPDATE/DELETE | abre/resolve notificação de pedido aguardando |
| `produtos` | `trg_notificacoes_produto` | INSERT/UPDATE/DELETE | abre/resolve notificação de estoque |

Os triggers que o PRD anterior descrevia em `pedidos` (número do pedido, cliente, caixa, crediário, fila de impressão) **não existem** neste banco.

### Realtime

🔴 **A publication `supabase_realtime` está vazia** — zero tabelas publicadas (`pg_publication_rel` só contém `realtime.messages_*`). A migration `202607280016_realtime.sql`, que publicaria 34 tabelas, veio do projeto antigo e **nunca foi aplicada aqui**.

Consequência verificada: **32 arquivos assinam `postgres_changes` e nenhum recebe evento**. Isso inclui o catálogo público (`src/app/page.tsx`), o Hero da vitrine, o carrinho, `/admin/estoque`, `/admin/produtos`, `/admin/pedidos`, o dashboard e o status de loja aberta/fechada (`src/lib/useStatusLoja.ts`). Telas que parecem "reagir em tempo real" dependem, na prática, de refetch — e o status da loja só muda para o cliente quando a página recarrega.

A Central de Notificações foi desenhada sem Realtime de propósito, para não consumir egress do plano free. Publicar tabelas é decisão consciente com custo de egress, e é tarefa própria.

## Integrações externas

| Integração | Situação | Código principal |
|---|---|---|
| Supabase | **Ativa** — banco, RPC | `src/lib/supabase.ts` (anon, browser), `src/lib/server/supabase-admin.ts` (service role) |
| Backblaze B2 | **Ativa** — imagens de catálogo/vitrine/avatar, via API compatível com S3 e rota same-origin com retentativas | `src/app/api/upload/route.ts`, `src/lib/backblaze.ts`, `src/lib/servicoUploadImagem.ts` |
| Mercado Pago | **Legado** — código presente, sem `pagamentos_online` no banco; fora do escopo comercial | `src/app/api/pagamentos/mercado-pago/`, `src/lib/server/mercado-pago.ts` |
| Evolution API | **Legado** — rotas de controle presentes, sem serviço nem chave configurada | `src/app/api/bot/` |
| Impressoras locais | **Legado** — sem `fila_impressao` no banco | `src/lib/impressora/` |

## Stack e decisões arquiteturais

| Decisão | Escolha atual | Consequência | Data |
|---|---|---|---|
| Renderização web | Next.js 16 App Router, telas operacionais majoritariamente client components | Estado e acesso ao Supabase ficam próximos da UI | 2026-08-15 |
| Persistência | Supabase/PostgreSQL acessado diretamente pelo cliente | Banco e triggers funcionam como núcleo de integridade | 2026-08-15 |
| Integridade comercial | Regra crítica (estoque, notificação) mora em trigger/função no banco, não na UI | Nenhum caminho de frontend contorna a regra | 2026-08-15 |
| Atualização operacional | Refetch dirigido por mutação e foco; **sem Realtime** | Egress previsível no plano free | 2026-08-15 |
| Estado no cliente | React Context (`AdminAuthContext`, `CarrinhoContext`, `NotificacoesContext`, …) | Sem Redux/Zustand/TanStack Query, por decisão | 2026-08-15 |
| Forms | `useState` manual, sem zod nem react-hook-form | Validação manual e por tipo | 2026-08-15 |
| Testes | `node:test` sobre módulos `.mjs` + SQL transacional com rollback | Sem framework de teste; sem browser test (`AGENTS.md §3.4`) | 2026-08-15 |
| Temas | Variáveis CSS semânticas + Tailwind v3; `next-themes` | Claro/escuro compartilham os mesmos componentes | 2026-08-15 |
| UI compartilhada | shadcn/Radix em `src/components/ui` e Kibo UI em `src/components/kibo-ui` | Novas telas devem reutilizar essas bases | 2026-08-15 |
| Arquivos | Backblaze B2 via API compatível com S3 | URLs públicas ficam salvas nas entidades | 2026-08-15 |

## Hotspots e dependências sensíveis

Arquivos grandes e com alto acoplamento exigem leitura dirigida antes de qualquer edição:

- `src/app/admin/pdv/page.tsx` — 2.895 linhas *(legado)*.
- `src/features/crediario/components/PainelCrediario.tsx` — 2.781 linhas *(legado)*.
- `src/components/ModalCarrinho.tsx` — 2.769 linhas.
- `src/app/admin/produtos/page.tsx` — 2.350 linhas.
- `src/components/admin/ModalDetalhesPedido.tsx` — 2.259 linhas.
- `src/app/garcom/novo/page.tsx` — 2.174 linhas *(legado)*.
- `src/app/admin/mesas/page.tsx` — 2.113 linhas *(legado)*.
- `src/app/admin/vitrine/page.tsx` — 1.906 linhas.
- `src/lib/useCaixa.ts` — 1.646 linhas *(legado)*.
- `src/components/admin/ModalEditarPedido.tsx` — 1.603 linhas.

Uma mudança em pedido pode refletir em `itens_pedido`, pagamentos, entrega, estoque e notificações. O menor escopo seguro deve mapear esses consumidores antes do patch.

## Restrições e não-negociáveis

- Preservar contratos e padrões existentes; não introduzir arquitetura ou dependência sem alinhamento.
- Consultar e administrar o banco exclusivamente pela Supabase Management API; não usar MCP.
- Nunca persistir access tokens ou credenciais em código/documentação.
- Não executar SQL de escrita ou migration sem autorização explícita para a tarefa.
- Não usar Playwright nem teste de browser.
- Toda alteração funcional segue SPEC → TESTE (RED) → IMPLEMENTAÇÃO → REFACTOR → VALIDAÇÃO (`AGENTS.md §0.5`).
- Não reintroduzir mesa, salão, comanda, garçom, cozinha ou impressão de cozinha na experiência Fortes Fios.
- Qualquer mudança de autenticação, grants, RLS ou trigger é migração com autorização própria.

## Lacunas conhecidas de documentação

- O schema remoto não está reproduzido em migrations locais versionadas; o histórico remoto tem uma única migration.
- As tabelas TypeScript de `src/lib/supabase.ts` cobrem somente parte do schema real.
- Não existe especificação formal de regras comerciais para cada status de pedido e suas exceções.
- Não há suíte de testes cobrindo os fluxos de UI; a cobertura automatizada é de domínio (`.mjs`) e de banco (SQL).
- `npm run lint` está quebrado: o script legado `next lint` é incompatível com Next 16 e falha antes de analisar arquivos. A verificação em vigor é `npx tsc --noEmit` + `npm run build`.
- O destino do código legado (remover, migrar ou reativar com migration) ainda não foi decidido. `[?]`

## Glossário de domínio

- **Pedido:** agregado de venda que conecta itens, pagamentos, entrega, cliente e estoque.
- **Dia operacional:** janela de trabalho usada para agrupar pedidos, com corte às 03:00.
- **Situação de estoque:** estado derivado `em_estoque` / `baixo` / `esgotado`; nunca persistido.
- **Bloqueio no zero:** regra opcional por produto que impede a venda quando a quantidade chega a zero.
- **Notificação:** condição do sistema que precisa de atenção, não evento de log; uma condição contínua tem um único alerta ativo.
- **Chave de deduplicação:** `<tipo>:<entidade_id>`, única entre as notificações ativas.
- **Diária:** pagamento avulso a diarista, lançado em Finanças; grava `financas_diarias` e despesa em `movimentacoes_caixa`.
- **Legado:** código herdado do Edienai Lanches cujas estruturas de banco não existem neste projeto.
