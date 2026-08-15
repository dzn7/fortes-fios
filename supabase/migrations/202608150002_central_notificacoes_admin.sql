-- Central de Notificações do Admin.
-- Spec: specs/central-notificacoes-admin.md
--
-- Uma notificação representa uma CONDIÇÃO que precisa de atenção, não um evento
-- de log. A garantia de "uma condição contínua = um alerta ativo" é estrutural:
-- um índice único parcial sobre `chave_dedupe where estado = 'ativa'`. Quando a
-- condição é resolvida e reincide, nasce uma linha nova — ocorrência nova.
--
-- As funções de sincronização são SECURITY DEFINER com search_path vazio, no
-- mesmo padrão de `sincronizar_estoque_item_pedido`: o site público escreve em
-- `produtos`/`pedidos` como `anon`, e o trigger não pode falhar por permissão.
-- Isso permite manter as tabelas novas FORA do alcance de anon/authenticated,
-- sem ampliar a exposição já documentada no AGENTS.md §3.9.

set search_path = pg_catalog, public, extensions;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  prioridade text not null,
  titulo text not null,
  mensagem text not null,
  entidade_tipo text,
  entidade_id uuid,
  dados jsonb not null default '{}'::jsonb,
  estado text not null default 'ativa',
  chave_dedupe text not null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  constraint notificacoes_tipo_check
    check (tipo in ('estoque_esgotado', 'estoque_baixo', 'pedido_novo')),
  constraint notificacoes_prioridade_check
    check (prioridade in ('urgente', 'normal')),
  constraint notificacoes_estado_check
    check (estado in ('ativa', 'resolvida')),
  constraint notificacoes_resolucao_check
    check ((estado = 'resolvida') = (resolvida_em is not null))
);

comment on table public.notificacoes is
  'Alertas internos do Admin. Uma linha ativa por condição (ver chave_dedupe).';

-- A garantia de não duplicar. Não é disciplina de código: é o banco recusando.
create unique index if not exists notificacoes_dedupe_ativa_uidx
  on public.notificacoes (chave_dedupe) where estado = 'ativa';

-- Índice parcial e coberto: o badge sai de index-only scan, sem tocar o heap.
create index if not exists notificacoes_ativas_prioridade_idx
  on public.notificacoes (prioridade) include (id) where estado = 'ativa';

create index if not exists notificacoes_ativas_recentes_idx
  on public.notificacoes (criada_em desc) where estado = 'ativa';

create index if not exists notificacoes_entidade_ativa_idx
  on public.notificacoes (entidade_tipo, entidade_id) where estado = 'ativa';

create table if not exists public.notificacoes_leitura (
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  usuario_chave text not null,
  visualizada_em timestamptz,
  lida_em timestamptz,
  silenciada_em timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (notificacao_id, usuario_chave)
);

comment on column public.notificacoes_leitura.usuario_chave is
  'id de usuarios_sistema, ou ''admin-local'' quando o login é hardcoded e não tem id.';

create index if not exists notificacoes_leitura_usuario_idx
  on public.notificacoes_leitura (usuario_chave);

