-- Notificação de cliente sem comprar há dias.
-- Spec: specs/central-notificacoes-admin.md
--
-- Diferente de estoque e pedido, esta condição **não tem evento**: ninguém
-- escreve na tabela quando o cliente deixa de comprar. Por isso não há trigger —
-- ela entra em `reconciliar_notificacoes()`, que já roda a cada carregamento do
-- painel e já é o lugar onde a passagem do tempo é reavaliada (é lá que pedido
-- parado escala para urgente).
--
-- Prioridade `normal` e sem escalonamento: não é problema a resolver, é
-- oportunidade a aproveitar. Vermelho aqui competiria com estoque esgotado.

set search_path = pg_catalog, public, extensions;

alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes
  add constraint notificacoes_tipo_check
  check (tipo in ('estoque_esgotado', 'estoque_baixo', 'pedido_novo', 'cliente_inativo'));

/*
 * Sete dias: a loja ainda está fresca na memória do cliente e um "sentimos sua
 * falta" soa atencioso. Quem nunca comprou fica de fora — reativar pressupõe
 * uma compra anterior.
 */
create or replace function public.descrever_cliente_inativo(
  p_nome text,
  p_ultimo_pedido_em timestamptz
)
returns table (tipo text, prioridade text, titulo text, mensagem text, dias integer)
language sql
stable
set search_path = ''
as $$
  select
    'cliente_inativo',
    'normal',
    'Cliente sem comprar',
    coalesce(nullif(btrim(p_nome), ''), 'Cliente') || ' não compra há ' || d.dias
      || case when d.dias = 1 then ' dia.' else ' dias.' end,
    d.dias
  from (
    select floor(extract(epoch from (now() - p_ultimo_pedido_em)) / 86400)::int as dias
  ) d
  where p_ultimo_pedido_em is not null
    and d.dias >= 7;
$$;

revoke all on function public.descrever_cliente_inativo(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.descrever_cliente_inativo(text, timestamptz) to service_role;

/*
 * Reconciliação com o terceiro tipo.
 *
 * Repare que a resolução do cliente inativo compara pela CHAVE, não só pela
 * entidade: a mensagem muda todo dia (`há 8 dias` → `há 9 dias`), e o
 * `do update` cuida disso sem abrir linha nova. O que resolve o alerta é o
 * cliente voltar a comprar — aí o `not exists` deixa de encontrar descritor.
 */
create or replace function public.reconciliar_notificacoes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  ------------------------------------------------------------------ estoque
  update public.notificacoes n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'produto'
     and not exists (
       select 1
         from public.produtos p
         cross join lateral public.descrever_estoque_produto(
           p.estoque_quantidade, p.estoque_minimo, p.nome
         ) d
        where p.id = n.entidade_id and d.tipo = n.tipo
     );

  insert into public.notificacoes as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'produto', p.id,
    jsonb_build_object('quantidade', p.estoque_quantidade, 'minimo', p.estoque_minimo),
    d.tipo || ':' || p.id::text
  from public.produtos p
  cross join lateral public.descrever_estoque_produto(
    p.estoque_quantidade, p.estoque_minimo, p.nome
  ) d
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;

  ------------------------------------------------------------------ pedidos
  update public.notificacoes n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'pedido'
     and not exists (
       select 1
         from public.pedidos p
        where p.id = n.entidade_id
          and lower(coalesce(p.status, '')) in ('pendente', 'aguardando_pagamento')
     );

  insert into public.notificacoes as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'pedido', p.id,
    jsonb_build_object('numero_pedido', p.numero_pedido, 'horas_parado', d.horas),
    d.tipo || ':' || p.id::text
  from public.pedidos p
  cross join lateral public.descrever_pedido_aguardando(
    p.status, p.numero_pedido, p.nome_cliente, p.created_at
  ) d
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    prioridade = excluded.prioridade,
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.prioridade is distinct from excluded.prioridade
     or alvo.mensagem is distinct from excluded.mensagem;

  ------------------------------------------------------------------ clientes
  update public.notificacoes n
     set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'cliente'
     and not exists (
       select 1
         from public.usuarios_cliente c
         cross join lateral public.descrever_cliente_inativo(c.nome, c.ultimo_pedido_em) d
        where c.id = n.entidade_id
     );

  insert into public.notificacoes as alvo (
    tipo, prioridade, titulo, mensagem, entidade_tipo, entidade_id, dados, chave_dedupe
  )
  select
    d.tipo, d.prioridade, d.titulo, d.mensagem, 'cliente', c.id,
    jsonb_build_object('dias', d.dias, 'telefone', c.telefone),
    d.tipo || ':' || c.id::text
  from public.usuarios_cliente c
  cross join lateral public.descrever_cliente_inativo(c.nome, c.ultimo_pedido_em) d
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados;
end;
$$;

revoke all on function public.reconciliar_notificacoes() from public, anon, authenticated;
grant execute on function public.reconciliar_notificacoes() to service_role;

select public.reconciliar_notificacoes();
