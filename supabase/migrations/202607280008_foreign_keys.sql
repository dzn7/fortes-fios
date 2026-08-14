-- Chaves estrangeiras, aplicadas após os índices.
-- Fonte: Supabase Management API em 2026-07-28.

set search_path = pg_catalog, public, extensions;

alter table public.adicionais add constraint adicionais_categoria_fkey FOREIGN KEY (categoria) REFERENCES categorias_adicionais(nome) ON UPDATE CASCADE ON DELETE SET NULL;
alter table public.admin_sidebar_config add constraint admin_sidebar_config_usuario_sistema_id_fkey FOREIGN KEY (usuario_sistema_id) REFERENCES usuarios_sistema(id) ON DELETE CASCADE;
alter table public.atividade_garcom add constraint atividade_garcom_garcom_id_fkey FOREIGN KEY (garcom_id) REFERENCES usuarios_sistema(id) ON DELETE CASCADE;
alter table public.atividade_garcom add constraint atividade_garcom_item_pedido_id_fkey FOREIGN KEY (item_pedido_id) REFERENCES itens_pedido(id) ON DELETE SET NULL;
alter table public.atividade_garcom add constraint atividade_garcom_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
alter table public.combo_itens add constraint combo_itens_bebida_id_fkey FOREIGN KEY (bebida_id) REFERENCES bebidas(id) ON DELETE SET NULL;
alter table public.combo_itens add constraint combo_itens_combo_id_fkey FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE;
alter table public.combo_itens add constraint combo_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;
alter table public.crediario_contas add constraint crediario_contas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES usuarios_cliente(id) ON DELETE SET NULL;
alter table public.crediario_movimentos add constraint crediario_movimentos_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES crediario_contas(id) ON DELETE CASCADE;
alter table public.crediario_movimentos add constraint crediario_movimentos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
alter table public.cupons add constraint cupons_combo_id_fkey FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE SET NULL;
alter table public.cupons add constraint cupons_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;
alter table public.cupons_usos add constraint cupons_usos_cupom_id_fkey FOREIGN KEY (cupom_id) REFERENCES cupons(id) ON DELETE CASCADE;
alter table public.cupons_usos add constraint cupons_usos_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.entregas add constraint entregas_entregador_id_fkey FOREIGN KEY (entregador_id) REFERENCES funcionarios(id) ON DELETE SET NULL;
alter table public.entregas add constraint entregas_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.fila_impressao add constraint fila_impressao_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.financas_diarias add constraint financas_diarias_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL;
alter table public.financas_diarias add constraint financas_diarias_movimentacao_id_fkey FOREIGN KEY (movimentacao_id) REFERENCES movimentacoes_caixa(id) ON DELETE CASCADE;
alter table public.historico_entregas add constraint historico_entregas_historico_pedido_id_fkey FOREIGN KEY (historico_pedido_id) REFERENCES historico_pedidos(id) ON DELETE SET NULL;
alter table public.historico_item_adicionais add constraint historico_item_adicionais_historico_item_id_fkey FOREIGN KEY (historico_item_id) REFERENCES historico_itens_pedido(id) ON DELETE CASCADE;
alter table public.historico_itens_pedido add constraint historico_itens_pedido_historico_pedido_id_fkey FOREIGN KEY (historico_pedido_id) REFERENCES historico_pedidos(id) ON DELETE CASCADE;
alter table public.item_adicionais add constraint item_adicionais_adicional_id_fkey FOREIGN KEY (adicional_id) REFERENCES adicionais(id) ON DELETE SET NULL;
alter table public.item_adicionais add constraint item_adicionais_item_pedido_id_fkey FOREIGN KEY (item_pedido_id) REFERENCES itens_pedido(id) ON DELETE CASCADE;
alter table public.itens_pedido add constraint itens_pedido_adicionado_por_garcom_id_fkey FOREIGN KEY (adicionado_por_garcom_id) REFERENCES usuarios_sistema(id) ON DELETE SET NULL;
alter table public.itens_pedido add constraint itens_pedido_bebida_id_fkey FOREIGN KEY (bebida_id) REFERENCES bebidas(id) ON DELETE SET NULL;
alter table public.itens_pedido add constraint itens_pedido_combo_id_fkey FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE SET NULL;
alter table public.itens_pedido add constraint itens_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.itens_pedido add constraint itens_pedido_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL;
alter table public.mesas add constraint mesas_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id);
alter table public.movimentacoes_caixa add constraint movimentacoes_caixa_caixa_id_fkey FOREIGN KEY (caixa_id) REFERENCES caixas(id) ON DELETE CASCADE;
alter table public.movimentacoes_caixa add constraint movimentacoes_caixa_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias_caixa(id) ON DELETE SET NULL;
alter table public.movimentacoes_caixa add constraint movimentacoes_caixa_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL;
alter table public.movimentacoes_caixa add constraint movimentacoes_caixa_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
alter table public.pagamentos_entregadores add constraint pagamentos_entregadores_entregador_id_fkey FOREIGN KEY (entregador_id) REFERENCES funcionarios(id) ON DELETE CASCADE;
alter table public.pagamentos_online add constraint pagamentos_online_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.pagamentos_pedido add constraint pagamentos_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE;
alter table public.pedidos add constraint pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES usuarios_cliente(id) ON DELETE SET NULL;
alter table public.pedidos add constraint pedidos_cupom_id_fkey FOREIGN KEY (cupom_id) REFERENCES cupons(id) ON DELETE SET NULL;
alter table public.pedidos add constraint pedidos_garcom_id_fkey FOREIGN KEY (garcom_id) REFERENCES usuarios_sistema(id) ON DELETE SET NULL;
alter table public.pedidos add constraint pedidos_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES mesas(id) ON DELETE SET NULL;
alter table public.produto_adicionais add constraint produto_adicionais_adicional_id_fkey FOREIGN KEY (adicional_id) REFERENCES adicionais(id) ON DELETE CASCADE;
alter table public.produto_adicionais add constraint produto_adicionais_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE;
alter table public.usuarios_sistema add constraint usuarios_sistema_funcionario_id_fkey FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id) ON DELETE SET NULL;


