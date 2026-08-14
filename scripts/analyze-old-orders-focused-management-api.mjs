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
    }
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }
  return payload;
}

function columnQuery(tableNames) {
  return `
    select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = any(array[${tableNames.map((name) => `'${name}'`).join(",")}])
    order by table_name, ordinal_position;
  `;
}

async function main() {
  const oldTables = [
    "orders",
    "order_items",
    "order_events",
    "clientes",
    "users",
    "products",
    "combos",
    "complements",
  ];
  const newTables = [
    "pedidos",
    "itens_pedido",
    "item_adicionais",
    "usuarios_cliente",
    "produtos",
    "bebidas",
    "combos",
    "adicionais",
    "pagamentos_pedido",
    "entregas",
  ];

  const [
    oldColumns,
    newColumns,
    orderCounts,
    orderStatusCounts,
    orderPaymentCounts,
    orderTypeCounts,
    orderItemsCount,
    orderItemsSample,
    ordersSample,
  ] = await Promise.all([
    api(OLD_TOKEN, OLD_REF, columnQuery(oldTables)),
    api(NEW_TOKEN, NEW_REF, columnQuery(newTables)),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select
          count(*)::int as total_2026,
          min(created_at) as first_created_at,
          max(created_at) as last_created_at
        from public.orders
        where created_at >= '2026-01-01'::timestamptz
          and created_at < '2027-01-01'::timestamptz;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select coalesce(status::text, '<null>') as status, count(*)::int as count
        from public.orders
        where created_at >= '2026-01-01'::timestamptz
          and created_at < '2027-01-01'::timestamptz
        group by 1
        order by count desc, status;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select coalesce(payment_method::text, '<null>') as payment_method, count(*)::int as count
        from public.orders
        where created_at >= '2026-01-01'::timestamptz
          and created_at < '2027-01-01'::timestamptz
        group by 1
        order by count desc, payment_method;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select
          coalesce(
            delivery_option->>'tipo',
            delivery_option->>'type',
            delivery_option->>'id',
            delivery_option->>'name',
            '<null>'
          ) as delivery_type,
          count(*)::int as count
        from public.orders
        where created_at >= '2026-01-01'::timestamptz
          and created_at < '2027-01-01'::timestamptz
        group by 1
        order by count desc, delivery_type;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select count(*)::int as items_2026
        from public.order_items oi
        join public.orders o on o.id::text = oi.order_id::text
        where o.created_at >= '2026-01-01'::timestamptz
          and o.created_at < '2027-01-01'::timestamptz;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select oi.*
        from public.order_items oi
        join public.orders o on o.id::text = oi.order_id::text
        where o.created_at >= '2026-01-01'::timestamptz
          and o.created_at < '2027-01-01'::timestamptz
        order by o.created_at asc
        limit 5;
      `
    ),
    api(
      OLD_TOKEN,
      OLD_REF,
      `
        select *
        from public.orders
        where created_at >= '2026-01-01'::timestamptz
          and created_at < '2027-01-01'::timestamptz
        order by created_at asc
        limit 5;
      `
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        old: {
          ref: OLD_REF,
          columns: oldColumns,
          orderCounts: orderCounts[0],
          orderStatusCounts,
          orderPaymentCounts,
          orderTypeCounts,
          orderItemsCount: orderItemsCount[0],
          ordersSample,
          orderItemsSample,
        },
        new: {
          ref: NEW_REF,
          columns: newColumns,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
