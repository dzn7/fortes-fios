#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const OLD_TOKEN = process.env.OLD_TOKEN;
const NEW_TOKEN = process.env.NEW_TOKEN;
const OLD_REF = process.env.OLD_REF || "azqnyluvhgqxjrpxylne";
const NEW_REF = process.env.NEW_REF || "bawysvqqeqwxasmggfcn";
const OLD_CATEGORY = process.env.OLD_CATEGORY;
const NEW_CATEGORY = process.env.NEW_CATEGORY;
const CATEGORY_TYPE = process.env.CATEGORY_TYPE || "produto";
const TARGET_TABLE = process.env.TARGET_TABLE || "produtos";
const FORCE_AVAILABLE = process.env.FORCE_AVAILABLE !== "0";

if (!OLD_TOKEN || !NEW_TOKEN || !OLD_CATEGORY || !NEW_CATEGORY) {
  console.error("Missing OLD_TOKEN, NEW_TOKEN, OLD_CATEGORY or NEW_CATEGORY.");
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
    const error = new Error(`${response.status}: ${payload?.message || text}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function makeDollarQuoted(value) {
  const json = JSON.stringify(value);
  let index = 0;
  while (json.includes(`$json${index}$`)) index += 1;
  return `$json${index}$${json}$json${index}$`;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function oldQuery(sql) {
  return api(OLD_TOKEN, OLD_REF, sql, true);
}

async function newQuery(sql, readOnly = true) {
  return api(NEW_TOKEN, NEW_REF, sql, readOnly);
}

async function ensureCategory() {
  await newQuery(
    `
    insert into public.categorias_cardapio (nome, tipo, ativo, ordem)
    values (
      ${sqlString(NEW_CATEGORY)},
      ${sqlString(CATEGORY_TYPE)},
      true,
      coalesce((select max(ordem) + 1 from public.categorias_cardapio), 1)
    )
    on conflict (nome, tipo) do update set
      ativo = true;
    `,
    false
  );
}

async function fetchOldProducts() {
  return oldQuery(`
    select
      id,
      name,
      description,
      price,
      image_url,
      is_active,
      is_hidden,
      created_at,
      updated_at
    from public.products
    where category_name = ${sqlString(OLD_CATEGORY)}
    order by name, id;
  `);
}

async function upsertProducts(products) {
  const rows = products.map((product, index) => ({
    id: product.id,
    nome: normalizeText(product.name),
    descricao: product.description || null,
    preco: toNumber(product.price),
    categoria: NEW_CATEGORY,
    imagem_url: product.image_url || null,
    disponivel: FORCE_AVAILABLE ? true : Boolean(product.is_active) && !Boolean(product.is_hidden),
    destaque: false,
    ordem: index + 1,
    created_at: product.created_at,
    updated_at: product.updated_at,
  }));

  if (rows.length === 0) return rows;

  if (TARGET_TABLE !== "produtos") {
    throw new Error(`Unsupported TARGET_TABLE for this script: ${TARGET_TABLE}`);
  }

  await newQuery(
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
      disponivel = excluded.disponivel,
      destaque = excluded.destaque,
      ordem = excluded.ordem,
      updated_at = excluded.updated_at;
    `,
    false
  );

  return rows;
}

async function validate() {
  return newQuery(`
    select categoria, count(*)::int total,
      count(*) filter (where disponivel)::int disponiveis,
      count(*) filter (where imagem_url is not null and btrim(imagem_url) <> '')::int com_imagem
    from public.produtos
    where categoria = ${sqlString(NEW_CATEGORY)}
    group by categoria;
  `);
}

async function main() {
  await ensureCategory();
  const products = await fetchOldProducts();
  const rows = await upsertProducts(products);
  const validation = await validate();

  console.log(JSON.stringify({
    oldCategory: OLD_CATEGORY,
    newCategory: NEW_CATEGORY,
    fetched: products.length,
    insertedOrUpdated: rows.length,
    validation,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  process.exit(1);
});
