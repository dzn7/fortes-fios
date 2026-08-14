#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";

const SOURCE_TOKEN = process.env.SOURCE_TOKEN;
const DEST_TOKEN = process.env.DEST_TOKEN;
const SOURCE_REF = process.env.SOURCE_REF || "gqfhxmobzwkoyemqtgcf";
const DEST_REF = process.env.DEST_REF || "pwsvfwmjfklkstvhrjsl";
const SKIP_SCHEMA_REPLAY = process.env.SKIP_SCHEMA_REPLAY === "1";

if (!SOURCE_TOKEN || !DEST_TOKEN) {
  console.error("Missing SOURCE_TOKEN or DEST_TOKEN.");
  process.exit(1);
}

const EXCLUDED_DATA_TABLES = new Set([
  "atividade_garcom",
  "cupons_usos",
  "entregas",
  "fila_impressao",
  "historico_entregas",
  "historico_item_adicionais",
  "historico_itens_pedido",
  "historico_movimentacoes_caixa",
  "historico_pedidos",
  "item_adicionais",
  "itens_pedido",
  "mesas",
  "movimentacoes_caixa",
  "notification_preferences",
  "pagamentos_online",
  "pagamentos_pedido",
  "pedidos",
  "usuarios_cliente",
  "usuarios_sistema",
]);

const DATA_COPY_ORDER = [
  "anotacoes_painel",
  "bairros",
  "bebidas",
  "caixa_automacao_config",
  "categorias_adicionais",
  "adicionais",
  "categorias_caixa",
  "combos",
  "combo_itens",
  "configuracoes_loja",
  "cupons",
  "formas_pagamento",
  "funcionarios",
  "caixas",
  "historico_caixas",
  "produtos",
  "produto_adicionais",
  "resumo_anual",
  "whatsapp_session",
];

const INVENTORY_QUERIES = {
  schemas: `
    select nspname as schema_name
    from pg_namespace
    where nspname not like 'pg_%'
      and nspname <> 'information_schema'
    order by 1;
  `,
  publicRelations: `
    select table_schema, table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
    order by 1, 2, 3;
  `,
  publicColumns: `
    select
      table_schema,
      table_name,
      column_name,
      ordinal_position,
      data_type,
      udt_name,
      is_nullable,
      column_default,
      identity_generation
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position;
  `,
  publicFunctions: `
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      md5(pg_get_functiondef(p.oid)) as definition_hash
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by 1, 2, 3;
  `,
  publicTriggers: `
    select
      n.nspname as schema_name,
      c.relname as table_name,
      t.tgname as trigger_name,
      md5(pg_get_triggerdef(t.oid, true)) as definition_hash
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
    order by 1, 2, 3;
  `,
  publicPolicies: `
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
    order by 1, 2, 3;
  `,
  extensions: `
    select
      e.extname,
      e.extversion,
      n.nspname as schema_name
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    order by 1;
  `,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const payload = text && contentType.includes("application/json") ? JSON.parse(text) : text;

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} on ${method} ${path}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function listProjects(token) {
  return apiRequest(token, "/v1/projects");
}

async function listEdgeFunctions(token, ref) {
  return apiRequest(token, `/v1/projects/${ref}/functions`);
}

async function listMigrations(token, ref) {
  return apiRequest(token, `/v1/projects/${ref}/database/migrations`);
}

async function getMigration(token, ref, version) {
  return apiRequest(token, `/v1/projects/${ref}/database/migrations/${version}`);
}

async function dbQueryRead(token, ref, query) {
  return apiRequest(token, `/v1/projects/${ref}/database/query/read-only`, {
    method: "POST",
    body: { query },
  });
}

async function dbQueryWrite(token, ref, query) {
  return apiRequest(token, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    body: { query },
  });
}

function logStep(message) {
  console.log(`\n==> ${message}`);
}

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, inner]) => [key, normalize(inner)])
    );
  }
  return value;
}

async function fetchInventory(token, ref) {
  const inventory = {};
  for (const [name, query] of Object.entries(INVENTORY_QUERIES)) {
    inventory[name] = await dbQueryRead(token, ref, query);
  }
  return normalize(inventory);
}

function diffInventory(sourceInventory, destInventory) {
  const diffs = [];
  for (const key of Object.keys(INVENTORY_QUERIES)) {
    const sourceJson = JSON.stringify(sourceInventory[key]);
    const destJson = JSON.stringify(destInventory[key]);
    if (sourceJson !== destJson) {
      diffs.push(key);
    }
  }
  return diffs;
}

