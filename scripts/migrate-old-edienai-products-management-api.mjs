#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const OLD_TOKEN = process.env.OLD_TOKEN;
const NEW_TOKEN = process.env.NEW_TOKEN;
const OLD_REF = process.env.OLD_REF || "azqnyluvhgqxjrpxylne";
const NEW_REF = process.env.NEW_REF || "bawysvqqeqwxasmggfcn";
const DRY_RUN = process.env.DRY_RUN === "1";

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

async function oldQuery(sql) {
  return api(OLD_TOKEN, OLD_REF, sql, true);
}

async function newQuery(sql, readOnly = true) {
  if (!readOnly && DRY_RUN) {
    console.log("[dry-run]", sql.trim().slice(0, 600));
    return [];
  }
  return api(NEW_TOKEN, NEW_REF, sql, readOnly);
}

function makeDollarQuoted(value) {
  const json = JSON.stringify(value);
  let index = 0;
  while (json.includes(`$json${index}$`)) index += 1;
  return `$json${index}$${json}$json${index}$`;
}

function makeTextDollarQuoted(value) {
  const text = String(value ?? "");
  let index = 0;
  while (text.includes(`$text${index}$`)) index += 1;
  return `$text${index}$${text}$text${index}$`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function targetCategory(product) {
  const category = normalizeText(product.category_name).toLowerCase();
  const name = normalizeText(product.name).toLowerCase();

  if (category === "salgados" && name.includes("past")) return "Pasteis";
  if (category === "salgados") return "Salgados";
  if (category === "refrigerantes") return "Refrigerantes";
  if (category === "cervejas") return "Cervejas";
  return null;
}

function isBeverageCategory(category) {
  return category === "Cervejas" || category === "Refrigerantes";
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function ensureCategoriesTable() {
  await newQuery(
    `
    create table if not exists public.categorias_cardapio (
      id uuid primary key default gen_random_uuid(),
      nome text not null,
      tipo text not null check (tipo in ('produto', 'bebida', 'combo')),
      ativo boolean not null default true,
      ordem integer not null default 0,
      created_at timestamptz not null default timezone('utc'::text, now()),
      updated_at timestamptz not null default timezone('utc'::text, now()),
      constraint categorias_cardapio_nome_tipo_key unique (nome, tipo)
    );

    create index if not exists idx_categorias_cardapio_ativo_ordem
      on public.categorias_cardapio (ativo, ordem, nome);

    create or replace function public.atualizar_updated_at_categorias_cardapio()
    returns trigger
    language plpgsql
    as $$
    begin
      new.updated_at = timezone('utc'::text, now());
      return new;
    end;
    $$;

    drop trigger if exists atualizar_categorias_cardapio_updated_at on public.categorias_cardapio;
    create trigger atualizar_categorias_cardapio_updated_at
      before update on public.categorias_cardapio
      for each row
      execute function public.atualizar_updated_at_categorias_cardapio();

    grant select on public.categorias_cardapio to anon;
    grant select, insert, update, delete on public.categorias_cardapio to authenticated;
    grant all on public.categorias_cardapio to service_role;
    `,
    false
  );
}

async function fetchSelectedProducts() {
  return oldQuery(`
    select
      id,
      name,
      description,
      price,
      category_name,
      image_url,
      is_active,
      is_hidden,
      created_at,
      updated_at
    from public.products
    where category_name in ('salgados', 'refrigerantes', 'cervejas')
    order by category_name, name, id;
  `);
}

async function upsertCategories() {
  const categories = [
    { nome: "Salgados", tipo: "produto", ativo: true, ordem: 1 },
    { nome: "Pasteis", tipo: "produto", ativo: true, ordem: 2 },
    { nome: "Refrigerantes", tipo: "bebida", ativo: true, ordem: 3 },
    { nome: "Cervejas", tipo: "bebida", ativo: true, ordem: 4 },
    { nome: "Combos", tipo: "combo", ativo: true, ordem: 5 },
  ];

  await newQuery(
    `
    insert into public.categorias_cardapio (nome, tipo, ativo, ordem)
    select nome, tipo, ativo, ordem
    from jsonb_populate_recordset(null::public.categorias_cardapio, ${makeDollarQuoted(categories)}::jsonb)
    on conflict (nome, tipo) do update set
      ativo = excluded.ativo,
      ordem = excluded.ordem;
    `,
    false
  );
}

async function upsertCatalogRows(products) {
  const productRows = [];
  const beverageRows = [];
  const orderByCategory = new Map();

  for (const product of products) {
    const category = targetCategory(product);
    if (!category) continue;

    const nextOrder = (orderByCategory.get(category) || 0) + 1;
    orderByCategory.set(category, nextOrder);

    const row = {
      id: product.id,
      nome: normalizeText(product.name),
      descricao: product.description || null,
      preco: toNumber(product.price),
      categoria: category,
      imagem_url: product.image_url || null,
      disponivel: Boolean(product.is_active) && !Boolean(product.is_hidden),
      ordem: nextOrder,
      created_at: product.created_at,
      updated_at: product.updated_at,
    };

    if (isBeverageCategory(category)) {
      beverageRows.push({ ...row, tamanho: null });
    } else {
      productRows.push({ ...row, destaque: false });
    }
  }

  if (productRows.length > 0) {
    await newQuery(
      `
      insert into public.produtos (
        id, nome, descricao, preco, categoria, imagem_url, disponivel, destaque, ordem, created_at, updated_at
      )
      select id, nome, descricao, preco, categoria, imagem_url, disponivel, destaque, ordem, created_at, updated_at
      from jsonb_populate_recordset(null::public.produtos, ${makeDollarQuoted(productRows)}::jsonb)
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
  }

  if (beverageRows.length > 0) {
    await newQuery(
      `
      insert into public.bebidas (
        id, nome, descricao, preco, categoria, imagem_url, disponivel, ordem, created_at, updated_at, tamanho
      )
      select id, nome, descricao, preco, categoria, imagem_url, disponivel, ordem, created_at, updated_at, tamanho
      from jsonb_populate_recordset(null::public.bebidas, ${makeDollarQuoted(beverageRows)}::jsonb)
      on conflict (id) do update set
        nome = excluded.nome,
        descricao = excluded.descricao,
        preco = excluded.preco,
        categoria = excluded.categoria,
        imagem_url = excluded.imagem_url,
        disponivel = excluded.disponivel,
        ordem = excluded.ordem,
        updated_at = excluded.updated_at,
        tamanho = excluded.tamanho;
      `,
      false
    );
  }

  return { productRows, beverageRows };
}

async function persistCategoryOrder() {
  const order = ["Salgados", "Pasteis", "Refrigerantes", "Cervejas", "Combos"];
  await newQuery(
    `
    insert into public.configuracoes_loja (chave, valor, tipo, descricao)
    values (
      'ordem_categorias_produtos',
      ${makeTextDollarQuoted(JSON.stringify(order))},
      'json',
      'Ordem manual das categorias exibidas no cardápio público.'
    )
    on conflict (chave) do update set
      valor = excluded.valor,
      tipo = excluded.tipo,
      descricao = excluded.descricao,
      updated_at = timezone('utc'::text, now());
    `,
    false
  );
}

async function validate() {
  return newQuery(`
    select 'produtos' as tabela, categoria, count(*)::int total,
      count(*) filter (where disponivel)::int disponiveis,
      count(*) filter (where imagem_url is not null and btrim(imagem_url) <> '')::int com_imagem
    from public.produtos
    group by categoria
    union all
    select 'bebidas' as tabela, categoria, count(*)::int total,
      count(*) filter (where disponivel)::int disponiveis,
      count(*) filter (where imagem_url is not null and btrim(imagem_url) <> '')::int com_imagem
    from public.bebidas
    group by categoria
    order by tabela, categoria;
  `);
}

async function main() {
  await ensureCategoriesTable();
  await upsertCategories();

  const products = await fetchSelectedProducts();
  const { productRows, beverageRows } = await upsertCatalogRows(products);
  await persistCategoryOrder();

  const validation = await validate();
  console.log(
    JSON.stringify(
      {
        fetched: products.length,
        insertedOrUpdated: {
          produtos: productRows.length,
          bebidas: beverageRows.length,
        },
        validation,
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
