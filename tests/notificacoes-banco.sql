-- Teste transacional da Central de Notificações.
-- Executado pela Management API e sempre encerrado com rollback: nenhuma
-- fixture pode sobrar no projeto real.

begin;

do $$
declare
  v_produto uuid;
  v_pedido uuid;
  v_id_baixo uuid;
  v_id_baixo_2 uuid;
  v_id_esgotado uuid;
  v_count integer;
  v_dados jsonb;
  v_prioridade text;
  v_resolvida_em timestamptz;
  v_resumo_total integer;
  v_real_total integer;
begin
  ------------------------------------------------------------------
  -- 15. estoque cruza o limite -> exatamente uma notificação ativa
  ------------------------------------------------------------------
  insert into public.produtos (nome, preco, categoria, disponivel, estoque_quantidade, estoque_minimo)
  values ('__teste_notificacoes__', 1, '__teste__', true, 10, 5)
  returning id into v_produto;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if v_count <> 0 then
    raise exception 'produto saudável não deveria notificar, encontrei %', v_count;
  end if;

  update public.produtos set estoque_quantidade = 3 where id = v_produto;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if v_count <> 1 then
    raise exception 'estoque baixo deveria abrir 1 notificação, abriu %', v_count;
  end if;

  select id, dados into v_id_baixo, v_dados
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if (v_dados->>'quantidade')::int <> 3 then
    raise exception 'dados deveriam registrar quantidade 3, registraram %', v_dados;
  end if;

  ------------------------------------------------------------------
  -- 16. condição continua válida -> não duplica, apenas atualiza
  ------------------------------------------------------------------
  update public.produtos set estoque_quantidade = 2 where id = v_produto;
  update public.produtos set estoque_quantidade = 1 where id = v_produto;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if v_count <> 1 then
    raise exception 'condição contínua não pode duplicar, encontrei % ativas', v_count;
  end if;

  select id, dados into v_id_baixo_2, v_dados
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if v_id_baixo_2 <> v_id_baixo then
    raise exception 'a mesma condição deveria manter a mesma linha';
  end if;
  if (v_dados->>'quantidade')::int <> 1 then
    raise exception 'dados deveriam ter sido atualizados para 1, estão %', v_dados;
  end if;

  ------------------------------------------------------------------
  -- 17. o índice único parcial recusa uma segunda ativa
  ------------------------------------------------------------------
  begin
    insert into public.notificacoes (tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, chave_dedupe)
    values ('estoque_baixo', 'urgente', 'Duplicada', 'Duplicada', 'produto', v_produto,
            'estoque_baixo:' || v_produto::text);
    raise exception 'o banco deveria recusar uma segunda notificação ativa com a mesma chave';
  exception
    when unique_violation then null;
  end;

  ------------------------------------------------------------------
  -- 18. esgotar resolve a de baixo e abre a de esgotado
  ------------------------------------------------------------------
  update public.produtos set estoque_quantidade = 0 where id = v_produto;

  select estado into v_prioridade from public.notificacoes where id = v_id_baixo;
  if v_prioridade <> 'resolvida' then
    raise exception 'estoque baixo deveria ter sido resolvido ao esgotar, está %', v_prioridade;
  end if;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa' and tipo = 'estoque_esgotado';
  if v_count <> 1 then
    raise exception 'esgotar deveria abrir 1 notificação de esgotado, abriu %', v_count;
  end if;

  select id into v_id_esgotado
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa' and tipo = 'estoque_esgotado';

  ------------------------------------------------------------------
  -- 19. repor resolve tudo
  ------------------------------------------------------------------
  update public.produtos set estoque_quantidade = 20 where id = v_produto;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa';
  if v_count <> 0 then
    raise exception 'reposição deveria resolver tudo, sobraram % ativas', v_count;
  end if;

  select resolvida_em into v_resolvida_em from public.notificacoes where id = v_id_esgotado;
  if v_resolvida_em is null then
    raise exception 'notificação resolvida precisa carimbar resolvida_em';
  end if;

  ------------------------------------------------------------------
  -- 20. reincidência gera ocorrência NOVA, não reabre a antiga
  ------------------------------------------------------------------
  update public.produtos set estoque_quantidade = 2 where id = v_produto;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa' and tipo = 'estoque_baixo';
  if v_count <> 1 then
    raise exception 'reincidência deveria abrir 1 notificação, abriu %', v_count;
  end if;

  select id into v_id_baixo_2
    from public.notificacoes
   where entidade_id = v_produto and estado = 'ativa' and tipo = 'estoque_baixo';
  if v_id_baixo_2 = v_id_baixo then
    raise exception 'reincidência precisa ser uma linha nova, não a antiga reaberta';
  end if;

  ------------------------------------------------------------------
  -- 21. pedido novo abre; avançar o status resolve
  ------------------------------------------------------------------
  insert into public.pedidos (numero_pedido, nome_cliente, tipo_entrega, subtotal, total, status)
  values (2147482000, '__teste_notificacoes__', 'retirada', 10, 10, 'pendente')
  returning id into v_pedido;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_pedido and estado = 'ativa' and tipo = 'pedido_novo';
  if v_count <> 1 then
    raise exception 'pedido pendente deveria abrir 1 notificação, abriu %', v_count;
  end if;

  select prioridade into v_prioridade
    from public.notificacoes
   where entidade_id = v_pedido and estado = 'ativa';
  if v_prioridade <> 'normal' then
    raise exception 'pedido recém-criado deveria ser normal, veio %', v_prioridade;
  end if;

  update public.pedidos set status = 'confirmado' where id = v_pedido;

  select count(*) into v_count
    from public.notificacoes
   where entidade_id = v_pedido and estado = 'ativa';
  if v_count <> 0 then
    raise exception 'pedido atendido deveria resolver a notificação, sobraram %', v_count;
  end if;

  ------------------------------------------------------------------
  -- 22. reconciliação é idempotente
  ------------------------------------------------------------------
  perform public.reconciliar_notificacoes();
  select count(*) into v_count from public.notificacoes where estado = 'ativa';
  perform public.reconciliar_notificacoes();
  perform public.reconciliar_notificacoes();
  select count(*) into v_real_total from public.notificacoes where estado = 'ativa';
  if v_count <> v_real_total then
    raise exception 'reconciliação não é idempotente: % depois %', v_count, v_real_total;
  end if;

  ------------------------------------------------------------------
  -- 23. o resumo do badge bate com a contagem real
  ------------------------------------------------------------------
  select total into v_resumo_total from public.resumo_notificacoes('__teste_usuario_a__');
  select count(*) into v_real_total from public.notificacoes where estado = 'ativa';
  if v_resumo_total <> v_real_total then
    raise exception 'resumo (%) diverge da contagem real (%)', v_resumo_total, v_real_total;
  end if;

  ------------------------------------------------------------------
  -- 24. leitura e silenciamento são por usuário e não vazam
  ------------------------------------------------------------------
  insert into public.notificacoes_leitura (notificacao_id, usuario_chave, lida_em, silenciada_em)
  values (v_id_baixo_2, '__teste_usuario_a__', now(), now());

  select count(*) into v_count
    from public.listar_notificacoes('__teste_usuario_a__', 200)
   where id = v_id_baixo_2 and lida_em is not null and silenciada_em is not null;
  if v_count <> 1 then
    raise exception 'usuário A deveria ver a própria marcação de leitura';
  end if;

  select count(*) into v_count
    from public.listar_notificacoes('__teste_usuario_b__', 200)
   where id = v_id_baixo_2 and (lida_em is not null or silenciada_em is not null);
  if v_count <> 0 then
    raise exception 'a leitura do usuário A não pode vazar para o usuário B';
  end if;

  select nao_lidas into v_resumo_total from public.resumo_notificacoes('__teste_usuario_b__');
  select count(*) into v_real_total from public.notificacoes where estado = 'ativa';
  if v_resumo_total <> v_real_total then
    raise exception 'usuário B não marcou nada, deveria ter % não lidas, tem %', v_real_total, v_resumo_total;
  end if;
end;
$$;

rollback;
