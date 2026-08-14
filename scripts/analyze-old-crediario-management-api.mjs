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

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const KEYWORDS = [
  "credi",
  "fiado",
  "conta",
  "debit",
  "debito",
  "débito",
  "divida",
  "dívida",
  "receber",
];

function keywordPredicate(aliasTable = "t", aliasColumn = "c") {
  return KEYWORDS.map((keyword) => {
    const escaped = keyword.replaceAll("'", "''");
    return `lower(${aliasTable}.table_name) like '%${escaped}%' or lower(${aliasColumn}.column_name) like '%${escaped}%'`;
  }).join(" or ");
}

async function listMatchingColumns(token, ref) {
  return api(token, ref, `
    select
      t.table_name,
      c.column_name,
      c.ordinal_position,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default
    from information_schema.tables t
    join information_schema.columns c
      on c.table_schema = t.table_schema
     and c.table_name = t.table_name
    where t.table_schema = 'public'
      and (${keywordPredicate("t", "c")})
    order by t.table_name, c.ordinal_position;
  `);
}

async function tableCounts(token, ref, tableNames) {
  const counts = [];
  for (const tableName of tableNames) {
    const rows = await api(token, ref, `
      select count(*)::int as total
      from public.${quoteIdent(tableName)};
    `);
    counts.push({ table_name: tableName, total: rows[0]?.total || 0 });
  }
  return counts;
}

async function tableSamples(token, ref, tableNames) {
  const samples = {};
  for (const tableName of tableNames) {
    const rows = await api(token, ref, `
      select *
      from public.${quoteIdent(tableName)}
      order by 1 desc
      limit 5;
    `);

    samples[tableName] = rows.map((record) => (
      Object.fromEntries(
        Object.entries(record).map(([key, value]) => {
          if (typeof value === "string" && value.length > 120) {
            return [key, `${value.slice(0, 120)}...`];
          }
          return [key, value];
        }),
      )
    ));
  }
  return samples;
}

async function main() {
  const [oldColumns, newColumns, oldPaymentMethods, oldOrderColumns, newOrderColumns] = await Promise.all([
    listMatchingColumns(OLD_TOKEN, OLD_REF),
    listMatchingColumns(NEW_TOKEN, NEW_REF),
    api(OLD_TOKEN, OLD_REF, `
      select coalesce(payment_method::text, '<null>') as payment_method, count(*)::int as total
      from public.orders
      group by 1
      order by total desc, payment_method;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any(array['orders', 'order_items', 'clientes', 'users'])
      order by table_name, ordinal_position;
    `),
    api(NEW_TOKEN, NEW_REF, `
      select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any(array['pedidos', 'itens_pedido', 'pagamentos_pedido', 'usuarios_cliente'])
      order by table_name, ordinal_position;
    `),
  ]);

  const oldTableNames = [...new Set(oldColumns.map((row) => row.table_name))];
  const newTableNames = [...new Set(newColumns.map((row) => row.table_name))];

  const [oldCounts, newCounts, oldSamples] = await Promise.all([
    tableCounts(OLD_TOKEN, OLD_REF, oldTableNames),
    tableCounts(NEW_TOKEN, NEW_REF, newTableNames),
    tableSamples(OLD_TOKEN, OLD_REF, oldTableNames.filter((table) => table !== "orders").slice(0, 12)),
  ]);

  const creditOrders = await api(OLD_TOKEN, OLD_REF, `
    select
      count(*)::int as total,
      min(created_at) as primeiro,
      max(created_at) as ultimo,
      coalesce(sum(total), 0)::numeric(12,2) as valor_total
    from public.orders
    where lower(coalesce(payment_method::text, '')) like any(array['%credi%', '%fiado%', '%conta%']);
  `);

  const creditOrderStatus = await api(OLD_TOKEN, OLD_REF, `
    select coalesce(status::text, '<null>') as status, count(*)::int as total, coalesce(sum(total), 0)::numeric(12,2) as valor
    from public.orders
    where lower(coalesce(payment_method::text, '')) like any(array['%credi%', '%fiado%', '%conta%'])
    group by 1
    order by total desc, status;
  `);

  const [historyTypeCounts, accountSummary, recomputedBalance, balanceDiscrepancies] = await Promise.all([
    api(OLD_TOKEN, OLD_REF, `
      select
        type::text as type,
        count(*)::int as total,
        coalesce(sum(amount), 0)::numeric(12,2) as valor
      from public.crediario_history
      group by 1
      order by 1;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select
        count(*)::int as total,
        count(*) filter (where is_active)::int as ativos,
        count(*) filter (where total_balance > 0)::int as com_saldo,
        count(*) filter (where total_balance <= 0)::int as quitados_ou_credito,
        coalesce(sum(total_balance), 0)::numeric(12,2) as saldo_total
      from public.crediarios;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select
        count(*)::int as contas,
        coalesce(sum(saldo), 0)::numeric(12,2) as saldo_recalculado
      from (
        select
          c.id,
          coalesce(sum(
            case
              when h.type::text = 'consumption' then h.amount
              when h.type::text = 'payment' then -h.amount
              else 0
            end
          ), 0) as saldo
        from public.crediarios c
        left join public.crediario_history h on h.crediario_id = c.id
        group by c.id
      ) s;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select
        c.id,
        c.customer_name,
        c.total_balance::numeric(12,2) as saldo_tabela,
        coalesce(sum(
          case
            when h.type::text = 'consumption' then h.amount
            when h.type::text = 'payment' then -h.amount
            else 0
          end
        ), 0)::numeric(12,2) as saldo_hist
      from public.crediarios c
      left join public.crediario_history h on h.crediario_id = c.id
      group by c.id, c.customer_name, c.total_balance
      having abs(c.total_balance - coalesce(sum(
        case
          when h.type::text = 'consumption' then h.amount
          when h.type::text = 'payment' then -h.amount
          else 0
        end
      ), 0)) > 0.01
      order by abs(c.total_balance - coalesce(sum(
        case
          when h.type::text = 'consumption' then h.amount
          when h.type::text = 'payment' then -h.amount
          else 0
        end
      ), 0)) desc
      limit 20;
    `),
  ]);

  console.log(JSON.stringify({
    old: {
      ref: OLD_REF,
      matchingTables: oldTableNames,
      counts: oldCounts,
      matchingColumns: oldColumns,
      orderColumns: oldOrderColumns,
      paymentMethods: oldPaymentMethods,
      creditOrders: creditOrders[0],
      creditOrderStatus,
      historyTypeCounts,
      accountSummary: accountSummary[0],
      recomputedBalance: recomputedBalance[0],
      balanceDiscrepancies,
      samples: oldSamples,
    },
    new: {
      ref: NEW_REF,
      matchingTables: newTableNames,
      counts: newCounts,
      matchingColumns: newColumns,
      orderColumns: newOrderColumns,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
