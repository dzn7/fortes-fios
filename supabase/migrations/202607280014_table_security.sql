-- Estado de RLS/policies e privilégios de tabelas/views reproduzido do catálogo.
-- ATENÇÃO: anon/authenticated permanecem amplos para compatibilidade com o front atual.
-- Fonte: Supabase Management API em 2026-07-28.

set search_path = pg_catalog, public, extensions;

revoke all privileges on schema public from public, anon, authenticated, service_role;
grant usage on schema public to public, anon, authenticated, service_role;

revoke all privileges on table
  public.adicionais,
  public.admin_sidebar_config,
  public.anotacoes_painel,
  public.atividade_garcom,
  public.bairros,
  public.bebidas,
  public.caixa_automacao_config,
  public.caixas,
  public.categorias_adicionais,
  public.categorias_caixa,
  public.categorias_cardapio,
  public.combo_itens,
  public.combos,
  public.configuracoes_loja,
  public.crediario_contas,
  public.crediario_movimentos,
  public.cupons,
  public.cupons_usos,
  public.entregas,
  public.fila_impressao,
  public.financas_diarias,
  public.formas_pagamento,
  public.funcionarios,
  public.historico_caixas,
  public.historico_entregas,
  public.historico_item_adicionais,
  public.historico_itens_pedido,
  public.historico_movimentacoes_caixa,
  public.historico_pedidos,
  public.item_adicionais,
  public.itens_pedido,
  public.mesas,
  public.movimentacoes_caixa,
  public.notification_preferences,
  public.pagamentos_entregadores,
  public.pagamentos_online,
  public.pagamentos_pedido,
  public.pedidos,
  public.produtividade_config,
  public.produto_adicionais,
  public.produtos,
  public.resumo_anual,
  public.usuarios_cliente,
  public.usuarios_sistema,
  public.vw_crediario_contas_resumo,
  public.vw_usuarios_cliente_metricas
from public, anon, authenticated, service_role;

grant all privileges on table
  public.adicionais,
  public.admin_sidebar_config,
  public.anotacoes_painel,
  public.atividade_garcom,
  public.bairros,
  public.bebidas,
  public.caixa_automacao_config,
  public.caixas,
  public.categorias_adicionais,
  public.categorias_caixa,
  public.categorias_cardapio,
  public.combo_itens,
  public.combos,
  public.configuracoes_loja,
  public.crediario_contas,
  public.crediario_movimentos,
  public.cupons,
  public.cupons_usos,
  public.entregas,
  public.fila_impressao,
  public.financas_diarias,
  public.formas_pagamento,
  public.funcionarios,
  public.historico_caixas,
  public.historico_entregas,
  public.historico_item_adicionais,
  public.historico_itens_pedido,
  public.historico_movimentacoes_caixa,
  public.historico_pedidos,
  public.item_adicionais,
  public.itens_pedido,
  public.mesas,
  public.movimentacoes_caixa,
  public.notification_preferences,
  public.pagamentos_entregadores,
  public.pagamentos_online,
  public.pagamentos_pedido,
  public.pedidos,
  public.produto_adicionais,
  public.produtos,
  public.resumo_anual,
  public.usuarios_cliente,
  public.usuarios_sistema,
  public.vw_crediario_contas_resumo,
  public.vw_usuarios_cliente_metricas
to anon, authenticated;

grant all privileges on table
  public.adicionais,
  public.admin_sidebar_config,
  public.anotacoes_painel,
  public.atividade_garcom,
  public.bairros,
  public.bebidas,
  public.caixa_automacao_config,
  public.caixas,
  public.categorias_adicionais,
  public.categorias_caixa,
  public.categorias_cardapio,
  public.combo_itens,
  public.combos,
  public.configuracoes_loja,
  public.crediario_contas,
  public.crediario_movimentos,
  public.cupons,
  public.cupons_usos,
  public.entregas,
  public.fila_impressao,
  public.financas_diarias,
  public.formas_pagamento,
  public.funcionarios,
  public.historico_caixas,
  public.historico_entregas,
  public.historico_item_adicionais,
  public.historico_itens_pedido,
  public.historico_movimentacoes_caixa,
  public.historico_pedidos,
  public.item_adicionais,
  public.itens_pedido,
  public.mesas,
  public.movimentacoes_caixa,
  public.notification_preferences,
  public.pagamentos_entregadores,
  public.pagamentos_online,
  public.pagamentos_pedido,
  public.pedidos,
  public.produtividade_config,
  public.produto_adicionais,
  public.produtos,
  public.resumo_anual,
  public.usuarios_cliente,
  public.usuarios_sistema,
  public.vw_crediario_contas_resumo,
  public.vw_usuarios_cliente_metricas
