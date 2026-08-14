#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const OLD_TOKEN = process.env.OLD_TOKEN;
const NEW_TOKEN = process.env.NEW_TOKEN;
const OLD_REF = process.env.OLD_REF || "azqnyluvhgqxjrpxylne";
const NEW_REF = process.env.NEW_REF || "bawysvqqeqwxasmggfcn";

if (!OLD_TOKEN || !NEW_TOKEN) {
  console.error("Missing OLD_TOKEN or NEW_TOKEN.");
  process.exit(1);
}

async function api(token, ref, sql, readOnly = true) {
  const response = await fetch(
    `${API_BASE}/v1/projects/${ref}/database/query${readOnly ? "/read-only" : ""}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }
  return payload;
}

async function main() {
  const [
    oldSummary,
    oldSamples,
    oldOrderItemsSummary,
    newMissingSummary,
    newMissingSamples,
  ] = await Promise.all([
    api(OLD_TOKEN, OLD_REF, `
      select
        count(*)::int as movimentos,
        count(*) filter (where order_id is not null)::int as com_order_id,
        count(*) filter (where nullif(items_consumed, '') is not null)::int as com_items_consumed,
        count(*) filter (where nullif(items_consumed, '') is null and order_id is not null)::int as sem_items_com_order_id
      from public.crediario_history
      where type::text = 'consumption';
    `),
    api(OLD_TOKEN, OLD_REF, `
      select
        h.id,
        h.crediario_id,
        h.order_id,
        h.amount::numeric(12,2) as amount,
        h.description,
        h.items_consumed,
        o.items as order_items_json,
        count(oi.id)::int as order_items_rows
      from public.crediario_history h
      left join public.orders o on o.id = h.order_id
      left join public.order_items oi on oi.order_id = h.order_id::text
      where h.type::text = 'consumption'
        and h.order_id is not null
      group by h.id, h.crediario_id, h.order_id, h.amount, h.description, h.items_consumed, o.items
      order by h.date desc
      limit 12;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select
        count(distinct h.id)::int as movimentos_com_order_id,
        count(oi.id)::int as itens_order_items,
        count(*) filter (where o.items is not null and jsonb_array_length(o.items) > 0)::int as movimentos_com_orders_items
      from public.crediario_history h
      left join public.orders o on o.id = h.order_id
      left join public.order_items oi on oi.order_id = h.order_id::text
      where h.type::text = 'consumption'
        and h.order_id is not null;
    `),
    api(NEW_TOKEN, NEW_REF, `
      select
        count(*)::int as movimentos_legado_consumo,
        count(*) filter (where legado_order_id is not null)::int as com_legado_order_id,
        count(*) filter (where itens is null or itens = '[]'::jsonb)::int as sem_itens,
        count(*) filter (where legado_order_id is not null and (itens is null or itens = '[]'::jsonb))::int as sem_itens_com_order_id
      from public.crediario_movimentos
      where origem = 'migracao_edienai_antigo'
        and tipo = 'consumo'
        and status = 'ativo';
    `),
    api(NEW_TOKEN, NEW_REF, `
      select
        id,
        legado_id,
        legado_order_id,
        valor::numeric(12,2) as valor,
        descricao,
        itens,
        realizado_em
      from public.crediario_movimentos
      where origem = 'migracao_edienai_antigo'
        and tipo = 'consumo'
        and status = 'ativo'
        and legado_order_id is not null
        and (itens is null or itens = '[]'::jsonb)
      order by realizado_em desc
      limit 12;
    `),
  ]);

  console.log(JSON.stringify({
    oldSummary: oldSummary[0],
    oldOrderItemsSummary: oldOrderItemsSummary[0],
    oldSamples,
    newMissingSummary: newMissingSummary[0],
    newMissingSamples,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
