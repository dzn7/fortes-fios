begin;

do $$
declare
  v_produto_id uuid;
  v_pedido_id uuid;
  v_item_id uuid;
  v_quantidade integer;
  v_consumida integer;
begin
  insert into public.produtos (nome, preco, categoria, disponivel)
  values ('__teste_estoque_default__', 1, '__teste__', true)
  returning id into v_produto_id;

  select estoque_quantidade
    into v_quantidade
    from public.produtos
   where id = v_produto_id;

  if v_quantidade <> 0 then
    raise exception 'default de estoque deveria ser 0, recebido %', v_quantidade;
  end if;

  update public.produtos
     set estoque_quantidade = 2,
         estoque_minimo = 1,
         bloquear_venda_sem_estoque = true
   where id = v_produto_id;

  insert into public.pedidos (
    numero_pedido,
    nome_cliente,
    tipo_entrega,
    subtotal,
    total,
    status
  ) values (
    2147483000,
    '__teste_estoque__',
    'retirada',
    2,
    2,
    'pendente'
  ) returning id into v_pedido_id;

  insert into public.itens_pedido (
    pedido_id,
    produto_id,
    nome_item,
    quantidade,
    preco_unitario,
    subtotal
  ) values (
    v_pedido_id,
    v_produto_id,
    '__teste_estoque__',
    1,
    1,
    1
  ) returning id, estoque_quantidade_consumida into v_item_id, v_consumida;

  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 1 or v_consumida <> 1 then
    raise exception 'reserva inicial incorreta: saldo %, consumida %', v_quantidade, v_consumida;
  end if;

  update public.itens_pedido set quantidade = 2, subtotal = 2 where id = v_item_id;
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  select estoque_quantidade_consumida into v_consumida
    from public.itens_pedido where id = v_item_id;
  if v_quantidade <> 0 or v_consumida <> 2 then
    raise exception 'alteração de quantidade incorreta: saldo %, consumida %', v_quantidade, v_consumida;
  end if;

  begin
    update public.itens_pedido set quantidade = 3, subtotal = 3 where id = v_item_id;
    raise exception 'deveria rejeitar quantidade acima do estoque';
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'ESTOQUE_INSUFICIENTE:%' then
        raise;
      end if;
  end;

  delete from public.itens_pedido where id = v_item_id;
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 2 then
    raise exception 'remoção deveria restaurar 2 unidades, saldo %', v_quantidade;
  end if;

  insert into public.itens_pedido (
    pedido_id, produto_id, nome_item, quantidade, preco_unitario, subtotal
  ) values (
    v_pedido_id, v_produto_id, '__teste_estoque__', 2, 1, 2
  ) returning id into v_item_id;

  update public.pedidos set status = 'cancelado' where id = v_pedido_id;
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 2 then
    raise exception 'cancelamento deveria restaurar estoque, saldo %', v_quantidade;
  end if;

  update public.pedidos set status = 'pendente' where id = v_pedido_id;
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 0 then
    raise exception 'reabertura deveria reservar novamente, saldo %', v_quantidade;
  end if;

  update public.pedidos set status = 'cancelado' where id = v_pedido_id;
  perform public.definir_estoque_produto(v_produto_id, 4);
  perform public.ajustar_estoque_produto(v_produto_id, -1);
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 3 then
    raise exception 'funções atômicas deveriam resultar em 3, saldo %', v_quantidade;
  end if;

  begin
    perform public.ajustar_estoque_produto(v_produto_id, -4);
    raise exception 'ajuste negativo deveria falhar';
  exception
    when check_violation then null;
  end;

  update public.produtos
     set estoque_quantidade = 0,
         bloquear_venda_sem_estoque = false
   where id = v_produto_id;
  update public.pedidos set status = 'pendente' where id = v_pedido_id;
  select estoque_quantidade into v_quantidade
    from public.produtos where id = v_produto_id;
  if v_quantidade <> 0 then
    raise exception 'produto liberado com zero não pode ficar negativo, saldo %', v_quantidade;
  end if;
end;
$$;

rollback;