to service_role;

alter table public.adicionais disable row level security;
alter table public.adicionais no force row level security;
alter table public.admin_sidebar_config disable row level security;
alter table public.admin_sidebar_config no force row level security;
alter table public.anotacoes_painel disable row level security;
alter table public.anotacoes_painel no force row level security;
alter table public.atividade_garcom disable row level security;
alter table public.atividade_garcom no force row level security;
alter table public.bairros disable row level security;
alter table public.bairros no force row level security;
alter table public.bebidas disable row level security;
alter table public.bebidas no force row level security;
alter table public.caixa_automacao_config disable row level security;
alter table public.caixa_automacao_config no force row level security;
alter table public.caixas disable row level security;
alter table public.caixas no force row level security;
alter table public.categorias_adicionais disable row level security;
alter table public.categorias_adicionais no force row level security;
alter table public.categorias_caixa disable row level security;
alter table public.categorias_caixa no force row level security;
alter table public.categorias_cardapio disable row level security;
alter table public.categorias_cardapio no force row level security;
alter table public.combo_itens disable row level security;
alter table public.combo_itens no force row level security;
alter table public.combos disable row level security;
alter table public.combos no force row level security;
alter table public.configuracoes_loja disable row level security;
alter table public.configuracoes_loja no force row level security;
alter table public.crediario_contas disable row level security;
alter table public.crediario_contas no force row level security;
alter table public.crediario_movimentos disable row level security;
alter table public.crediario_movimentos no force row level security;
alter table public.cupons disable row level security;
alter table public.cupons no force row level security;
alter table public.cupons_usos disable row level security;
alter table public.cupons_usos no force row level security;
alter table public.entregas disable row level security;
alter table public.entregas no force row level security;
alter table public.fila_impressao disable row level security;
alter table public.fila_impressao no force row level security;
alter table public.financas_diarias disable row level security;
alter table public.financas_diarias no force row level security;
alter table public.formas_pagamento disable row level security;
alter table public.formas_pagamento no force row level security;
alter table public.funcionarios disable row level security;
alter table public.funcionarios no force row level security;
alter table public.historico_caixas disable row level security;
alter table public.historico_caixas no force row level security;
alter table public.historico_entregas disable row level security;
alter table public.historico_entregas no force row level security;
alter table public.historico_item_adicionais disable row level security;
alter table public.historico_item_adicionais no force row level security;
alter table public.historico_itens_pedido disable row level security;
alter table public.historico_itens_pedido no force row level security;
alter table public.historico_movimentacoes_caixa disable row level security;
alter table public.historico_movimentacoes_caixa no force row level security;
alter table public.historico_pedidos disable row level security;
alter table public.historico_pedidos no force row level security;
alter table public.item_adicionais disable row level security;
alter table public.item_adicionais no force row level security;
alter table public.itens_pedido disable row level security;
alter table public.itens_pedido no force row level security;
alter table public.mesas disable row level security;
alter table public.mesas no force row level security;
alter table public.movimentacoes_caixa disable row level security;
alter table public.movimentacoes_caixa no force row level security;
alter table public.notification_preferences disable row level security;
alter table public.notification_preferences no force row level security;
alter table public.pagamentos_entregadores disable row level security;
alter table public.pagamentos_entregadores no force row level security;
alter table public.pagamentos_online disable row level security;
alter table public.pagamentos_online no force row level security;
alter table public.pagamentos_pedido disable row level security;
alter table public.pagamentos_pedido no force row level security;
alter table public.pedidos disable row level security;
alter table public.pedidos no force row level security;
alter table public.produtividade_config disable row level security;
alter table public.produtividade_config no force row level security;
alter table public.produto_adicionais disable row level security;
alter table public.produto_adicionais no force row level security;
alter table public.produtos disable row level security;
alter table public.produtos no force row level security;
alter table public.resumo_anual disable row level security;
alter table public.resumo_anual no force row level security;
alter table public.usuarios_cliente disable row level security;
alter table public.usuarios_cliente no force row level security;
alter table public.usuarios_sistema disable row level security;
alter table public.usuarios_sistema no force row level security;

create policy produto_adicionais_select on public.produto_adicionais as permissive for select to public using (true);
create policy usuarios_sistema_delete on public.usuarios_sistema as permissive for delete to public using (true);
create policy usuarios_sistema_insert on public.usuarios_sistema as permissive for insert to public with check (true);
create policy usuarios_sistema_select on public.usuarios_sistema as permissive for select to public using (true);
create policy usuarios_sistema_update on public.usuarios_sistema as permissive for update to public using (true);

alter default privileges for role postgres in schema public revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all privileges on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant select, update, usage on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;

