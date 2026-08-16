# SPEC — RBAC do Admin (Administrador · Atendente)

> Status: **Opção A. Fases 0, 1, 2, 4 e 5 implementadas e verificadas. Pendências residuais em §11.**
> Verificado em 2026-08-15 contra o repositório e o projeto `tjljhspczbaxtpbxlyjd` pela Management API.

---

## 1. Admin atual — o que realmente existe

15 rotas no menu (`src/lib/admin-sidebar-routes.ts`), em 4 grupos:

| Grupo | Rotas |
|---|---|
| Pedidos | `/admin/dashboard` (Visão geral) · `/admin/pedidos` · `/admin/pedidos/novo` |
| Loja | `/admin/formas-pagamento` · `/admin/entregas` · `/admin/funcionarios` (Equipe) · `/admin/usuarios` (Clientes e acessos) · `/admin/bairros` |
| Catálogo | `/admin/produtos` · `/admin/estoque` · `/admin/vitrine` · `/admin/cupons` |
| Gestão | `/admin/financas` · `/admin/analise-diaria` · `/admin/relatorios` |

Fora do menu, mas alcançáveis: `/admin/pedidos/[id]`, `/admin/pedidos/[id]/editar`, `/admin/login`, `/admin/dev`.

**13 rotas legadas** existem como arquivo e estão fora do menu (`pdv`, `mesas`, `salao`, `impressora`, `garcons`, `produtividade`, `painel`, `caixa`, `crediario`, `combos`, `adicionais`, `whatsapp`, `anos-anteriores`). Conforme o `PRD.md` §Legado, boa parte delas consulta tabelas e RPCs **que não existem neste banco**. → **Não recebem permissão.** Criar permissão para tela morta é inventar superfície.

## 2. Sistema atual de acessos — o diagnóstico

### 2.1 Não existe autenticação verificável

`src/contexts/AdminAuthContext.tsx`:

```ts
if (usuario === 'edienailanches' && password === '1234') { … }
if (usuario === 'dzndev' && password === '1503') { … }
```

Duas senhas **em texto claro dentro do bundle do browser**, herdadas do projeto anterior. Quem abre o DevTools as lê.

`src/components/admin/ProtectedRoute.tsx` deixa passar qualquer coisa:

```ts
if (!token || (!token.startsWith('admin-authenticated-') && !token.startsWith('admin-supabase-')))
```

`localStorage.setItem('adminToken', 'admin-authenticated-x')` = administrador completo. Não há token assinado, não há cookie, não há nada que o servidor possa conferir. **O servidor não tem como saber quem está chamando.**

### 2.2 Hash de senha fraco e legível por qualquer um

`verificar_senha_usuario` compara `encode(digest(senha,'sha256'),'hex')` — SHA-256 **sem salt**. E `anon` tem `SELECT` em `usuarios_sistema`, ou seja, o `senha_hash` sai pela anon key, que é pública. Hash sem salt de senha curta cai em segundos numa rainbow table.

### 2.3 Já existe um esqueleto de permissões — e ele está morto

`src/lib/controle-acesso.ts` (139 linhas) traz um modelo correto: módulo → ações → chave `modulo.acao`, `normalizarPermissoes`, `resolverPermissoes(padrão → papel → usuário)`. É o precedente arquitetural a seguir.

Mas: os módulos são `garcom.pedidos`, `garcom.mesas`, `entregador.entregas` — perfis que **não existem neste projeto** — e as três RPCs que a rota `/api/controle-acesso` chama (`obter_controle_acesso`, `carregar_painel_controle_acesso`, `salvar_controle_acesso`) **não existem no banco**. A rota responde 500 sempre. `ControleAcessoContext` e `GerenciadorPermissoesEquipe` são código morto.

→ **Reusar o padrão, não o conteúdo.**

### 2.4 O que a rota morta acertou

`/api/controle-acesso` reautentica o ator (`nomeUsuario` + `senha`) dentro de uma RPC `SECURITY DEFINER` a cada escrita. É tosco (manda a senha em toda operação), mas é a única autorização *server-side* que o projeto já concebeu. A sessão assinada da §6 substitui isso com a mesma garantia e sem trafegar senha.

## 3. Supabase/Auth atual

| Item | Estado verificado |
|---|---|
| `auth.users` | **0 registros** — Supabase Auth não é usado |
| `usuarios_sistema` | **1 usuário**: `james_fortes`, papel `admin` |
| Papéis existentes | `admin`, `garcom`, `entregador` (coluna `papel varchar`, sem constraint) |
| Tabelas | 30 |
| **Tabelas com RLS** | **0** |
| **Policies** | **0** |
| `anon` com SELECT | **27 de 30** |
| `anon` com DELETE | **27 de 30** |
| Funções `public` | 20 (3 de auth, todas `SECURITY DEFINER`) |

