#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://api.supabase.com";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "gqfhxmobzwkoyemqtgcf";
const EXPECTED_PROJECT_NAME = "edienai-lanches";
const OUT_DIR =
  process.env.OUT_DIR ||
  path.resolve(process.cwd(), "novo-edienai/supabase/exports");

if (!ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

async function api(pathname, options = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || text || response.statusText;
    throw new Error(`${response.status} ${response.statusText}: ${message}`);
  }

  return payload;
}

async function readOnlyQuery(query) {
  return api(`/v1/projects/${PROJECT_REF}/database/query/read-only`, {
    method: "POST",
    body: { query },
  });
}

function sqlHeader(project, migrations, inventory) {
  return `-- ============================================================================
-- Edienai Lanches database structure export
-- ============================================================================
-- Generated at: ${new Date().toISOString()}
-- Source project: ${project.name}
-- Source ref: ${project.ref}
-- Region: ${project.region}
-- Postgres: ${project.database?.version || "unknown"}
-- Source migrations: ${migrations.length}
--
-- Scope:
--   - Structure only.
--   - Top-level INSERT/UPDATE/DELETE/COPY statements are omitted.
--   - No store/customer/order/session/payment/operational rows are copied.
--   - Generated via Supabase Management API, not Supabase MCP/tools.
--
-- Inventory snapshot:
--   - Public tables/views: ${inventory.relations.length}
--   - Public columns: ${inventory.columns.length}
--   - Public constraints: ${inventory.constraints.length}
--   - Public indexes: ${inventory.indexes.length}
--   - Public functions: ${inventory.functions.length}
--   - Public triggers: ${inventory.triggers.length}
--   - Public RLS policies: ${inventory.policies.length}
--   - Extensions: ${inventory.extensions.length}
-- ============================================================================

`;
}

function stripLeadingSqlComments(statement) {
  let text = statement.trimStart();
  let changed = true;
  while (changed) {
    changed = false;
    if (text.startsWith("--")) {
      const newlineIndex = text.indexOf("\n");
      text = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trimStart();
      changed = true;
    }
    if (text.startsWith("/*")) {
      const endIndex = text.indexOf("*/");
      text = endIndex === -1 ? "" : text.slice(endIndex + 2).trimStart();
      changed = true;
    }
  }
  return text;
}

function isTopLevelDataStatement(statement) {
  return /^(insert|update|delete|copy|with)\b/i.test(stripLeadingSqlComments(statement));
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let dollarQuote = null;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    current += char;

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        current += sql.slice(index + 1, index + dollarQuote.length);
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        current += next;
        index += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      current += next;
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === "/" && next === "*") {
      current += next;
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        current += sql.slice(index + 1, index + match[0].length);
        index += match[0].length - 1;
        dollarQuote = match[0];
      }
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function getInventory() {
  const queries = {
    relations: `
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema = 'public'
      order by table_schema, table_name;
    `,
    columns: `
      select table_schema, table_name, column_name, ordinal_position, data_type, udt_name,
             is_nullable, column_default, identity_generation
      from information_schema.columns
      where table_schema = 'public'
      order by table_schema, table_name, ordinal_position;
    `,
    constraints: `
      select
        n.nspname as schema_name,
        c.relname as table_name,
        con.conname as constraint_name,
        con.contype as constraint_type,
        pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
      order by schema_name, table_name, constraint_name;
    `,
    indexes: `
      select schemaname, tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
      order by schemaname, tablename, indexname;
    `,
    functions: `
      select
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as identity_arguments
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
      order by schema_name, function_name, identity_arguments;
    `,
    triggers: `
      select
        n.nspname as schema_name,
        c.relname as table_name,
        t.tgname as trigger_name,
        pg_get_triggerdef(t.oid, true) as definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not t.tgisinternal
      order by schema_name, table_name, trigger_name;
    `,
    policies: `
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by schemaname, tablename, policyname;
    `,
    extensions: `
      select e.extname, e.extversion, n.nspname as schema_name
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
      order by e.extname;
    `,
  };

  const inventory = {};
  for (const [name, query] of Object.entries(queries)) {
    inventory[name] = await readOnlyQuery(query);
  }
  return inventory;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const projects = await api("/v1/projects");
  const project = projects.find((item) => item.ref === PROJECT_REF);
  if (!project) {
    throw new Error(`Project ${PROJECT_REF} was not found.`);
  }
  if (project.name !== EXPECTED_PROJECT_NAME) {
    throw new Error(`Expected project name ${EXPECTED_PROJECT_NAME}, got ${project.name}.`);
  }

  const migrations = await api(`/v1/projects/${PROJECT_REF}/database/migrations`);
  const inventory = await getInventory();

  const sqlParts = [sqlHeader(project, migrations, inventory)];
  const skippedDataParts = [
    `-- Top-level data statements skipped from the schema-only export.\n`,
    `-- Generated at: ${new Date().toISOString()}\n\n`,
  ];

  for (const migration of migrations) {
    const detail = await api(
      `/v1/projects/${PROJECT_REF}/database/migrations/${migration.version}`
    );
    sqlParts.push(`-- Migration: ${migration.version}_${migration.name}\n`);
    const statements = (detail.statements || []).flatMap(splitSqlStatements);
    for (const statement of statements) {
      if (isTopLevelDataStatement(statement)) {
        skippedDataParts.push(`-- Migration: ${migration.version}_${migration.name}\n`);
        skippedDataParts.push(`${statement.trim()}\n\n`);
        continue;
      }
      sqlParts.push(`${statement.trim()}\n\n`);
    }
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const sqlPath = path.join(OUT_DIR, `edienai-lanches-structure-${stamp}.sql`);
  const reportPath = path.join(OUT_DIR, `edienai-lanches-structure-${stamp}.report.json`);
  const skippedDataPath = path.join(
    OUT_DIR,
    `edienai-lanches-structure-${stamp}.skipped-data.sql`
  );

  await writeFile(sqlPath, sqlParts.join(""), "utf8");
  await writeFile(skippedDataPath, skippedDataParts.join(""), "utf8");
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        project,
        migration_count: migrations.length,
        migrations,
        inventory_counts: Object.fromEntries(
          Object.entries(inventory).map(([key, value]) => [key, value.length])
        ),
        inventory,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    JSON.stringify(
      { sqlPath, reportPath, skippedDataPath, migrationCount: migrations.length },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