create table if not exists public.notificacoes_preferencias (
  usuario_chave text primary key,
  modal_entrada_ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

comment on table public.notificacoes_preferencias is
  'Preferência de "não mostrar novamente" do modal de entrada, por usuário.';

-- ---------------------------------------------------------------------------
-- Descritores: a regra de negócio em um lugar só.
-- Devolvem zero linhas quando não há nada a notificar, o que permite usá-los
-- em CROSS JOIN LATERAL e manter a reconciliação em uma única passada.
-- ---------------------------------------------------------------------------

create or replace function public.descrever_estoque_produto(
  p_quantidade integer,
  p_minimo integer,
  p_nome text
)
returns table (tipo text, prioridade text, titulo text, mensagem text)
language sql
immutable
set search_path = ''
as $$
  select
    case when p_quantidade = 0 then 'estoque_esgotado' else 'estoque_baixo' end,
    'urgente',
    case when p_quantidade = 0 then 'Produto esgotado' else 'Estoque baixo' end,
    case
      when p_quantidade = 0 then coalesce(p_nome, 'Produto') || ' está sem estoque.'
      else coalesce(p_nome, 'Produto') || ' possui apenas ' || p_quantidade
           || case when p_quantidade = 1 then ' unidade.' else ' unidades.' end
    end
  where coalesce(p_quantidade, 0) = 0
     or coalesce(p_quantidade, 0) <= coalesce(p_minimo, 0);
$$;

create or replace function public.descrever_pedido_aguardando(
  p_status text,
  p_numero integer,
  p_cliente text,
  p_criado_em timestamptz
)
returns table (tipo text, prioridade text, titulo text, mensagem text, horas integer)
language sql
stable
set search_path = ''
as $$
  select
    'pedido_novo',
    case when h.horas >= 12 then 'urgente' else 'normal' end,
    case when h.horas >= 12 then 'Pedido parado' else 'Pedido novo' end,
    case
      when h.horas >= 12 then
        'Pedido #' || coalesce(p_numero::text, '—') || ' de '
        || coalesce(nullif(btrim(p_cliente), ''), 'cliente não identificado')
        || ' está há ' || h.horas
        || case when h.horas = 1 then ' hora' else ' horas' end
        || ' sem atendimento.'
      else
        'Pedido #' || coalesce(p_numero::text, '—') || ' de '
        || coalesce(nullif(btrim(p_cliente), ''), 'cliente não identificado')
        || ' aguarda atendimento.'
    end,
    h.horas
  from (
    select greatest(
      0,
      floor(extract(epoch from (now() - coalesce(p_criado_em, now()))) / 3600)::int
    ) as horas
  ) h
  where lower(coalesce(p_status, '')) in ('pendente', 'aguardando_pagamento');
$$;

-- ---------------------------------------------------------------------------
-- Sincronização por entidade (chamada pelos triggers)
-- ---------------------------------------------------------------------------

create or replace function public.sincronizar_notificacoes_estoque(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Resolve toda notificação de estoque deste produto que não corresponde mais
  -- à situação atual (repôs, mudou de faixa, ou o produto sumiu).
  update public.notificacoes n
     set estado = 'resolvida',
         resolvida_em = now(),
         atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'produto'
     and n.entidade_id = p_produto_id
     and not exists (
       select 1
         from public.produtos p
         cross join lateral public.descrever_estoque_produto(
           p.estoque_quantidade, p.estoque_minimo, p.nome
         ) d
        where p.id = p_produto_id
          and d.tipo = n.tipo
     );

  -- Abre a que falta. Se já existe ativa, apenas atualiza o retrato.
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
  where p.id = p_produto_id
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    prioridade = excluded.prioridade,
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.mensagem is distinct from excluded.mensagem
     or alvo.dados is distinct from excluded.dados
     or alvo.prioridade is distinct from excluded.prioridade;
end;
$$;

create or replace function public.sincronizar_notificacoes_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notificacoes n
     set estado = 'resolvida',
         resolvida_em = now(),
         atualizada_em = now()
   where n.estado = 'ativa'
     and n.entidade_tipo = 'pedido'
     and n.entidade_id = p_pedido_id
     and not exists (
       select 1
         from public.pedidos p
        where p.id = p_pedido_id
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
  where p.id = p_pedido_id
  on conflict (chave_dedupe) where estado = 'ativa'
  do update set
    prioridade = excluded.prioridade,
    titulo = excluded.titulo,
    mensagem = excluded.mensagem,
    dados = excluded.dados,
    atualizada_em = now()
  where alvo.prioridade is distinct from excluded.prioridade
     or alvo.mensagem is distinct from excluded.mensagem;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliação: uma passada conjunta, sem laço linha a linha.
-- Corrige estado pré-existente e escala pedido parado. É idempotente.
-- ---------------------------------------------------------------------------

create or replace function public.reconciliar_notificacoes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura: contadores do badge e lista do painel
-- ---------------------------------------------------------------------------

create or replace function public.resumo_notificacoes(p_usuario_chave text)
returns table (urgentes integer, normais integer, nao_lidas integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where n.prioridade = 'urgente')::int,
    count(*) filter (where n.prioridade = 'normal')::int,
    count(*) filter (where l.lida_em is null)::int,
    count(*)::int
  from public.notificacoes n
  left join public.notificacoes_leitura l
    on l.notificacao_id = n.id
   and l.usuario_chave = p_usuario_chave
  where n.estado = 'ativa';
$$;

create or replace function public.listar_notificacoes(
  p_usuario_chave text,
  p_limite integer default 20,
  p_incluir_resolvidas boolean default false
)
returns table (
  id uuid,
  tipo text,
  prioridade text,
  titulo text,
  mensagem text,
  entidade_tipo text,
  entidade_id uuid,
  dados jsonb,
  estado text,
  criada_em timestamptz,
  resolvida_em timestamptz,
  visualizada_em timestamptz,
  lida_em timestamptz,
  silenciada_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id, n.tipo, n.prioridade, n.titulo, n.mensagem,
    n.entidade_tipo, n.entidade_id, n.dados, n.estado,
    n.criada_em, n.resolvida_em,
    l.visualizada_em, l.lida_em, l.silenciada_em
  from public.notificacoes n
  left join public.notificacoes_leitura l
    on l.notificacao_id = n.id
   and l.usuario_chave = p_usuario_chave
  where n.estado = 'ativa' or p_incluir_resolvidas
  order by
    (n.estado = 'ativa') desc,
    (n.prioridade = 'urgente') desc,
    n.criada_em desc
  limit greatest(1, least(coalesce(p_limite, 20), 200));
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.trigger_notificacoes_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.notificacoes
       set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
     where estado = 'ativa' and entidade_tipo = 'produto' and entidade_id = old.id;
    return null;
  end if;

  perform public.sincronizar_notificacoes_estoque(new.id);
  return null;
end;
$$;

create or replace function public.trigger_notificacoes_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.notificacoes
       set estado = 'resolvida', resolvida_em = now(), atualizada_em = now()
     where estado = 'ativa' and entidade_tipo = 'pedido' and entidade_id = old.id;
    return null;
  end if;

  perform public.sincronizar_notificacoes_pedido(new.id);
  return null;
end;
$$;

drop trigger if exists trg_notificacoes_produto on public.produtos;
create trigger trg_notificacoes_produto
after insert or delete or update of estoque_quantidade, estoque_minimo, nome
on public.produtos
for each row
execute function public.trigger_notificacoes_produto();

drop trigger if exists trg_notificacoes_pedido on public.pedidos;
create trigger trg_notificacoes_pedido
after insert or delete or update of status
on public.pedidos
for each row
execute function public.trigger_notificacoes_pedido();

-- ---------------------------------------------------------------------------
-- Permissões: as tabelas novas NÃO ficam ao alcance de anon/authenticated.
-- O acesso é feito por route handler com service_role; os triggers funcionam
-- porque as funções são SECURITY DEFINER.
-- ---------------------------------------------------------------------------

revoke all on public.notificacoes from anon, authenticated;
revoke all on public.notificacoes_leitura from anon, authenticated;
revoke all on public.notificacoes_preferencias from anon, authenticated;

revoke all on function public.reconciliar_notificacoes() from anon, authenticated;
revoke all on function public.resumo_notificacoes(text) from anon, authenticated;
revoke all on function public.listar_notificacoes(text, integer, boolean) from anon, authenticated;
revoke all on function public.sincronizar_notificacoes_estoque(uuid) from anon, authenticated;
revoke all on function public.sincronizar_notificacoes_pedido(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill idempotente do estado já existente
-- ---------------------------------------------------------------------------

select public.reconciliar_notificacoes();
