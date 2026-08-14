#!/usr/bin/env node

import crypto from "node:crypto";

const API_BASE = "https://api.supabase.com";
const OLD_TOKEN = process.env.OLD_TOKEN;
const NEW_TOKEN = process.env.NEW_TOKEN;
const OLD_REF = process.env.OLD_REF || "azqnyluvhgqxjrpxylne";
const NEW_REF = process.env.NEW_REF || "bawysvqqeqwxasmggfcn";
const BATCH_SIZE = Number.parseInt(process.env.BATCH_SIZE || "250", 10);
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

async function newRead(sql) {
  return api(NEW_TOKEN, NEW_REF, sql, true);
}

async function newWrite(sql) {
  if (DRY_RUN) return [];
  return api(NEW_TOKEN, NEW_REF, sql, false);
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function makeDollarQuoted(value) {
  const json = JSON.stringify(value);
  let index = 0;
  while (json.includes(`$json${index}$`)) index += 1;
  return `$json${index}$${json}$json${index}$`;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits || null;
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "concluido") return "entregue";
  if (value === "saiu_entrega") return "saiu_para_entrega";
  if (value === "em_preparo" || value === "preparando") return "preparando";
  if (value === "pronto") return "pronto";
  if (value === "cancelado") return "cancelado";
  if (value === "aguardando_pagamento" || value === "nao-pago") return "aguardando_pagamento";
  if (value === "pago_online") return "confirmado";
  return "pendente";
}

function normalizeDeliveryType(deliveryOption) {
  const value = String(deliveryOption?.type || "").toLowerCase();
  if (value.includes("entrega") || value === "delivery") return "entrega";
  if (value.includes("retirada")) return "retirada";
  return "local";
}