As 3 únicas tabelas fora do alcance de `anon` são `notificacoes*`, fechadas na task da central.

**Consequência:** `auth.uid()` não existe neste banco. Policy de RLS que dependa dele não tem em que se apoiar. RLS só passa a valer depois que existir identidade verificável.

### 3.1 Superfície client-side a proteger

Arquivos `'use client'` que consultam tabela sensível direto pela anon key:

| Tabela | Arquivos client |
|---|---|
| `pedidos` | 28 |
| `produtos` | 17 |
| `itens_pedido` | 16 |
| `pagamentos_pedido` | 10 |
| `usuarios_sistema` | 8 |
| `funcionarios` | 8 |
| `movimentacoes_caixa` | 7 |
| `caixas` / `crediario_movimentos` | 5 cada |
| `usuarios_cliente` | 3 |
| `crediario_contas` | 2 |
| `financas_diarias` | 1 |

Esconder componente não muda nada disso: a chave está no bundle e a tabela está aberta.

## 4. Módulos encontrados → mapa de sensibilidade

`Módulo → Ação → Dado acessado → sensibilidade`

| Módulo | Ação | Dado | Sensibilidade |
|---|---|---|---|
| Dashboard | ver contadores | nº de pedidos, status | **operacional** |
| Dashboard | ver receita | `receitaHoje`, `receitaTotal` | **estratégica** |
| Pedidos | listar / abrir | pedido, cliente, itens | operacional |
| Pedidos | ver valor do pedido | `total` do pedido individual | **operacional** (atendente precisa cobrar) |
| Pedidos | mudar status | `pedidos.status` | operacional |
| Pedidos | cancelar / excluir | `pedidos` | operacional-crítico |
| Novo pedido | criar venda | `pedidos`, `itens_pedido` | operacional |
| Produtos | ver / criar / editar / excluir | `produtos`, `categorias_cardapio` | operacional |
| Produtos | ver custo | `custo_unitario` → margem | **estratégica** |
| Estoque | ver / ajustar | `estoque_quantidade` | operacional |
| Vitrine · Cupons · Bairros · Entregas · Pagamentos | ver / editar | config da loja | operacional |
| Equipe | ver / editar | `funcionarios` (salário?) | **estratégica** se houver remuneração |
| Clientes | ver | `usuarios_cliente` (telefone, endereço) | **pessoal** |
| Acessos | ver / criar / editar / permissões | `usuarios_sistema` | **crítica** |
| Finanças | ver | `financas_diarias`, `movimentacoes_caixa` | **estratégica** |
| Finanças | lançar / editar / excluir | idem | **estratégica** |
| Análise diária · Relatórios | ver | faturamento, ticket médio, lucro | **estratégica** |

A linha que o §3 do pedido exige — **valor operacional ≠ informação estratégica** — cai exatamente entre `pedidos.ver_valor` (o R$ 85,00 de um pedido) e `dashboard.ver_receita` / `financas.ver` / `relatorios.ver` (o R$ 4.580 do dia).

## 5. Matriz de permissões proposta

Chave `modulo.acao`, seguindo `controle-acesso.ts`. Colunas: **A** = Administrador (fixo), **P** = preset Atendente.

| Chave | A | P |
|---|:-:|:-:|
| `dashboard.ver` | ✓ | ✓ |
| `dashboard.ver_receita` | ✓ | — |
| `pedidos.ver` | ✓ | ✓ |
| `pedidos.ver_valor` | ✓ | ✓ |
| `pedidos.criar` | ✓ | ✓ |
| `pedidos.editar` | ✓ | ✓ |
| `pedidos.mudar_status` | ✓ | ✓ |
| `pedidos.cancelar` | ✓ | — |
| `pedidos.excluir` | ✓ | — |
| `produtos.ver` | ✓ | ✓ |
| `produtos.criar` / `.editar` / `.excluir` | ✓ | — |
| `produtos.ver_custo` | ✓ | — |
| `estoque.ver` | ✓ | ✓ |
| `estoque.ajustar` | ✓ | ✓ |
| `vitrine.ver` / `.editar` | ✓ | — |
| `cupons.ver` / `.editar` | ✓ | — |
| `entregas.ver` / `.editar` | ✓ | ✓ / — |
| `bairros.ver` / `.editar` | ✓ | ✓ / — |
| `pagamentos.ver` / `.editar` | ✓ | ✓ / — |
| `clientes.ver` | ✓ | ✓ |
| `clientes.editar` | ✓ | — |
| `equipe.ver` / `.editar` | ✓ | — |
| `financas.ver` / `.criar` / `.editar` / `.excluir` | ✓ | — |
| `relatorios.ver` | ✓ | — |
| `analise.ver` | ✓ | — |
| `acessos.ver` / `.criar` / `.editar` / `.permissoes` / `.excluir` | ✓ | — |

