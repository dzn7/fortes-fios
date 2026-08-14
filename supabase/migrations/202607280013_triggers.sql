-- Triggers das tabelas do sistema, sem triggers internos de FK.
-- Fonte: pg_get_triggerdef via Supabase Management API em 2026-07-28.

set search_path = pg_catalog, public, extensions;

CREATE TRIGGER update_adicionais_updated_at BEFORE UPDATE ON adicionais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_atualizar_updated_at_bairros BEFORE UPDATE ON bairros FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at_bairros();
CREATE TRIGGER update_bebidas_updated_at BEFORE UPDATE ON bebidas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caixa_automacao_config_updated_at BEFORE UPDATE ON caixa_automacao_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categorias_adicionais_updated_at BEFORE UPDATE ON categorias_adicionais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER atualizar_categorias_cardapio_updated_at BEFORE UPDATE ON categorias_cardapio FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at_categorias_cardapio();
CREATE TRIGGER trigger_combos_updated_at BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at_combos();
CREATE TRIGGER trigger_touch_crediario_conta BEFORE UPDATE ON crediario_contas FOR EACH ROW EXECUTE FUNCTION touch_crediario_conta();
CREATE TRIGGER trigger_atualizar_saldo_crediario_movimento AFTER INSERT OR DELETE OR UPDATE ON crediario_movimentos FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_crediario_movimento();
CREATE TRIGGER trigger_preparar_cupom_para_persistencia BEFORE INSERT OR UPDATE ON cupons FOR EACH ROW EXECUTE FUNCTION preparar_cupom_para_persistencia();
CREATE TRIGGER trigger_sincronizar_total_usos_cupom AFTER INSERT OR DELETE OR UPDATE ON cupons_usos FOR EACH ROW EXECUTE FUNCTION sincronizar_total_usos_cupom();
CREATE TRIGGER trg_aplicar_configuracao_automatica_fila_impressao BEFORE INSERT ON fila_impressao FOR EACH ROW EXECUTE FUNCTION aplicar_configuracao_automatica_fila_impressao();
CREATE TRIGGER trg_popular_snapshot_fila_impressao BEFORE INSERT ON fila_impressao FOR EACH ROW EXECUTE FUNCTION fn_popular_snapshot_fila_impressao();
CREATE TRIGGER trg_proteger_retorno_fila_impressao_automatica BEFORE UPDATE OF status ON fila_impressao FOR EACH ROW EXECUTE FUNCTION proteger_retorno_fila_impressao_automatica();
CREATE TRIGGER update_formas_pagamento_updated_at BEFORE UPDATE ON formas_pagamento FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_atualizar_snapshot_itens AFTER INSERT ON itens_pedido FOR EACH ROW EXECUTE FUNCTION fn_atualizar_snapshot_itens_fila();
CREATE TRIGGER trigger_sincronizar_itens_pedido_crediario AFTER INSERT OR DELETE OR UPDATE ON itens_pedido FOR EACH ROW EXECUTE FUNCTION sincronizar_itens_pedido_crediario();
CREATE TRIGGER trigger_sync_item_columns BEFORE INSERT ON itens_pedido FOR EACH ROW EXECUTE FUNCTION sync_item_columns();
CREATE TRIGGER trigger_sync_item_columns_update BEFORE UPDATE ON itens_pedido FOR EACH ROW EXECUTE FUNCTION sync_item_columns();
CREATE TRIGGER trigger_update_mesas_updated_at BEFORE UPDATE ON mesas FOR EACH ROW EXECUTE FUNCTION update_mesas_updated_at();
CREATE TRIGGER trigger_update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_notification_preferences_updated_at();
CREATE TRIGGER update_pagamentos_online_updated_at BEFORE UPDATE ON pagamentos_online FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_electron_manter_preparando BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_electron_manter_preparando();
CREATE TRIGGER trg_electron_status BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_electron_status_preparando();
CREATE TRIGGER trg_fila_impressao_auto AFTER INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_fila_impressao_auto();
CREATE TRIGGER trg_fila_impressao_electron_confirmado AFTER UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION fn_fila_impressao_electron_confirmado();
CREATE TRIGGER trigger_gerar_numero_pedido BEFORE INSERT ON pedidos FOR EACH ROW WHEN (new.numero_pedido IS NULL) EXECUTE FUNCTION gerar_numero_pedido();
CREATE TRIGGER trigger_limpar_dados_pedido BEFORE DELETE ON pedidos FOR EACH ROW EXECUTE FUNCTION limpar_dados_pedido_excluido();
CREATE TRIGGER trigger_sincronizar_pedido_crediario AFTER INSERT OR UPDATE OF forma_pagamento, total, status, nome_cliente, telefone, cliente_id ON pedidos FOR EACH ROW EXECUTE FUNCTION sincronizar_pedido_crediario();
CREATE TRIGGER trigger_sync_pedidos_caixa_rt AFTER INSERT OR UPDATE OF status, total, forma_pagamento, nome_cliente ON pedidos FOR EACH ROW EXECUTE FUNCTION sync_pedido_caixa_em_tempo_real();
CREATE TRIGGER trigger_vincular_pedido_usuario_cliente BEFORE INSERT OR UPDATE OF telefone, nome_cliente ON pedidos FOR EACH ROW EXECUTE FUNCTION vincular_pedido_usuario_cliente();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_touch_usuarios_cliente_updated_at BEFORE UPDATE ON usuarios_cliente FOR EACH ROW EXECUTE FUNCTION touch_usuarios_cliente_updated_at();
CREATE TRIGGER trigger_usuarios_sistema_updated_at BEFORE UPDATE ON usuarios_sistema FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


