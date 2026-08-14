-- Views públicas usadas pelo sistema.
-- Fonte: pg_get_viewdef via Supabase Management API em 2026-07-28.

set search_path = pg_catalog, public, extensions;

create or replace view public.vw_crediario_contas_resumo as
 SELECT c.id,
    c.cliente_id,
    c.cliente_nome,
    c.telefone,
    c.status,
    c.saldo_atual,
    c.limite_credito,
    c.observacoes,
    c.origem,
    c.legado_id,
    c.criado_em,
    c.atualizado_em,
    c.quitado_em,
    COALESCE(count(m.id) FILTER (WHERE m.status = 'ativo'::text), 0::bigint)::integer AS total_movimentos,
    COALESCE(count(m.id) FILTER (WHERE m.tipo = 'consumo'::text AND m.status = 'ativo'::text), 0::bigint)::integer AS total_consumos,
    COALESCE(count(m.id) FILTER (WHERE m.tipo = 'pagamento'::text AND m.status = 'ativo'::text), 0::bigint)::integer AS total_pagamentos,
    max(m.realizado_em) AS ultimo_movimento_em,
    COALESCE(sum(m.valor) FILTER (WHERE m.tipo = 'consumo'::text AND m.status = 'ativo'::text), 0::numeric)::numeric(12,2) AS total_consumos_valor,
    COALESCE(sum(m.valor) FILTER (WHERE m.tipo = 'pagamento'::text AND m.status = 'ativo'::text), 0::numeric)::numeric(12,2) AS total_pagamentos_valor
   FROM crediario_contas c
     LEFT JOIN crediario_movimentos m ON m.conta_id = c.id
  GROUP BY c.id;;

create or replace view public.vw_usuarios_cliente_metricas as
 SELECT uc.id,
    uc.telefone,
    uc.nome,
    uc.endereco,
    uc.bairro,
    uc.primeiro_pedido_em,
    uc.ultimo_pedido_em,
    uc.created_at,
    uc.updated_at,
    count(p.id)::integer AS total_pedidos,
    count(*) FILTER (WHERE lower(COALESCE(p.status, ''::character varying)::text) <> 'cancelado'::text)::integer AS total_pedidos_validos,
    COALESCE(sum(
        CASE
            WHEN lower(COALESCE(p.status, ''::character varying)::text) <> 'cancelado'::text THEN p.total
            ELSE 0::numeric
        END), 0::numeric)::numeric(12,2) AS total_vendas,
    COALESCE(avg(
        CASE
            WHEN lower(COALESCE(p.status, ''::character varying)::text) <> 'cancelado'::text THEN p.total
            ELSE NULL::numeric
        END), 0::numeric)::numeric(12,2) AS ticket_medio,
    max(p.created_at) AS ultimo_pedido_data
   FROM usuarios_cliente uc
     LEFT JOIN pedidos p ON p.cliente_id = uc.id
  GROUP BY uc.id, uc.telefone, uc.nome, uc.endereco, uc.bairro, uc.primeiro_pedido_em, uc.ultimo_pedido_em, uc.created_at, uc.updated_at;;