**Invariantes:**
1. `admin` resolve para **todas** as chaves, sempre. Não é linha em tabela que possa ser esvaziada — é retorno fixo da função de resolução, no cliente **e** no banco.
2. Ninguém edita as próprias permissões, nem sendo admin (evita escalonamento e auto-tranca).
3. Só quem tem `acessos.permissoes` altera permissão de terceiro.
4. Último admin ativo não pode ser desativado nem rebaixado.

## 6. Mudanças no banco

```sql
-- papel ganha 'atendente' e vira enum controlado
alter table public.usuarios_sistema
  add constraint usuarios_sistema_papel_check
  check (papel in ('admin','atendente','garcom','entregador'));

-- overrides por usuário; o padrão vem do papel, em código
alter table public.usuarios_sistema
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- invalidação de sessão (ver §8)
alter table public.usuarios_sistema
  add column if not exists permissoes_versao integer not null default 1;

-- auditoria (§13 do pedido)
create table public.acessos_auditoria (
  id uuid primary key default gen_random_uuid(),
  ator_id uuid not null references public.usuarios_sistema(id),
  alvo_id uuid references public.usuarios_sistema(id),
  acao text not null check (acao in ('criado','papel_alterado','permissoes_alteradas','desativado','reativado','senha_alterada')),
  antes jsonb, depois jsonb,
  criado_em timestamptz not null default now()
);
create index acessos_auditoria_alvo_idx on public.acessos_auditoria (alvo_id, criado_em desc);

revoke all on public.acessos_auditoria from anon, authenticated;
revoke select on public.usuarios_sistema from anon, authenticated;  -- senha_hash é público hoje
```

Migração de hash: `crypt(senha, gen_salt('bf'))` com `pgcrypto` (já instalado — `digest` funciona). Rehash transparente no próximo login bem-sucedido; nenhuma senha precisa ser redefinida.

## 7. Estratégia de segurança — as três camadas

| Camada | Papel | Como |
|---|---|---|
| **Sessão** | provar *quem é* | cookie `httpOnly` + `Secure` + `SameSite=Lax`, assinado com HMAC-SHA256 (`node:crypto`, sem dependência nova), com `{usuario_id, permissoes_versao, exp}` |
| **Autorização** | decidir *o que pode* | `exigirPermissao(request, 'financas.ver')` em todo route handler sensível; 403 antes de tocar no banco |
| **Dados** | impedir *o desvio* | consulta sensível sai do cliente e vai para route handler com `service_role`; `anon` perde o grant naquela tabela; RLS entra como `deny all` para `anon` |

**Por que RLS não resolve sozinho aqui:** policy precisa de identidade no banco. Com `auth.users` vazio e todo acesso pela anon key, `auth.uid()` é nulo — a policy só saberia dizer "anon", nunca "qual atendente". Ou se migra tudo para Supabase Auth (§10, opção B), ou o dado sensível passa a trafegar por route handler autorizado e `anon` perde o grant (§10, opção A). Esconder componente com `if (!can(...)) return null` **não é uma das camadas** — é só UX.

## 8. Propagação de mudança de permissão (§12 do pedido)

`permissoes_versao` incrementa quando o admin altera papel ou permissões do usuário. O cookie carrega a versão que tinha no login. A cada request autorizado o servidor compara com a versão atual:

- iguais → segue;
- diferentes → 401 com `motivo: 'permissoes_alteradas'`, o cliente refaz a sessão e recarrega as permissões.

Sem polling. O custo é uma leitura indexada por `id` no mesmo round-trip que a rota já faz.

## 9. Testes (RED antes da implementação)

Domínio puro em `tests/rbac.test.mjs` sobre `src/lib/rbac.mjs` — mesmo padrão de `notificacoes.mjs`:

1. `admin` resolve todas as chaves do catálogo
2. permissão desconhecida é descartada na normalização
3. preset do atendente bate com a matriz da §5
4. override de usuário vence o padrão do papel
5. override não consegue conceder chave fora do catálogo
6. `admin` ignora override que tente remover permissão
7. `podeVerRota('/admin/financas', permissões)` respeita `financas.ver`
8. sidebar filtrada esconde exatamente os grupos sem nenhuma rota permitida
9. `pedidos.ver_valor` e `dashboard.ver_receita` são independentes
10. ninguém edita as próprias permissões
11. usuário inativo resolve para conjunto vazio
12. `permissoes_versao` diferente invalida a sessão

