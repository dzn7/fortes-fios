#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "bawysvqqeqwxasmggfcn";

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
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }
  return payload;
}

async function query(sql, readOnly = true) {
  return api(`/v1/projects/${PROJECT_REF}/database/query${readOnly ? "/read-only" : ""}`, {
    method: "POST",
    body: { query: sql },
  });
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function main() {
  const projects = await api("/v1/projects");
  const project = projects.find((item) => item.ref === PROJECT_REF);

  const tables = await query(`
    with cols as (
      select
        table_name,
        jsonb_agg(jsonb_build_object(
          'name', column_name,
          'type', data_type,
          'udt', udt_name,
          'nullable', is_nullable,
          'default', column_default
        ) order by ordinal_position) as columns
      from information_schema.columns
      where table_schema = 'public'
      group by table_name
    ), counts as (
      select relname as table_name, n_live_tup::bigint as estimated_rows
      from pg_stat_user_tables
      where schemaname = 'public'
    )
    select
      t.table_name,
      t.table_type,
      coalesce(counts.estimated_rows, 0) as estimated_rows,
      cols.columns
    from information_schema.tables t
    left join cols on cols.table_name = t.table_name
    left join counts on counts.table_name = t.table_name
    where t.table_schema = 'public'
      and (
        t.table_name in (
          'configuracoes_loja',
          'produtos',
          'categorias',
          'categorias_cardapio',
          'bairros',
          'formas_pagamento',
          'pedidos',
          'pedido_itens',
          'usuarios_cliente',
          'clientes',
          'funcionarios',
          'mesas'
        )
        or t.table_name ilike '%produto%'
        or t.table_name ilike '%categoria%'
        or t.table_name ilike '%pedido%'
        or t.table_name ilike '%cliente%'
        or t.table_name ilike '%bairro%'
        or t.table_name ilike '%pagamento%'
      )
    order by t.table_name;
  `);

  const samples = {};
  for (const table of tables) {
    try {
      samples[table.table_name] = await query(`select * from public.${quoteIdent(table.table_name)} limit 3;`);
    } catch (error) {
      samples[table.table_name] = { error: error.message };
    }
  }

  const botTables = await query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'whatsapp_conversations',
        'whatsapp_messages',
        'whatsapp_outbox',
        'whatsapp_order_notifications'
      )
    order by table_name;
  `);

  console.log(JSON.stringify({ project, botTables, tables, samples }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
