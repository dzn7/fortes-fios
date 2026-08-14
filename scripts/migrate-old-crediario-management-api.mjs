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
    },
  );

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }
  return payload;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chunk(items, size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function insertAccounts(rows) {
  for (const group of chunk(rows, 150)) {
    const payload = JSON.stringify(group);
    await api(NEW_TOKEN, NEW_REF, `
      insert into public.crediario_contas (
        id,
        cliente_nome,
        cliente_chave,
        status,
        saldo_atual,
        origem,
        legado_id,
        legado_firebase_id,
        metadata,
        criado_em,
        atualizado_em,
        quitado_em
      )
      select
        id,
        cliente_nome,
        cliente_chave,
        status,
        saldo_atual,
        origem,
        legado_id,
        legado_firebase_id,
        metadata,
        criado_em,
        atualizado_em,
        quitado_em
      from jsonb_to_recordset(${sqlLiteral(payload)}::jsonb) as x(
        id uuid,
        cliente_nome text,
        cliente_chave text,
        status text,
        saldo_atual numeric,
        origem text,
        legado_id uuid,
        legado_firebase_id text,
        metadata jsonb,
        criado_em timestamptz,
        atualizado_em timestamptz,
        quitado_em timestamptz
      )
      on conflict (id) do update set
        cliente_nome = excluded.cliente_nome,
        cliente_chave = excluded.cliente_chave,
        saldo_atual = excluded.saldo_atual,
        status = excluded.status,
        origem = excluded.origem,
        legado_id = excluded.legado_id,
        legado_firebase_id = excluded.legado_firebase_id,
        metadata = excluded.metadata,
        criado_em = excluded.criado_em,
        atualizado_em = excluded.atualizado_em,
        quitado_em = excluded.quitado_em;
    `, false);
  }
}

async function insertMovements(rows) {
  for (const group of chunk(rows, 80)) {
    const payload = JSON.stringify(group);
    await api(NEW_TOKEN, NEW_REF, `
      insert into public.crediario_movimentos (
        id,
        conta_id,
        pedido_id,
        tipo,
        status,
        valor,
        descricao,
        itens,
        origem,
        legado_id,
        legado_order_id,
        legado_firebase_id,
        realizado_em,
        criado_em,
        metadata
      )
      select
        id,
        conta_id,
        null,
        tipo,
        status,
        valor,
        descricao,
        itens,
        origem,
        legado_id,
        legado_order_id,
        legado_firebase_id,
        realizado_em,
        criado_em,
        metadata
      from jsonb_to_recordset(${sqlLiteral(payload)}::jsonb) as x(
        id uuid,
        conta_id uuid,
        tipo text,
        status text,
        valor numeric,
        descricao text,
        itens jsonb,
        origem text,
        legado_id uuid,
        legado_order_id uuid,
        legado_firebase_id text,
        realizado_em timestamptz,
        criado_em timestamptz,
        metadata jsonb
      )
      on conflict (id) do update set
        conta_id = excluded.conta_id,
        tipo = excluded.tipo,
        status = excluded.status,
        valor = excluded.valor,
        descricao = excluded.descricao,
        itens = excluded.itens,
        origem = excluded.origem,
        legado_id = excluded.legado_id,
        legado_order_id = excluded.legado_order_id,
        legado_firebase_id = excluded.legado_firebase_id,
        realizado_em = excluded.realizado_em,
        criado_em = excluded.criado_em,
        metadata = excluded.metadata;
    `, false);
  }
}

async function main() {
  const [accounts, movements] = await Promise.all([
    api(OLD_TOKEN, OLD_REF, `
      select *
      from public.crediarios
      order by created_at asc, id asc;
    `),
    api(OLD_TOKEN, OLD_REF, `
      select *
      from public.crediario_history
      order by date asc, created_at asc, id asc;
    `),
  ]);

  const accountRows = accounts.map((account) => {
    const balance = toNumber(account.total_balance);
    const isOpen = balance > 0;
    return {
      id: account.id,
      cliente_nome: account.customer_name || "Cliente",
      cliente_chave: `legado:${account.id}`,
      status: isOpen ? "aberto" : "quitado",
      saldo_atual: balance,
      origem: "migracao_edienai_antigo",
      legado_id: account.id,
      legado_firebase_id: account.firebase_id || null,
      metadata: {
        legado_is_active: Boolean(account.is_active),
        saldo_legado: balance,
      },
      criado_em: account.created_at,
      atualizado_em: account.updated_at || account.created_at,
      quitado_em: isOpen ? null : account.updated_at || account.created_at,
    };
  });

  const movementRows = movements.map((movement) => ({
    id: movement.id,
    conta_id: movement.crediario_id,
    tipo: movement.type === "payment" ? "pagamento" : "consumo",
    status: "ativo",
    valor: Math.max(toNumber(movement.amount), 0),
    descricao: movement.description || null,
    itens: parseJson(movement.items_consumed),
    origem: "migracao_edienai_antigo",
    legado_id: movement.id,
    legado_order_id: movement.order_id || null,
    legado_firebase_id: movement.firebase_id || null,
    realizado_em: movement.date || movement.created_at,
    criado_em: movement.created_at || movement.date,
    metadata: {
      tipo_legado: movement.type,
      items_consumed_raw: parseJson(movement.items_consumed) ? null : movement.items_consumed || null,
    },
  }));

  await insertAccounts(accountRows);
  await insertMovements(movementRows);

  await api(NEW_TOKEN, NEW_REF, `
    select public.recalcular_crediario_conta(id)
    from public.crediario_contas
    where origem = 'migracao_edienai_antigo';
  `, false);

  const [summary, typeCounts] = await Promise.all([
    api(NEW_TOKEN, NEW_REF, `
      select
        count(*)::int as contas,
        count(*) filter (where status = 'aberto')::int as abertas,
        coalesce(sum(saldo_atual), 0)::numeric(12,2) as saldo_total
      from public.crediario_contas
      where origem = 'migracao_edienai_antigo';
    `),
    api(NEW_TOKEN, NEW_REF, `
      select tipo, count(*)::int as total, coalesce(sum(valor), 0)::numeric(12,2) as valor
      from public.crediario_movimentos
      where origem = 'migracao_edienai_antigo'
      group by 1
      order by 1;
    `),
  ]);

  console.log(JSON.stringify({
    imported: {
      accounts: accountRows.length,
      movements: movementRows.length,
    },
    summary: summary[0],
    typeCounts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
