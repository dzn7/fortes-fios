#!/usr/bin/env node

const API_BASE = "https://api.supabase.com";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "bawysvqqeqwxasmggfcn";

if (!ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

async function query(sql) {
  const response = await fetch(`${API_BASE}/v1/projects/${PROJECT_REF}/database/query/read-only`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${response.status}: ${payload?.message || text}`);
  }

  return payload;
}

async function main() {
  const [columns, functionChecks, accountSamples, movementSamples] = await Promise.all([
    query(`
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('crediario_contas', 'crediario_movimentos')
      order by table_name, ordinal_position;
    `),
    query(`
      select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'quitar_crediario',
          'cancelar_movimento_crediario',
          'registrar_pagamento_crediario',
          'apagar_item_movimento_crediario',
          'recalcular_crediario_conta'
        )
      order by p.proname, args;
    `),
    query(`
      select
        c.id,
        c.cliente_nome,
        c.telefone,
        c.status,
        c.saldo_atual::numeric(12,2) as saldo_atual,
        c.origem,
        count(m.id)::int as movimentos,
        count(m.id) filter (where m.tipo = 'consumo' and m.status = 'ativo')::int as consumos,
        count(m.id) filter (where m.tipo = 'pagamento' and m.status = 'ativo')::int as pagamentos,
        count(m.id) filter (where m.tipo = 'consumo' and m.status = 'ativo' and jsonb_array_length(coalesce(m.itens, '[]'::jsonb)) > 0)::int as consumos_com_itens,
        max(m.realizado_em) as ultimo_movimento
      from public.crediario_contas c
      left join public.crediario_movimentos m on m.conta_id = c.id
      where lower(c.cliente_nome) like '%derick%'
         or c.status = 'quitado'
      group by c.id, c.cliente_nome, c.telefone, c.status, c.saldo_atual, c.origem
      order by c.atualizado_em desc
      limit 8;
    `),
    query(`
      select
        c.cliente_nome,
        c.status as conta_status,
        c.saldo_atual::numeric(12,2) as saldo_conta,
        m.id,
        m.tipo,
        m.status,
        m.valor::numeric(12,2) as valor,
        m.descricao,
        m.origem,
        m.realizado_em,
        jsonb_array_length(coalesce(m.itens, '[]'::jsonb)) as itens_count,
        m.metadata
      from public.crediario_movimentos m
      join public.crediario_contas c on c.id = m.conta_id
      where lower(c.cliente_nome) like '%derick%'
         or c.status = 'quitado'
      order by c.atualizado_em desc, m.realizado_em asc
      limit 40;
    `),
  ]);

  console.log(JSON.stringify({
    columns,
    functionChecks,
    accountSamples,
    movementSamples,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
