-- Paga unidades que estao no fiado sem criar um segundo movimento de pagamento.
-- A operacao e atomica: reduz o consumo vinculado ao pedido e registra o
-- pagamento em pagamentos_pedido na mesma transacao.
create or replace function public.registrar_pagamento_item_crediario(
  p_movimento_id uuid,
  p_itens_pagos jsonb,
  p_forma_pagamento text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_movimento public.crediario_movimentos%rowtype;
  v_forma text := lower(trim(coalesce(p_forma_pagamento, '')));
  v_solicitados jsonb;
  v_pendentes jsonb;
  v_item jsonb;
  v_item_id text;
  v_quantidade_original integer;
  v_quantidade_pagar integer;
  v_quantidade_restante integer;
  v_subtotal_original numeric(12,2);
  v_subtotal_pago numeric(12,2);
  v_subtotal_restante numeric(12,2);
  v_itens_restantes jsonb := '[]'::jsonb;
  v_itens_confirmados jsonb := '[]'::jsonb;
  v_valor_pago numeric(12,2) := 0;
  v_pagamento_id uuid;
begin
  if v_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'Forma de pagamento invalida';
  end if;

  if jsonb_typeof(p_itens_pagos) <> 'array' or jsonb_array_length(p_itens_pagos) = 0 then
    raise exception 'Selecione ao menos uma unidade para pagamento';
  end if;

  select coalesce(jsonb_object_agg(item_id, quantidade), '{}'::jsonb)
  into v_solicitados
  from (
    select
      nullif(trim(item->>'id'), '') as item_id,
      sum(floor(coalesce(nullif(item->>'quantidade', '')::numeric, 0)))::integer as quantidade
    from jsonb_array_elements(p_itens_pagos) item
    group by nullif(trim(item->>'id'), '')
  ) solicitacoes;

  if exists (
    select 1
    from jsonb_each_text(v_solicitados) solicitacao(item_id, quantidade)
    where solicitacao.item_id is null or solicitacao.quantidade::integer <= 0
  ) then
    raise exception 'Itens de pagamento invalidos';
  end if;

  select *
  into v_movimento
  from public.crediario_movimentos
  where id = p_movimento_id
  for update;

  if v_movimento.id is null
    or v_movimento.tipo <> 'consumo'
    or v_movimento.origem <> 'pedido'
    or v_movimento.status <> 'ativo'
    or v_movimento.pedido_id is null then
    raise exception 'Item do crediario nao esta disponivel para pagamento';
  end if;

  if jsonb_typeof(v_movimento.itens) <> 'array' then
    raise exception 'Itens do crediario invalidos';
  end if;

  v_pendentes := v_solicitados;

  for v_item in select value from jsonb_array_elements(v_movimento.itens)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    v_quantidade_original := floor(coalesce(nullif(v_item->>'quantidade', '')::numeric, 0))::integer;
    v_quantidade_pagar := coalesce(nullif(v_pendentes->>v_item_id, '')::integer, 0);

    if v_item_id is null or v_quantidade_original <= 0 then
      raise exception 'Snapshot do crediario invalido';
    end if;

    if v_quantidade_pagar <= 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(v_item);
      continue;
    end if;

    v_quantidade_pagar := least(v_quantidade_pagar, v_quantidade_original);
    v_quantidade_restante := v_quantidade_original - v_quantidade_pagar;
    v_subtotal_original := coalesce(nullif(v_item->>'subtotal', '')::numeric, 0);
    v_subtotal_pago := round(v_subtotal_original * v_quantidade_pagar / v_quantidade_original, 2);
    v_subtotal_restante := v_subtotal_original - v_subtotal_pago;
    v_valor_pago := v_valor_pago + v_subtotal_pago;

    v_itens_confirmados := v_itens_confirmados || jsonb_build_array(
      jsonb_set(
        jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_pagar)),
        '{subtotal}', to_jsonb(v_subtotal_pago)
      )
    );

    if v_quantidade_restante > 0 then
      v_itens_restantes := v_itens_restantes || jsonb_build_array(
        jsonb_set(
          jsonb_set(v_item, '{quantidade}', to_jsonb(v_quantidade_restante)),
          '{subtotal}', to_jsonb(v_subtotal_restante)
        )
      );
    end if;

    v_pendentes := jsonb_set(v_pendentes, array[v_item_id], to_jsonb(greatest((v_pendentes->>v_item_id)::integer - v_quantidade_pagar, 0)));
  end loop;

  if exists (
    select 1 from jsonb_each_text(v_pendentes) pendente(item_id, quantidade)
    where pendente.quantidade::integer > 0
  ) then
    raise exception 'Quantidade solicitada nao esta mais no crediario';
  end if;

  if v_valor_pago <= 0 or v_valor_pago > v_movimento.valor then
    raise exception 'Valor de pagamento invalido para este consumo';
  end if;

  update public.crediario_movimentos
  set itens = v_itens_restantes,
      valor = v_movimento.valor - v_valor_pago,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ultimo_pagamento_item_em', timezone('utc'::text, now()))
  where id = v_movimento.id;

  insert into public.pagamentos_pedido (pedido_id, forma_pagamento, valor, itens_pagos)
  values (v_movimento.pedido_id, v_forma, v_valor_pago, v_itens_confirmados)
  returning id into v_pagamento_id;

  return v_pagamento_id;
end;
$function$;