SQL transacional em `tests/rbac-banco.sql` (rollback ao final):

13. atendente sem `financas.ver` não obtém linha de `financas_diarias` pela RPC autorizada
14. `anon` perde `SELECT` em `usuarios_sistema`
15. último admin ativo não pode ser desativado
16. auditoria registra troca de papel com `antes`/`depois`
17. hash migrado para bcrypt continua validando a senha antiga

## 10. 🔴 Decisão de arquitetura pendente (§7 do AGENTS)

O pedido exige segurança real; a base não tem autenticação verificável. As duas saídas honestas:

**Opção A — sessão assinada própria + dado sensível no servidor.** Cookie HMAC, `exigirPermissao` nos route handlers, tabelas sensíveis fechadas para `anon`. Sem dependência nova, casa com o padrão que o projeto já usa (`/api/controle-acesso`, `/api/admin/notificacoes`). Custo: reescrever ~46 consultas client-side das tabelas sensíveis.

**Opção B — migrar para Supabase Auth.** `auth.users` real, JWT do Supabase, RLS com `auth.uid()` de verdade. Mais robusto e é o caminho nativo da plataforma. Custo: recriar todos os usuários, trocar o fluxo de login, e RLS em 30 tabelas com policy por papel — migração grande, e o cardápio público (anon) precisa continuar funcionando.

**Recomendação: A**, por fases, porque entrega segurança real sem parar a loja, e não impede migrar para B depois — a fronteira (`exigirPermissao` no servidor) fica no mesmo lugar nas duas.

**Fases sugeridas:**

| Fase | Entrega | Depende de |
|---|---|---|
| 0 | sessão assinada, fim das senhas hardcoded, bcrypt, `anon` fora de `usuarios_sistema` | decisão |
| 1 | catálogo `rbac.mjs` + testes + `permissoes`/`permissoes_versao`/auditoria no banco | 0 |
| 2 | tela de Acessos: criar/editar atendente, presets, permissões por módulo | 1 |
| 3 | sidebar e rotas filtradas por permissão (UX) | 1 |
| 4 | `exigirPermissao` nos route handlers + Finanças/Relatórios/Análise migrados para o servidor + revogação de `anon` | 1 |
| 5 | Dashboard decomposto (contadores operacionais ≠ receita) | 4 |

Fases 0–3 sem a 4 = permissão só cosmética. **Não entregar 3 sem 4** para os módulos estratégicos.


---

## 11. Estado da implementação

### Entregue e verificado (fases 0 e 1)

| Camada | Arquivo | O que garante |
|---|---|---|
| Domínio | `src/lib/rbac.mjs` + `.d.mts` | catálogo dos 15 módulos, preset do Atendente, resolução em camadas |
| Domínio | `src/lib/sessao-token.mjs` + `.d.mts` | assinatura HMAC-SHA256, expiração, comparação em tempo constante |
| Banco | `supabase/migrations/202608150004_rbac_admin.sql` | bcrypt, `permissoes`, `permissoes_versao`, auditoria, grants por coluna |
| Servidor | `src/lib/server/sessao-admin.ts` | `lerSessao`, `exigirPermissao` |
| Servidor | `src/app/api/admin/sessao/route.ts` | login/logout/quem-sou-eu, cookie `httpOnly` |
| Servidor | `src/app/api/admin/acessos/route.ts` | CRUD de acessos, sempre atrás de `exigirPermissao` |
| Cliente | `AdminAuthContext`, `ProtectedRoute`, `AdminLayout`, login | sessão real, sidebar e rotas por permissão |

**Verificação executada:** 84/84 testes de domínio · 10 cenários SQL transacionais com rollback · ataque de escalonamento pela anon key recusado com `42501` em `papel`, `permissoes` e `senha_hash` · sessão invalidada na hora ao mudar permissão · escrita legítima (avatar) intacta · build ✓ 49 páginas.

### Pendente

| Fase | Falta | Consequência de não fazer |
|---|---|---|
| 2 | Tela de Acessos reconstruída (criar/editar atendente, presets, checkboxes por módulo) | permissão só é editável por SQL |

### Fases 4 e 5 — entregues

