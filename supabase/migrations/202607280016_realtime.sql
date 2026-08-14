-- Membership do Realtime das 34 tabelas do sistema atualmente publicadas.
-- Tabelas históricas, produtividade, diárias e objetos WhatsApp permanecem fora.
-- Fonte: Supabase Management API em 2026-07-28.

set search_path = pg_catalog, public, extensions;

do $migration$
declare
  target_table text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime with (publish = ''insert, update, delete, truncate'')';
  end if;

  execute 'alter publication supabase_realtime set (publish = ''insert, update, delete, truncate'')';

  foreach target_table in array array['adicionais', 'anotacoes_painel', 'atividade_garcom', 'bairros', 'bebidas', 'caixa_automacao_config', 'caixas', 'categorias_adicionais', 'categorias_caixa', 'categorias_cardapio', 'combo_itens', 'combos', 'configuracoes_loja', 'crediario_contas', 'crediario_movimentos', 'cupons', 'cupons_usos', 'entregas', 'fila_impressao', 'formas_pagamento', 'funcionarios', 'item_adicionais', 'itens_pedido', 'mesas', 'movimentacoes_caixa', 'notification_preferences', 'pagamentos_entregadores', 'pagamentos_online', 'pagamentos_pedido', 'pedidos', 'produto_adicionais', 'produtos', 'usuarios_cliente', 'usuarios_sistema'] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_rel pr
      join pg_catalog.pg_publication p on p.oid = pr.prpubid
      join pg_catalog.pg_class c on c.oid = pr.prrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end
$migration$;


