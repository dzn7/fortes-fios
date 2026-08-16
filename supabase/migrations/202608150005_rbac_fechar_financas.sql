-- RBAC fase 4: o dado financeiro sai do alcance da anon key.
-- Spec: specs/rbac-admin.md §10, fase 4
--
-- Até aqui, esconder "Finanças" da sidebar era teatro. A anon key vai no bundle
-- da LOJA PÚBLICA, então saldo, despesa, salário, diária e lucro estavam a uma
-- requisição REST de distância de qualquer pessoa na internet — a exposição
-- nunca dependeu de um funcionário curioso saber usar DevTools.
--
-- Depois desta migration, essas tabelas só são alcançáveis por `service_role`,
-- e as rotas que as usam (`/api/admin/financas`, `/api/admin/dashboard`)
-- exigem `financas.ver` / `dashboard.ver_receita` antes de consultar.
--
-- 🔴 CONSEQUÊNCIA CONHECIDA: as telas legadas `/admin/caixa`,
-- `/admin/caixa/saldos`, `/admin/caixa/relatorios` e `/admin/anos-anteriores`
-- consultam estas tabelas direto pelo cliente e vão passar a receber 42501.
-- Todas estão FORA do menu (`ROTAS_ADMIN_OCULTAS_AJUDA`) e várias já dependem
-- de tabelas que não existem neste banco (PRD §Legado). Reativar qualquer uma
-- delas exige migrar suas consultas para route handler, como foi feito com
-- `useFinancas` e `useDiarias`.

set search_path = pg_catalog, public, extensions;

-- ---------------------------------------------------------------------------
-- Tabelas financeiras: só service_role
-- ---------------------------------------------------------------------------

revoke all on public.financas_diarias from anon, authenticated;
revoke all on public.movimentacoes_caixa from anon, authenticated;
revoke all on public.caixas from anon, authenticated;
revoke all on public.categorias_caixa from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs que devolvem número estratégico
--
-- `obter_lucro_produtos` expõe custo e margem por produto;
-- `estatisticas_pedidos_periodo` expõe o faturamento agregado. Fechar a tabela
-- e deixar a função aberta seria deixar a porta dos fundos destrancada.
--
-- ⚠️ Revogar de `anon` NÃO resolve: função nasce com `EXECUTE` para `PUBLIC`
-- (o `=X/postgres` no `proacl`), e `anon` executa por herança, sem grant
-- próprio. Revogar de quem não tem grant explícito é no-op silencioso — a
-- chamada continua respondendo 200. Quem precisa perder é o `PUBLIC`.
-- ---------------------------------------------------------------------------

revoke all on function public.obter_lucro_produtos(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.estatisticas_pedidos_periodo(timestamptz, timestamptz)
  from public, anon, authenticated;

-- Devolve explicitamente a quem precisa: as rotas usam service_role.
grant execute on function public.obter_lucro_produtos(timestamptz, timestamptz)
  to service_role;
grant execute on function public.estatisticas_pedidos_periodo(timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS como segunda camada
--
-- Habilitar RLS sem policy nenhuma nega tudo para qualquer role que não seja
-- dono da tabela nem `bypassrls`. `service_role` tem BYPASSRLS, então as rotas
-- seguem funcionando. É cinto além do suspensório: se um GRANT for reintroduzido
-- por engano numa migration futura, a tabela continua fechada.
-- ---------------------------------------------------------------------------

alter table public.financas_diarias enable row level security;
alter table public.movimentacoes_caixa enable row level security;
alter table public.caixas enable row level security;
alter table public.categorias_caixa enable row level security;
