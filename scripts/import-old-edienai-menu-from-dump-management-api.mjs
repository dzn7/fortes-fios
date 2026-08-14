#!/usr/bin/env node

import { readFileSync } from "node:fs";

const API_BASE = "https://api.supabase.com";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "bawysvqqeqwxasmggfcn";
const DUMP_PATH = process.env.OLD_DUMP_PATH || "/Users/administrador/edienai_dump_2026-04-30.sql";
const DRY_RUN = process.env.DRY_RUN === "1";

const PRODUCT_COLUMNS = [
  "id",
  "firebase_id",
  "name",
  "description",
  "price",
  "category_id",
  "category_name",
  "image_url",
  "is_hidden",
  "is_active",
  "complements",
  "extra",
  "created_at",
  "updated_at",
];

const CATEGORY_TARGETS = [
  {
    oldCategory: "hamburguer",
    newCategory: "Hambúrgueres",
    type: "produto",
    table: "produtos",
    predicate: () => true,
  },
  {
    oldCategory: "salgados",
    newCategory: "Batatas",
    type: "produto",
    table: "produtos",
    predicate: (row) => normalizar(row.name).includes("batata"),
  },
  {
    oldCategory: "sucos_e_vitaminas",
    newCategory: "Sucos e vitaminas",
    type: "bebida",
    table: "bebidas",
    predicate: () => true,
  },
];

function normalizar(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function makeDollarQuoted(value) {
  const json = JSON.stringify(value);
  let index = 0;
  while (json.includes(`$json${index}$`)) index += 1;
  return `$json${index}$${json}$json${index}$`;
}

function decodeCopyValue(value) {
  if (value === "\\N") return null;
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll("\\\\", "\\");
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "t";
}

function parseCopyRows(dump) {
  const copyStart = dump.indexOf('COPY "public"."products"');
  if (copyStart === -1) {
    throw new Error("COPY public.products não encontrado no dump antigo.");
  }

  const dataStart = dump.indexOf("\n", copyStart) + 1;
  const dataEnd = dump.indexOf("\n\\.\n", dataStart);
  if (dataStart <= 0 || dataEnd === -1) {
    throw new Error("Fim do COPY public.products não encontrado no dump antigo.");
  }

  return dump
    .slice(dataStart, dataEnd)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const values = line.split("\t").map(decodeCopyValue);
      return Object.fromEntries(PRODUCT_COLUMNS.map((column, index) => [column, values[index] ?? null]));
    });
}

