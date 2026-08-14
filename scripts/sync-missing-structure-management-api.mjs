#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const SOURCE_TOKEN = process.env.SOURCE_TOKEN;
const DEST_TOKEN = process.env.DEST_TOKEN;
const SOURCE_REF = process.env.SOURCE_REF || "gqfhxmobzwkoyemqtgcf";
const DEST_REF = process.env.DEST_REF || "bawysvqqeqwxasmggfcn";

if (!SOURCE_TOKEN || !DEST_TOKEN) {
  console.error("Missing SOURCE_TOKEN or DEST_TOKEN.");
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
    const message = payload?.message || payload?.error || text || response.statusText;
    const error = new Error(`${response.status} ${response.statusText}: ${message}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function query(token, ref, sql, readOnly = false) {
  return api(token, `/v1/projects/${ref}/database/query${readOnly ? "/read-only" : ""}`, {
    method: "POST",
    body: { query: sql },
  });
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function getInventory(token, ref) {
  const [
    relations,
    functions,
    triggers,
    policies,
    indexes,
    rls,
    constraints,
    columns,
    views,
  ] = await Promise.all([
    query(
      token,
      ref,
      `
        select table_schema, table_name, table_type
        from information_schema.tables
        where table_schema = 'public'
        order by table_name;
      `,
      true
    ),
    query(
      token,
      ref,
      `
        select
          n.nspname as schema_name,
          p.proname as function_name,
          pg_get_function_identity_arguments(p.oid) as identity_arguments,
          pg_get_functiondef(p.oid) as definition
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
        order by schema_name, function_name, identity_arguments;
      `,
      true
    ),
    query(
      token,
      ref,
      `
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
      true
    ),
    query(
      token,
      ref,
      `
        select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public'
        order by schemaname, tablename, policyname;
      `,
      true
    ),
    query(
      token,
      ref,
      `
        select schemaname, tablename, indexname, indexdef
        from pg_indexes
        where schemaname = 'public'
        order by schemaname, tablename, indexname;
      `,
      true
    ),
    query(
      token,
      ref,
      `
        select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
        order by schema_name, table_name;
      `,
      true
    ),
    query(
      token,
      ref,
      `
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
      true
    ),
    query(
      token,
      ref,
      `
        select
          n.nspname as schema_name,
          c.relname as table_name,
          a.attname as column_name,
          format_type(a.atttypid, a.atttypmod) as data_type,
          a.attnotnull as not_null,
          a.attidentity as identity_kind,
          pg_get_expr(d.adbin, d.adrelid) as default_expr
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and a.attnum > 0
          and not a.attisdropped
        order by schema_name, table_name, a.attnum;
      `,
      true
    ),
    query(
      token,
      ref,
      `
        select schemaname, viewname, definition
        from pg_views
        where schemaname = 'public'
        order by schemaname, viewname;
      `,
      true
    ),
  ]);

  return { relations, functions, triggers, policies, indexes, rls, constraints, columns, views };
}

async function getCreateTableSql(tableName) {
  const columns = await query(
    SOURCE_TOKEN,
    SOURCE_REF,
    `
      select
        a.attname as column_name,
        format_type(a.atttypid, a.atttypmod) as data_type,
        a.attnotnull as not_null,
        a.attidentity as identity_kind,
        pg_get_expr(d.adbin, d.adrelid) as default_expr
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where n.nspname = 'public'
        and c.relname = ${quoteLiteral(tableName)}
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum;
    `,
    true
  );

  const columnSql = columns.map((column) => {
    const parts = [quoteIdent(column.column_name), column.data_type];
    if (column.identity_kind === "a") parts.push("GENERATED ALWAYS AS IDENTITY");
    if (column.identity_kind === "d") parts.push("GENERATED BY DEFAULT AS IDENTITY");
    if (column.default_expr && !column.identity_kind) parts.push(`DEFAULT ${column.default_expr}`);
    if (column.not_null) parts.push("NOT NULL");
    return `  ${parts.join(" ")}`;
  });

  return `CREATE TABLE IF NOT EXISTS public.${quoteIdent(tableName)} (\n${columnSql.join(",\n")}\n);`;
}

function functionKey(row) {
  return `${row.schema_name}.${row.function_name}(${row.identity_arguments})`;
}

function triggerKey(row) {
  return `${row.schema_name}.${row.table_name}.${row.trigger_name}`;
}

function policyKey(row) {
  return `${row.schemaname}.${row.tablename}.${row.policyname}`;
}

function indexKey(row) {
  return `${row.schemaname}.${row.indexname}`;
}

function constraintKey(row) {
  return `${row.schema_name}.${row.table_name}.${row.constraint_name}`;
}

function viewKey(row) {
  return `${row.schemaname}.${row.viewname}`;
}

function columnKey(row) {
  return `${row.schema_name}.${row.table_name}.${row.column_name}`;
}

function columnDefinition(column) {
  const parts = [quoteIdent(column.column_name), column.data_type];
  if (column.identity_kind === "a") parts.push("GENERATED ALWAYS AS IDENTITY");
  if (column.identity_kind === "d") parts.push("GENERATED BY DEFAULT AS IDENTITY");
  if (column.default_expr && !column.identity_kind) parts.push(`DEFAULT ${column.default_expr}`);
  if (column.not_null) parts.push("NOT NULL");
  return parts.join(" ");
}

function indexWithIfNotExists(indexdef) {
  return indexdef
    .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
}

function createPolicySql(policy) {
  const roles = Array.isArray(policy.roles) && policy.roles.length > 0
    ? policy.roles.map(quoteIdent).join(", ")
    : "public";
  const parts = [
    `CREATE POLICY ${quoteIdent(policy.policyname)} ON ${quoteIdent(policy.schemaname)}.${quoteIdent(policy.tablename)}`,
    `AS ${policy.permissive}`,
    `FOR ${policy.cmd}`,
    `TO ${roles}`,
  ];
  if (policy.qual) parts.push(`USING (${policy.qual})`);
  if (policy.with_check) parts.push(`WITH CHECK (${policy.with_check})`);
  return `${parts.join(" ")};`;
}

async function main() {
  const [source, dest] = await Promise.all([
    getInventory(SOURCE_TOKEN, SOURCE_REF),
    getInventory(DEST_TOKEN, DEST_REF),
  ]);

  const destRelations = new Set(dest.relations.map((row) => row.table_name));
  const destFunctions = new Set(dest.functions.map(functionKey));
  const destTriggers = new Set(dest.triggers.map(triggerKey));
  const destPolicies = new Set(dest.policies.map(policyKey));
  const destIndexes = new Set(dest.indexes.map(indexKey));
  const destConstraints = new Set(dest.constraints.map(constraintKey));
  const destRls = new Map(dest.rls.map((row) => [row.table_name, row]));

  const statements = [];
  const missing = {
    relations: [],
    constraints: [],
    functions: [],
    rls: [],
    policies: [],
    triggers: [],
    indexes: [],
    columns: [],
    views: [],
  };

  for (const relation of source.relations) {
    if (relation.table_type !== "BASE TABLE" || destRelations.has(relation.table_name)) {
      continue;
    }
    missing.relations.push(relation.table_name);
    statements.push(await getCreateTableSql(relation.table_name));
  }

  const destColumns = new Set(dest.columns.map(columnKey));
  for (const column of source.columns) {
    if (destColumns.has(columnKey(column))) continue;
    if (!destRelations.has(column.table_name)) continue;
    missing.columns.push(columnKey(column));
    statements.push(
      `ALTER TABLE public.${quoteIdent(column.table_name)} ADD COLUMN IF NOT EXISTS ${columnDefinition(column)};`
    );
  }

  const destViews = new Map(dest.views.map((view) => [viewKey(view), view]));
  for (const view of source.views) {
    const destView = destViews.get(viewKey(view));
    if (destView?.definition === view.definition) continue;
    missing.views.push(viewKey(view));
    statements.push(`DROP VIEW IF EXISTS public.${quoteIdent(view.viewname)};`);
    statements.push(`CREATE VIEW public.${quoteIdent(view.viewname)} AS\n${view.definition};`);
  }

  for (const constraint of source.constraints) {
    if (destConstraints.has(constraintKey(constraint))) continue;
    if (!destRelations.has(constraint.table_name) && !missing.relations.includes(constraint.table_name)) {
      continue;
    }
    missing.constraints.push(constraintKey(constraint));
    statements.push(
      `ALTER TABLE ONLY public.${quoteIdent(constraint.table_name)} ADD CONSTRAINT ${quoteIdent(constraint.constraint_name)} ${constraint.definition};`
    );
  }

  for (const fn of source.functions) {
    if (destFunctions.has(functionKey(fn))) continue;
    missing.functions.push(functionKey(fn));
    statements.push(fn.definition);
  }

  for (const row of source.rls) {
    const destRow = destRls.get(row.table_name);
    if (row.relrowsecurity && !destRow?.relrowsecurity) {
      missing.rls.push(row.table_name);
      statements.push(`ALTER TABLE public.${quoteIdent(row.table_name)} ENABLE ROW LEVEL SECURITY;`);
    }
    if (row.relforcerowsecurity && !destRow?.relforcerowsecurity) {
      statements.push(`ALTER TABLE public.${quoteIdent(row.table_name)} FORCE ROW LEVEL SECURITY;`);
    }
  }

  for (const policy of source.policies) {
    if (destPolicies.has(policyKey(policy))) continue;
    if (!destRelations.has(policy.tablename) && !missing.relations.includes(policy.tablename)) continue;
    missing.policies.push(policyKey(policy));
    statements.push(createPolicySql(policy));
  }

  for (const trigger of source.triggers) {
    if (destTriggers.has(triggerKey(trigger))) continue;
    if (!destRelations.has(trigger.table_name) && !missing.relations.includes(trigger.table_name)) continue;
    missing.triggers.push(triggerKey(trigger));
    statements.push(trigger.definition);
  }

  for (const index of source.indexes) {
    if (destIndexes.has(indexKey(index))) continue;
    if (!destRelations.has(index.tablename) && !missing.relations.includes(index.tablename)) continue;
    missing.indexes.push(indexKey(index));
    statements.push(indexWithIfNotExists(index.indexdef));
  }

  console.log(JSON.stringify({ missing, statementCount: statements.length }, null, 2));

  for (const [index, statement] of statements.entries()) {
    try {
      await query(DEST_TOKEN, DEST_REF, statement, false);
    } catch (error) {
      console.error(`Failed delta statement ${index + 1}/${statements.length}`);
      console.error(statement);
      throw error;
    }
  }

  const updated = await getInventory(DEST_TOKEN, DEST_REF);
  console.log(
    JSON.stringify(
      {
        after: {
          relations: updated.relations.length,
          constraints: updated.constraints.length,
          indexes: updated.indexes.length,
          functions: updated.functions.length,
          triggers: updated.triggers.length,
          policies: updated.policies.length,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exit(1);
});