function normalizePaymentMethod(method) {
  const value = String(method || "").trim();
  const lower = value.toLowerCase();
  if (!value) return "Não informado";
  if (lower.includes("mercado pago") && lower.includes("pix")) return "PIX Online";
  if (lower.includes("mercado pago") && lower.includes("cart")) return "Cartão Online";
  if (lower.includes("pix")) return "PIX";
  if (lower.includes("cart")) return "Cartão";
  if (lower.includes("crediario") || lower.includes("crediário")) return "Crediário";
  if (lower.includes("dinheiro")) return "Dinheiro";
  return value;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function insertRows(tableName, rows) {
  if (rows.length === 0) return;
  const payload = makeDollarQuoted(rows);
  await newWrite(`
    insert into public.${quoteIdent(tableName)}
    select *
    from jsonb_populate_recordset(null::public.${quoteIdent(tableName)}, ${payload}::jsonb)
    on conflict do nothing;
  `);
}

async function upsertClients(rows) {
  if (rows.length === 0) return;
  const payload = makeDollarQuoted(rows);
  await newWrite(`
    insert into public.usuarios_cliente
    select *
    from jsonb_populate_recordset(null::public.usuarios_cliente, ${payload}::jsonb)
    on conflict (id) do update set
      nome = coalesce(excluded.nome, usuarios_cliente.nome),
      primeiro_pedido_em = least(
        coalesce(usuarios_cliente.primeiro_pedido_em, excluded.primeiro_pedido_em),
        coalesce(excluded.primeiro_pedido_em, usuarios_cliente.primeiro_pedido_em)
      ),
      ultimo_pedido_em = greatest(
        coalesce(usuarios_cliente.ultimo_pedido_em, excluded.ultimo_pedido_em),
        coalesce(excluded.ultimo_pedido_em, usuarios_cliente.ultimo_pedido_em)
      ),
      updated_at = greatest(
        coalesce(usuarios_cliente.updated_at, excluded.updated_at),
        coalesce(excluded.updated_at, usuarios_cliente.updated_at)
      ),
      endereco = coalesce(excluded.endereco, usuarios_cliente.endereco),
      bairro = coalesce(excluded.bairro, usuarios_cliente.bairro),
      complemento = coalesce(excluded.complemento, usuarios_cliente.complemento);
  `);
}

async function countOldOrders2026() {
  const rows = await oldQuery(`
    select count(*)::int as count
    from public.orders
    where created_at >= '2026-01-01'::timestamptz
      and created_at < '2027-01-01'::timestamptz;
  `);
  return rows[0]?.count ?? 0;
}

async function fetchOldOrdersBatch(limit, offset) {
  return oldQuery(`
    select
      row_number() over (order by created_at, id)::int as numero_pedido_migrado,
      *
    from public.orders
    where created_at >= '2026-01-01'::timestamptz
      and created_at < '2027-01-01'::timestamptz
    order by created_at, id
    limit ${limit}
    offset ${offset};
  `);
}

async function disableOperationalTriggers() {
  await newWrite("alter table public.pedidos disable trigger user;");
  await newWrite("alter table public.itens_pedido disable trigger user;");
}

async function enableOperationalTriggers() {
  await newWrite("alter table public.itens_pedido enable trigger user;");
  await newWrite("alter table public.pedidos enable trigger user;");
}

async function validateDestinationEmpty() {
  const rows = await newRead(`
    select
      (select count(*)::int from public.pedidos where created_at >= '2026-01-01'::timestamptz and created_at < '2027-01-01'::timestamptz) as pedidos_2026,
      (select count(*)::int from public.itens_pedido) as itens_pedido,
      (select count(*)::int from public.usuarios_cliente) as usuarios_cliente,
      (select count(*)::int from public.pagamentos_pedido) as pagamentos_pedido,
      (select count(*)::int from public.entregas) as entregas;
  `);
  return rows[0];
}

function makeClientId(phone) {
  const hash = crypto.createHash("sha256").update(`edienai:${phone}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function mapOrder(order, clientId) {
  const deliveryOption = order.delivery_option || {};
  const tipoEntrega = normalizeDeliveryType(deliveryOption);
  const taxaEntrega = toNumber(deliveryOption.fee, 0);
  const discountValue = toNumber(order.discount_value, 0);
  const total = toNumber(order.total, 0);
  const subtotal = Math.max(total - taxaEntrega + discountValue, 0);
  const mesaValue = deliveryOption.tableNumber || null;
  const mesaNumber = mesaValue === null || mesaValue === "" ? null : Number.parseInt(String(mesaValue), 10);
  const paymentMethod = normalizePaymentMethod(order.payment_method);
  const status = normalizeStatus(order.status);
  const isOnlinePayment = paymentMethod.includes("Online");

  return {
    id: order.id,
    numero_pedido: order.numero_pedido_migrado,
    nome_cliente: order.customer_name || "Cliente",
    telefone: normalizePhone(order.customer_phone),
    tipo_entrega: tipoEntrega,
    endereco_entrega: tipoEntrega === "entrega" ? deliveryOption.address || null : null,
    bairro: tipoEntrega === "entrega" ? deliveryOption.location || null : null,
    taxa_entrega: taxaEntrega,
    forma_pagamento: paymentMethod,
    troco_para: null,
    subtotal,
    total,
    status,
    observacoes: order.notes || order.observacao_pagamento || null,
    mesa_id: null,
    created_at: order.created_at,
    updated_at: order.updated_at || order.created_at,
    endereco: deliveryOption.address || null,
    complemento: null,
    referencia: null,
    mesa: Number.isFinite(mesaNumber) ? mesaNumber : null,
    cupom_id: null,
    cupom_codigo: null,
    tipo_desconto_cupom: order.discount_type || null,
    desconto_cupom: 0,
    desconto_frete: 0,
    comanda: null,
    taxa_servico: 0,
    pagamento_online: isOnlinePayment,
    pagamento_online_status: isOnlinePayment
      ? status === "aguardando_pagamento"
        ? "aguardando_pagamento"
        : "pago"
      : "nao_aplicavel",
    pagamento_online_pago_em: isOnlinePayment && status !== "aguardando_pagamento" ? order.updated_at || order.created_at : null,
    pagamento_online_gateway: isOnlinePayment ? "mercado_pago" : null,
    pagamento_online_referencia: order.firebase_id || null,
    taxa_pagamento: 0,
    origem: "migracao_edienai_antigo_2026",
    garcom_id: null,
    subtotal_original: subtotal,
    total_original: total + discountValue,
    desconto_itens_total: 0,
    desconto_manual: discountValue,
    cliente_id: clientId,
  };
}

function mapItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.map((item) => {
    const quantity = toNumber(item.quantity ?? item.quantidade, 1);
    const unitPrice = toNumber(item.unitPriceWithComplements ?? item.basePrice ?? item.preco, 0);
    const subtotal = toNumber(item.totalItemPrice, unitPrice * quantity);
    return {
      id: crypto.randomUUID(),
      pedido_id: order.id,
      produto_id: null,
      bebida_id: null,
      combo_id: null,
      nome_item: item.name || item.nome || "Item migrado",
      quantidade: quantity,
      preco_unitario: unitPrice,
      subtotal,
      observacoes: item.notes || item.observacao || null,
      created_at: toIsoOrNull(item.adicionado_em) || order.created_at,
      nome_produto: item.name || item.nome || "Item migrado",
      preco_total: subtotal,
      adicionado_por_garcom_id: null,
      subtotal_original: subtotal + toNumber(item.desconto_valor, 0),
      desconto_manual: toNumber(item.desconto_valor, 0),
      _complements: Array.isArray(item.complements) ? item.complements : [],
    };
  });
}

function mapComplements(itemRow) {
  return itemRow._complements.map((complement) => ({
    id: crypto.randomUUID(),
    item_pedido_id: itemRow.id,
    adicional_id: null,
    nome: complement.name || complement.nome || "Adicional",
    preco: toNumber(complement.price ?? complement.preco, 0),
    quantidade: toNumber(complement.quantity ?? complement.quantidade, 1),
    created_at: itemRow.created_at,
  }));
}

function mapPayment(order) {
  return {
    id: crypto.randomUUID(),
    pedido_id: order.id,
    forma_pagamento: normalizePaymentMethod(order.payment_method),
    valor: toNumber(order.total, 0),
    troco_para: null,
    created_at: order.created_at,
    troco: null,
    bandeira: null,
    nsu: order.firebase_id || null,
  };
}

function mapDelivery(order) {
  const deliveryOption = order.delivery_option || {};
  if (normalizeDeliveryType(deliveryOption) !== "entrega") return null;
  const status = normalizeStatus(order.status);
  return {
    id: crypto.randomUUID(),
    pedido_id: order.id,
    entregador_id: null,
    status:
      status === "entregue"
        ? "entregue"
        : status === "saiu_para_entrega"
          ? "em_rota"
          : status === "cancelado"
            ? "cancelada"
            : "pendente",
    endereco_entrega: deliveryOption.address || null,
    bairro: deliveryOption.location || null,
    taxa_entrega: toNumber(deliveryOption.fee, 0),
    tempo_estimado: null,
    tempo_real: null,
    distancia_km: null,
    observacoes: order.notes || null,
    data_saida: status === "saiu_para_entrega" || status === "entregue" ? order.updated_at || order.created_at : null,
    data_entrega: status === "entregue" ? order.completed_at || order.updated_at || order.created_at : null,
    created_at: order.created_at,
    updated_at: order.updated_at || order.created_at,
  };
}

async function main() {
  const before = await validateDestinationEmpty();
  if (before.pedidos_2026 > 0 || before.itens_pedido > 0) {
    throw new Error(`Destination already has order data: ${JSON.stringify(before)}`);
  }

  const totalOrders = await countOldOrders2026();
  console.log(JSON.stringify({ totalOrders, batchSize: BATCH_SIZE, dryRun: DRY_RUN }));

  let migratedOrders = 0;
  let migratedItems = 0;
  let migratedComplements = 0;
  let migratedPayments = 0;
  let migratedDeliveries = 0;
  const clients = new Map();

  try {
    await disableOperationalTriggers();

    for (let offset = 0; offset < totalOrders; offset += BATCH_SIZE) {
      const orders = await fetchOldOrdersBatch(BATCH_SIZE, offset);
      const pedidoRows = [];
      const itemRows = [];
      const complementoRows = [];
      const pagamentoRows = [];
      const entregaRows = [];

      for (const order of orders) {
        const phone = normalizePhone(order.customer_phone);
        const clientId = phone ? makeClientId(phone) : null;
        if (phone && !clients.has(phone)) {
          clients.set(phone, {
            id: clientId,
            telefone: phone,
            nome: order.customer_name || null,
            primeiro_pedido_em: order.created_at,
            ultimo_pedido_em: order.created_at,
            created_at: order.created_at,
            updated_at: order.updated_at || order.created_at,
            endereco: order.delivery_option?.address || null,
            bairro: order.delivery_option?.location || null,
            complemento: null,
          });
        } else if (phone) {
          const client = clients.get(phone);
          if (new Date(order.created_at) < new Date(client.primeiro_pedido_em)) client.primeiro_pedido_em = order.created_at;
          if (new Date(order.created_at) > new Date(client.ultimo_pedido_em)) {
            client.ultimo_pedido_em = order.created_at;
            client.nome = order.customer_name || client.nome;
            client.endereco = order.delivery_option?.address || client.endereco;
            client.bairro = order.delivery_option?.location || client.bairro;
            client.updated_at = order.updated_at || order.created_at;
          }
        }

        pedidoRows.push(mapOrder(order, clientId));
        const mappedItems = mapItems(order);
        for (const item of mappedItems) {
          const { _complements, ...cleanItem } = item;
          itemRows.push(cleanItem);
          complementoRows.push(...mapComplements(item));
        }
        pagamentoRows.push(mapPayment(order));
        const delivery = mapDelivery(order);
        if (delivery) entregaRows.push(delivery);
      }

      await upsertClients(Array.from(clients.values()));
      await insertRows("pedidos", pedidoRows);
      await insertRows("itens_pedido", itemRows);
      await insertRows("item_adicionais", complementoRows);
      await insertRows("pagamentos_pedido", pagamentoRows);
      await insertRows("entregas", entregaRows);

      migratedOrders += pedidoRows.length;
      migratedItems += itemRows.length;
      migratedComplements += complementoRows.length;
      migratedPayments += pagamentoRows.length;
      migratedDeliveries += entregaRows.length;

      console.log(
        JSON.stringify({
          offset,
          migratedOrders,
          migratedItems,
          migratedComplements,
          migratedPayments,
          migratedDeliveries,
          clients: clients.size,
        })
      );
    }
  } finally {
    await enableOperationalTriggers();
  }

  const after = await newRead(`
    select
      (select count(*)::int from public.pedidos where origem = 'migracao_edienai_antigo_2026') as pedidos,
      (select count(*)::int from public.itens_pedido ip join public.pedidos p on p.id = ip.pedido_id where p.origem = 'migracao_edienai_antigo_2026') as itens,
      (select count(*)::int from public.item_adicionais ia join public.itens_pedido ip on ip.id = ia.item_pedido_id join public.pedidos p on p.id = ip.pedido_id where p.origem = 'migracao_edienai_antigo_2026') as complementos,
      (select count(*)::int from public.pagamentos_pedido pp join public.pedidos p on p.id = pp.pedido_id where p.origem = 'migracao_edienai_antigo_2026') as pagamentos,
      (select count(*)::int from public.entregas e join public.pedidos p on p.id = e.pedido_id where p.origem = 'migracao_edienai_antigo_2026') as entregas,
      (select coalesce(sum(total),0) from public.pedidos where origem = 'migracao_edienai_antigo_2026') as total_sum;
  `);

  console.log(JSON.stringify({ after: after[0] }, null, 2));
}

main().catch(async (error) => {
  console.error(error.message);
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2));
  try {
    await enableOperationalTriggers();
  } catch {}
  process.exit(1);
});