function limparDescricao(value) {
  const text = String(value || "")
    .replace(/imagem ilustrativa/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function toMenuRow(row, target, order) {
  return {
    id: row.id,
    nome: String(row.name || "").trim(),
    descricao: limparDescricao(row.description),
    preco: Number(row.price || 0),
    categoria: target.newCategory,
    imagem_url: row.image_url || null,
    disponivel: true,
    ordem: order,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    ...(target.table === "produtos" ? { destaque: false } : {}),
  };
}

function buildSelection(products) {
  const selected = {
    produtos: [],
    bebidas: [],
    categories: [],
  };

  for (const target of CATEGORY_TARGETS) {
    const rows = products
      .filter((row) => row.category_name === target.oldCategory)
      .filter((row) => target.predicate(row))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

    if (rows.length === 0) continue;

    selected.categories.push({
      nome: target.newCategory,
      tipo: target.type,
      ativo: true,
    });

    rows.forEach((row, index) => {
      selected[target.table].push(toMenuRow(row, target, index + 1));
    });
  }

  return selected;
}

async function managementQuery(sql, readOnly = false) {
  if (!ACCESS_TOKEN) {
    throw new Error("SUPABASE_ACCESS_TOKEN ausente.");
  }

  const response = await fetch(
    `${API_BASE}/v1/projects/${PROJECT_REF}/database/query${readOnly ? "/read-only" : ""}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || payload?.message || payload?.error) {
    const message = payload?.message || payload?.error || text;
    const error = new Error(`${response.status}: ${message}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function assertSchema() {
  const rows = await managementQuery(
    `
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('produtos', 'bebidas', 'categorias_cardapio')
    order by table_name, ordinal_position;
    `,
    true
  );

  const byTable = rows.reduce((acc, row) => {
    acc[row.table_name] ||= new Set();
    acc[row.table_name].add(row.column_name);
    return acc;
  }, {});

  const required = {
    categorias_cardapio: ["nome", "tipo", "ativo", "ordem"],
    produtos: ["id", "nome", "descricao", "preco", "categoria", "imagem_url", "disponivel", "ordem"],
    bebidas: ["id", "nome", "descricao", "preco", "categoria", "imagem_url", "disponivel", "ordem"],
  };

  for (const [table, columns] of Object.entries(required)) {
    for (const column of columns) {
      if (!byTable[table]?.has(column)) {
        throw new Error(`Schema incompatível: public.${table}.${column} não existe.`);
      }
    }
  }
}

async function ensureCategories(categories) {
  for (const [index, category] of categories.entries()) {
    await managementQuery(
      `
      insert into public.categorias_cardapio (nome, tipo, ativo, ordem)
      values (${sqlString(category.nome)}, ${sqlString(category.tipo)}, true,
        coalesce((select max(ordem) + 1 from public.categorias_cardapio), ${index + 1})
      )
      on conflict (nome, tipo) do update set ativo = true;
      `
    );
  }
}

async function upsertProdutos(rows) {
  if (rows.length === 0) return;

  await managementQuery(
    `
    insert into public.produtos (
      id, nome, descricao, preco, categoria, imagem_url, disponivel, destaque, ordem, created_at, updated_at
    )
    select id, nome, descricao, preco, categoria, imagem_url, disponivel, destaque, ordem, created_at, updated_at
    from jsonb_populate_recordset(null::public.produtos, ${makeDollarQuoted(rows)}::jsonb)
    on conflict (id) do update set
      nome = excluded.nome,
      descricao = excluded.descricao,
      preco = excluded.preco,
      categoria = excluded.categoria,
      imagem_url = excluded.imagem_url,
      disponivel = true,
      destaque = excluded.destaque,
      ordem = excluded.ordem,
      updated_at = excluded.updated_at;
    `
  );
}

async function upsertBebidas(rows) {
  if (rows.length === 0) return;

  await managementQuery(
    `
    insert into public.bebidas (
      id, nome, descricao, preco, categoria, imagem_url, disponivel, ordem, created_at, updated_at
    )
    select id, nome, descricao, preco, categoria, imagem_url, disponivel, ordem, created_at, updated_at
    from jsonb_populate_recordset(null::public.bebidas, ${makeDollarQuoted(rows)}::jsonb)
    on conflict (id) do update set
      nome = excluded.nome,
      descricao = excluded.descricao,
      preco = excluded.preco,
      categoria = excluded.categoria,
      imagem_url = excluded.imagem_url,
      disponivel = true,
      ordem = excluded.ordem,
      updated_at = excluded.updated_at;
    `
  );
}

async function validate() {
  return managementQuery(
    `
    select 'produtos' as tabela, categoria, count(*)::int total, count(*) filter (where disponivel)::int disponiveis
    from public.produtos
    where categoria in ('Hambúrgueres', 'Batatas')
    group by categoria
    union all
    select 'bebidas' as tabela, categoria, count(*)::int total, count(*) filter (where disponivel)::int disponiveis
    from public.bebidas
    where categoria = 'Sucos e vitaminas'
    group by categoria
    order by tabela, categoria;
    `,
    true
  );
}

async function main() {
  const dump = readFileSync(DUMP_PATH, "utf8");
  const products = parseCopyRows(dump);
  const selected = buildSelection(products);

  const summary = {
    projectRef: PROJECT_REF,
    dryRun: DRY_RUN,
    dumpPath: DUMP_PATH,
    produtos: selected.produtos.length,
    bebidas: selected.bebidas.length,
    categories: selected.categories.map((category) => category.nome),
    sample: {
      produtos: selected.produtos.slice(0, 5).map(({ nome, preco, categoria, imagem_url }) => ({ nome, preco, categoria, imagem_url })),
      bebidas: selected.bebidas.slice(0, 5).map(({ nome, preco, categoria, imagem_url }) => ({ nome, preco, categoria, imagem_url })),
    },
  };

  if (DRY_RUN) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await assertSchema();
  await ensureCategories(selected.categories);
  await upsertProdutos(selected.produtos);
  await upsertBebidas(selected.bebidas);
  const validation = await validate();

  console.log(JSON.stringify({ ...summary, validation }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exit(1);
});