function ensureProject(projects, ref, expectedName) {
  const project = projects.find((item) => item.ref === ref);
  if (!project) {
    throw new Error(`Project ${ref} not found.`);
  }
  if (expectedName && project.name !== expectedName) {
    throw new Error(`Project ${ref} name mismatch. Expected ${expectedName}, got ${project.name}.`);
  }
  return project;
}

async function getPublicTableCount(token, ref) {
  const rows = await dbQueryRead(
    token,
    ref,
    `
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public'
        and table_type in ('BASE TABLE', 'VIEW');
    `
  );
  return rows[0]?.count ?? 0;
}

async function applySchemaFromMigrations() {
  const sourceMigrations = await listMigrations(SOURCE_TOKEN, SOURCE_REF);
  const publicTableCount = await getPublicTableCount(DEST_TOKEN, DEST_REF);

  if (publicTableCount > 0) {
    throw new Error("Destination already contains public schema objects. Aborting schema replay.");
  }

  for (const migration of sourceMigrations) {
    logStep(`Applying migration ${migration.version} ${migration.name}`);
    const detail = await getMigration(SOURCE_TOKEN, SOURCE_REF, migration.version);
    for (const [index, statement] of detail.statements.entries()) {
      try {
        await dbQueryWrite(DEST_TOKEN, DEST_REF, statement);
      } catch (error) {
        console.error(`Migration ${migration.version} statement ${index + 1} failed.`);
        console.error(error.payload);
        throw error;
      }
      await sleep(150);
    }
  }
}

async function listPublicBaseTables(token, ref) {
  return dbQueryRead(
    token,
    ref,
    `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name;
    `
  );
}

async function getTableRowCount(token, ref, tableName) {
  const rows = await dbQueryRead(
    token,
    ref,
    `select count(*)::int as count from public.${quoteIdent(tableName)};`
  );
  return rows[0]?.count ?? 0;
}