| Migration | O que fecha |
|---|---|
| `202608150005_rbac_fechar_financas.sql` | `financas_diarias`, `movimentacoes_caixa`, `caixas`, `categorias_caixa` fora do `anon` + RLS ligada como segunda camada; `obter_lucro_produtos` e `estatisticas_pedidos_periodo` fechadas |
| `202608150006_rbac_fechar_rpcs.sql` | 🔴 correção crítica: 14 funções `SECURITY DEFINER` que continuavam executáveis por `anon` |

Rotas novas: `/api/admin/financas`, `/api/admin/financas/diarias`, `/api/admin/dashboard`.
Migrados para elas: `useFinancas`, `useDiarias`, `dashboard/page.tsx`, e os quatro helpers de `autenticacao.ts`.

**Dashboard (§8 do pedido):** o corte é no servidor. Sem `dashboard.ver_receita`,
os campos de receita não são calculados nem enviados — e ficam **ausentes**, não
zerados, porque faturamento zero é uma informação diferente de "sem acesso".

### 🔴 O bug que quase passou

Todo `revoke ... from anon` escrito nas migrations anteriores era **no-op
silencioso**. Função em Postgres nasce com `EXECUTE` para `PUBLIC`; `anon`
executa por herança, sem grant próprio, e revogar de quem não tem grant não tira
nada nem devolve erro. Resultado: `salvar_acesso_usuario`, `criar_usuario_sistema`
e `atualizar_senha_usuario` — todas `SECURITY DEFINER`, rodando como `postgres` —
seguiam chamáveis com a anon key. **O RBAC inteiro era contornável por uma
requisição REST.** Descoberto ao auditar por `has_function_privilege` em vez de
confiar no texto do revoke.

Regra: para fechar função, revogar de `PUBLIC`. Conferir sempre por
`has_function_privilege('anon', oid, 'EXECUTE')`.

### Ainda aberto

| O quê | Por quê | Risco |
|---|---|---|
| ~~Fase 2 — tela de Acessos~~ | ✅ entregue | — |
| `ajustar_estoque_produto`, `definir_estoque_produto` | tela de Estoque consulta client-side | 🔴 pré-existente: com a anon key dá para zerar estoque |
| `pedidos`, `itens_pedido`, `pagamentos_pedido` | a **loja pública** escreve neles pelo checkout | Relatórios e Análise derivam daí; fechar exige migrar o checkout |
| `crediario_*` | telas de pedido ainda consultam | crediário não está em uso hoje |


---

## 12. Fase 6 — o defeito do `pedidos.excluir`

**Relatado em uso:** atendente com `pedidos.excluir` **desmarcado** conseguia
excluir pedido. Confirmado no banco: o usuário `derick` tinha
`"pedidos.excluir": false` e a exclusão funcionava assim mesmo.

**Causa:** as caixas da tela de Acessos não eram lidas por ninguém. A auditoria
mostrou **zero** telas do Admin chamando `pode()` — os únicos `pode()` do
projeto estavam nos fluxos legados de garçom/entregador, usando o
`controle-acesso.ts` morto. E toda escrita ia direto ao Supabase com a anon key,
que tem grant total em `pedidos`.

Caixa que ninguém lê é pior que caixa ausente: promete um controle que não existe.

### Corrigido

| Ação | Rota (servidor) | UI |
|---|---|---|
| `pedidos.excluir` | `DELETE /api/admin/pedidos` | botão some do cartão e da barra de seleção |
| `pedidos.cancelar` | `PATCH /api/admin/pedidos` (status `cancelado`) | — |
| `pedidos.mudar_status` | `PATCH /api/admin/pedidos` | ações de pagamento/concluir somem |
| `pedidos.editar` | — | botão Editar some |
| `pedidos.ver_valor` | — | valores viram `••••••` no `CardPedido` |
| `estoque.ajustar` | `PATCH /api/admin/estoque` | controles desabilitados |
| `produtos.criar` / `.editar` / `.excluir` | — | botões Novo / Editar / Excluir somem |

### Guarda contra regressão

`tests/rbac-cobertura.test.mjs` varre o código e falha quando uma chave do
catálogo não tem **nenhum** ponto de aplicação. A lista
`SEM_APLICACAO_CONHECIDA` é dívida declarada — some conforme cada tela passa a
checar, e o segundo teste falha se alguém deixar na lista algo que já é aplicado.

### Dívida restante (8 chaves)

`produtos.ver_custo`, `vitrine.editar`, `cupons.editar`, `bairros.editar`,
`entregas.editar`, `pagamentos.editar`, `clientes.editar`, `equipe.editar`.

São telas de configuração cujas escritas ainda vão direto ao Supabase. Enquanto
não tiverem rota autorizada, esconder o botão seria só cosmético — a tabela
continua aberta ao `anon`. Estão declaradas no teste para não sumirem de vista.
