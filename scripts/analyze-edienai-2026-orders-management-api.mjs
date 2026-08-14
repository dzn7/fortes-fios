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

async function api(token, pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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

async function query(token, ref, sql) {
  return api(token, `/v1/projects/${ref}/database/query/read-only`, {
    method: "POST",
    body: { query: sql },
  });
}

async function columns(token, ref, tableNames) {
  if (tableNames.length === 0) {
    return [];
  }
  return query(
    token,
    ref,
    `
      select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any(array[${tableNames.map((name) => `'${name}'`).join(",")}])
      order by table_name, ordinal_position;
    `
  );
}

async function existingTables(token, ref) {
  return query(
    token,
    ref,
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name;
    `
  );
}

async function tableCount(token, ref, tableName, where = "true") {
  const rows = await query(
    token,
    ref,
    `select count(*)::int as count from public."${tableName.replaceAll('"', '""')}" where ${where};`
  );
  return rows[0]?.count ?? 0;
}

async function main() {
  const candidateTables = [
    "pedidos",
    "itens_pedido",
    "item_adicionais",
    "pagamentos_pedido",
    "pagamentos_online",
    "entregas",
    "usuarios_cliente",
    "mesas",
  ];

  const [oldTables, newTables] = await Promise.all([
    existingTables(OLD_TOKEN, OLD_REF),
    existingTables(NEW_TOKEN, NEW_REF),
  ]);
  const oldSet = new Set(oldTables.map((row) => row.table_name));
  const newSet = new Set(newTables.map((row) => row.table_name));
  const oldRelevant = candidateTables.filter((table) => oldSet.has(table));
  const newRelevant = candidateTables.filter((table) => newSet.has(table));

  const [oldColumns, newColumns] = await Promise.all([
    columns(OLD_TOKEN, OLD_REF, oldRelevant),
    columns(NEW_TOKEN, NEW_REF, newRelevant),
  ]);

  const oldPedidoRows2026 = oldSet.has("pedidos")
    ? await tableCount(
        OLD_TOKEN,
        OLD_REF,
        "pedidos",
        "created_at >= '2026-01-01'::timestamptz and created_at < '2027-01-01'::timestamptz"
      )
    : null;

  const newPedidoRows2026 = await tableCount(
    NEW_TOKEN,
    NEW_REF,
    "pedidos",
    "created_at >= '2026-01-01'::timestamptz and created_at < '2027-01-01'::timestamptz"
  );

  const oldRelatedCounts = {};
  for (const tableName of oldRelevant) {
    oldRelatedCounts[tableName] = await tableCount(OLD_TOKEN, OLD_REF, tableName);
  }

  const newRelatedCounts = {};
  for (const tableName of newRelevant) {
    newRelatedCounts[tableName] = await tableCount(NEW_TOKEN, NEW_REF, tableName);
  }

  console.log(
    JSON.stringify(
      {
        old: {
          ref: OLD_REF,
          relevantTables: oldRelevant,
          pedidos2026: oldPedidoRows2026,
          counts: oldRelatedCounts,
          columns: oldColumns,
        },
        new: {
          ref: NEW_REF,
          relevantTables: newRelevant,
          pedidos2026: newPedidoRows2026,
          counts: newRelatedCounts,
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