async function getOrderByColumns(token, ref, tableName) {
  const primaryKeyRows = await dbQueryRead(
    token,
    ref,
    `
      select a.attname as column_name
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
      where i.indisprimary
        and n.nspname = 'public'
        and c.relname = '${escapeLiteral(tableName)}'
      order by array_position(i.indkey, a.attnum);
    `
  );

  if (primaryKeyRows.length > 0) {
    return primaryKeyRows.map((row) => row.column_name);
  }

  const columnRows = await dbQueryRead(
    token,
    ref,
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = '${escapeLiteral(tableName)}'
      order by ordinal_position
      limit 1;
    `
  );

  return columnRows.length > 0 ? [columnRows[0].column_name] : [];
}

async function fetchTableBatch(token, ref, tableName, orderByColumns, limit, offset) {
  const orderByClause =
    orderByColumns.length > 0
      ? `order by ${orderByColumns.map((column) => `t.${quoteIdent(column)}`).join(", ")}`
      : "";

  return dbQueryRead(
    token,
    ref,
    `
      select *
      from public.${quoteIdent(tableName)} t
      ${orderByClause}
      limit ${limit}
      offset ${offset};
    `
  );
}

function makeDollarQuoted(jsonString) {
  let counter = 0;
  while (true) {
    const tag = `$json${counter}$`;
    if (!jsonString.includes(tag)) {
      return `${tag}${jsonString}${tag}`;
    }
    counter += 1;
  }
}

async function copyTableData(tableName) {
  const rowCount = await getTableRowCount(SOURCE_TOKEN, SOURCE_REF, tableName);
  if (rowCount === 0) {
    console.log(`Skipping ${tableName}: no rows.`);
    return;
  }

  const orderByColumns = await getOrderByColumns(SOURCE_TOKEN, SOURCE_REF, tableName);
  const batchSize = tableName === "whatsapp_session" ? 250 : 500;

  console.log(`Copying ${tableName}: ${rowCount} rows.`);

  for (let offset = 0; offset < rowCount; offset += batchSize) {
    const rows = await fetchTableBatch(SOURCE_TOKEN, SOURCE_REF, tableName, orderByColumns, batchSize, offset);
    if (rows.length === 0) {
      continue;
    }

    const jsonPayload = makeDollarQuoted(JSON.stringify(rows));
    const insertSql = `
      insert into public.${quoteIdent(tableName)}
      select *
      from jsonb_populate_recordset(null::public.${quoteIdent(tableName)}, ${jsonPayload}::jsonb);
    `;

    await dbQueryWrite(DEST_TOKEN, DEST_REF, insertSql);
    await sleep(100);
  }

  await resetOwnedSequences(tableName);
}

async function resetOwnedSequences(tableName) {
  const sequenceRows = await dbQueryRead(
    DEST_TOKEN,
    DEST_REF,
    `
      select
        a.attname as column_name,
        pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as sequence_name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'public'
        and c.relname = '${escapeLiteral(tableName)}'
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum;
    `
  );

  for (const row of sequenceRows) {
    if (!row.sequence_name) {
      continue;
    }

    const resetSql = `
      select setval(
        '${escapeLiteral(row.sequence_name)}',
        coalesce((select max(${quoteIdent(row.column_name)}) from public.${quoteIdent(tableName)}), 1),
        coalesce((select max(${quoteIdent(row.column_name)}) is not null from public.${quoteIdent(tableName)}), false)
      );
    `;

    await dbQueryWrite(DEST_TOKEN, DEST_REF, resetSql);
  }
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeLiteral(value) {
  return String(value).replaceAll("'", "''");
}

async function copyAllowedData() {
  const sourceTables = await listPublicBaseTables(SOURCE_TOKEN, SOURCE_REF);
  const copyableTables = sourceTables
    .map((row) => row.table_name)
    .filter((tableName) => !EXCLUDED_DATA_TABLES.has(tableName));

  const orderedTables = [
    ...DATA_COPY_ORDER.filter((tableName) => copyableTables.includes(tableName)),
    ...copyableTables.filter((tableName) => !DATA_COPY_ORDER.includes(tableName)),
  ];

  for (const tableName of [...orderedTables].reverse()) {
    await dbQueryWrite(DEST_TOKEN, DEST_REF, `delete from public.${quoteIdent(tableName)};`);
  }

  for (const tableName of orderedTables) {
    await copyTableData(tableName);
  }
}

async function compareCopiedData() {
  const sourceTables = await listPublicBaseTables(SOURCE_TOKEN, SOURCE_REF);
  const mismatches = [];

  for (const row of sourceTables) {
    const tableName = row.table_name;
    if (EXCLUDED_DATA_TABLES.has(tableName)) {
      continue;
    }

    const [sourceCount, destCount] = await Promise.all([
      getTableRowCount(SOURCE_TOKEN, SOURCE_REF, tableName),
      getTableRowCount(DEST_TOKEN, DEST_REF, tableName),
    ]);

    if (sourceCount !== destCount) {
      mismatches.push({ tableName, sourceCount, destCount });
    }
  }

  return mismatches;
}

async function main() {
  logStep("Validating projects and current state");
  const [sourceProjects, destProjects] = await Promise.all([
    listProjects(SOURCE_TOKEN),
    listProjects(DEST_TOKEN),
  ]);

  ensureProject(sourceProjects, SOURCE_REF, "edienai-lanches");
  ensureProject(destProjects, DEST_REF, "bar-da-ladeira");

  const [sourceEdgeFunctions, destEdgeFunctions] = await Promise.all([
    listEdgeFunctions(SOURCE_TOKEN, SOURCE_REF),
    listEdgeFunctions(DEST_TOKEN, DEST_REF),
  ]);

  console.log(`Source edge functions: ${sourceEdgeFunctions.length}`);
  console.log(`Destination edge functions: ${destEdgeFunctions.length}`);

  if (SKIP_SCHEMA_REPLAY) {
    console.log("Skipping schema replay.");
  } else {
    logStep("Replaying schema from source migrations");
    await applySchemaFromMigrations();
  }

  logStep("Comparing source and destination schema inventory");
  const [sourceInventory, destInventory] = await Promise.all([
    fetchInventory(SOURCE_TOKEN, SOURCE_REF),
    fetchInventory(DEST_TOKEN, DEST_REF),
  ]);

  const schemaDiffs = diffInventory(sourceInventory, destInventory);
  if (schemaDiffs.length > 0) {
    console.error("Schema inventory mismatch after replay:", schemaDiffs);
    process.exit(2);
  }
  console.log("Schema inventory matches for schemas, relations, columns, functions, triggers, policies and extensions.");

  logStep("Copying allowed data");
  await copyAllowedData();

  logStep("Validating copied data counts");
  const dataMismatches = await compareCopiedData();
  if (dataMismatches.length > 0) {
    console.error("Data count mismatches detected:");
    for (const mismatch of dataMismatches) {
      console.error(mismatch);
    }
    process.exit(3);
  }

  console.log("Allowed data copied successfully.");
}

main().catch((error) => {
  console.error(error.message);
  if (error.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }
  process.exit(1);
});
