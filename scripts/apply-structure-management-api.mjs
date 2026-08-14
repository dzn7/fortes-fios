#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const API_BASE = "https://api.supabase.com";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const PROJECT_NAME = process.env.SUPABASE_PROJECT_NAME || "edienai";
const SQL_FILE = process.env.SQL_FILE;
const ALLOW_NONEMPTY = process.env.ALLOW_NONEMPTY === "1";
const START_AT = Number.parseInt(process.env.START_AT || "1", 10);

if (!ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

if (!SQL_FILE) {
  console.error("Missing SQL_FILE.");
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
    const error = new Error(`${response.status} ${response.statusText}: ${message}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function query(ref, sql, readOnly = false) {
  return api(`/v1/projects/${ref}/database/query${readOnly ? "/read-only" : ""}`, {
    method: "POST",
    body: { query: sql },
  });
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

async function getInventoryCounts(ref) {
  const [relations, columns, constraints, indexes, functions, triggers, policies, extensions] =
    await Promise.all([
      query(
        ref,
        "select count(*)::int as count from information_schema.tables where table_schema = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from information_schema.columns where table_schema = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_indexes where schemaname = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal;",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_policies where schemaname = 'public';",
        true
      ),
      query(
        ref,
        "select count(*)::int as count from pg_extension;",
        true
      ),
    ]);

  return {
    relations: relations[0]?.count ?? 0,
    columns: columns[0]?.count ?? 0,
    constraints: constraints[0]?.count ?? 0,
    indexes: indexes[0]?.count ?? 0,
    functions: functions[0]?.count ?? 0,
    triggers: triggers[0]?.count ?? 0,
    policies: policies[0]?.count ?? 0,
    extensions: extensions[0]?.count ?? 0,
  };
}

async function main() {
  const projects = await api("/v1/projects");
  const project = PROJECT_REF
    ? projects.find((item) => item.ref === PROJECT_REF)
    : projects.find((item) => item.name === PROJECT_NAME);

  if (!project) {
    throw new Error(`Destination project not found: ${PROJECT_REF || PROJECT_NAME}`);
  }

  const before = await getInventoryCounts(project.ref);
  if (!ALLOW_NONEMPTY && before.relations > 0) {
    throw new Error(
      `Destination public schema is not empty (${before.relations} relations). Set ALLOW_NONEMPTY=1 only if this is intentional.`
    );
  }

  const sql = await readFile(SQL_FILE, "utf8");
  const statements = splitSqlStatements(sql);

  console.log(
    JSON.stringify(
      {
        destination: { name: project.name, ref: project.ref, region: project.region },
        before,
        statements: statements.length,
      },
      null,
      2
    )
  );

  for (const [index, statement] of statements.entries()) {
    const statementNumber = index + 1;
    if (statementNumber < START_AT) {
      continue;
    }

    try {
      await query(project.ref, statement, false);
    } catch (error) {
      console.error(`Failed statement ${statementNumber}/${statements.length}`);
      console.error(statement.slice(0, 1200));
      throw error;
    }
  }

  const after = await getInventoryCounts(project.ref);
  console.log(JSON.stringify({ after }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exit(1);
});
