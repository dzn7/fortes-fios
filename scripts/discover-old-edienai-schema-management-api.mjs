#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const OLD_TOKEN = process.env.OLD_TOKEN;
const OLD_REF = process.env.OLD_REF || "azqnyluvhgqxjrpxylne";

if (!OLD_TOKEN) {
  console.error("Missing OLD_TOKEN.");
  process.exit(1);
}

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${OLD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }
  return payload;
}

async function query(sql) {
  return api(`/v1/projects/${OLD_REF}/database/query/read-only`, {
    method: "POST",
    body: { query: sql },
  });
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function main() {
  const tables = await query(`
    select
      t.table_schema,
      t.table_name,
      t.table_type,
      coalesce(c.reltuples::bigint, 0) as estimated_rows
    from information_schema.tables t
    left join pg_namespace n on n.nspname = t.table_schema
    left join pg_class c on c.relname = t.table_name and c.relnamespace = n.oid
    where t.table_schema = 'public'
    order by t.table_name;
  `);

  const columns = await query(`
    select
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `);

  const likelyColumns = columns.filter((column) => {
    const haystack = `${column.table_name} ${column.column_name}`.toLowerCase();
    return [
      "pedido",
      "order",
      "item",
      "produto",
      "cliente",
      "pagamento",
      "entrega",
      "mesa",
      "total",
      "valor",
      "preco",
      "status",
      "created",
      "data",
    ].some((word) => haystack.includes(word));
  });

  const dateLikeColumns = columns.filter((column) => {
    const type = `${column.data_type} ${column.udt_name}`.toLowerCase();
    const name = column.column_name.toLowerCase();
    return (
      type.includes("timestamp") ||
      type.includes("date") ||
      name.includes("created") ||
      name.includes("data")
    );
  });

  const counts2026 = [];
  for (const column of dateLikeColumns) {
    try {
      const rows = await query(`
        select count(*)::int as count
        from public.${quoteIdent(column.table_name)}
        where ${quoteIdent(column.column_name)} >= '2026-01-01'::timestamptz
          and ${quoteIdent(column.column_name)} < '2027-01-01'::timestamptz;
      `);
      const count = rows[0]?.count ?? 0;
      if (count > 0) {
        counts2026.push({
          table_name: column.table_name,
          column_name: column.column_name,
          count,
        });
      }
    } catch {
      // Some date-like text columns may not cast cleanly. Ignore for discovery.
    }
  }

  const samples = {};
  for (const row of counts2026.slice(0, 20)) {
    const rows = await query(`
      select *
      from public.${quoteIdent(row.table_name)}
      where ${quoteIdent(row.column_name)} >= '2026-01-01'::timestamptz
        and ${quoteIdent(row.column_name)} < '2027-01-01'::timestamptz
      order by ${quoteIdent(row.column_name)} asc
      limit 3;
    `);
    samples[`${row.table_name}.${row.column_name}`] = rows.map((record) =>
      Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
          key,
          typeof value === "string" && value.length > 80 ? `${value.slice(0, 80)}...` : value,
        ])
      )
    );
  }

  console.log(
    JSON.stringify(
      {
        project_ref: OLD_REF,
        tables,
        columns,
        likelyColumns,
        counts2026,
        samples,
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
