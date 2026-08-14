-- Produtividade dos garçons — pontuação calculada sob demanda.
--
-- Decisões (ver Progress.md):
-- * Nenhum trigger novo em `pedidos`: a tabela já tem 9 e é o agregado mais acoplado
--   do sistema (caixa, crediário, impressão). A pontuação é derivada por função STABLE,
--   o que também a torna retroativa sobre os pedidos já existentes.
-- * Pedidos em qualquer status entram na base (inclusive pendentes/em aberto).
--   Cancelado é neutro por padrão: não pontua criação e só penaliza se a config mandar.
-- * Penalidades são gravadas como valor POSITIVO na config e subtraídas no cálculo.
-- * A TABELA de config continua fechada para anon/authenticated. O acesso acontece
--   apenas pelas funções `security definer` deste arquivo, que validam o que entra.
--   Motivo: `SUPABASE_SERVICE_ROLE_KEY` não existe no ambiente, então
--   `obterSupabaseAdmin()` cai no fallback da anon key e um REVOKE puro deixaria a
--   tela sem dados. Com `security definer`, o anon consegue ler os agregados
--   (que ele já poderia calcular lendo `pedidos`) sem poder tocar na tabela.
--   Quando a service role for configurada, dá para revogar os grants abaixo.

-- ---------------------------------------------------------------------------
-- 1. Configuração de pesos e metas
-- ---------------------------------------------------------------------------

create table if not exists public.produtividade_config (
  chave text primary key,
  valor numeric not null,
  atualizado_em timestamptz not null default now()
);

comment on table public.produtividade_config is
  'Pesos de pontuação e metas do módulo de produtividade dos garçons. Penalidades são positivas e subtraídas no cálculo.';

revoke all on table public.produtividade_config from anon, authenticated;
grant select, insert, update, delete on table public.produtividade_config to service_role;

insert into public.produtividade_config (chave, valor) values
  ('pontos_pedido_criado', 10),
  ('pontos_pedido_fechado', 15),
  ('pontos_item_adicionado', 2),
  ('pontos_pedido_editado', 3),
  ('bonus_cadastro_completo', 5),
  ('penalidade_nome_generico', 8),
  ('penalidade_contato_ausente', 5),
  ('penalidade_pedido_cancelado', 0),
  ('meta_pontos_dia', 150),
  ('meta_pontos_semana', 900),
  ('meta_pontos_mes', 3600)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Detecção de nome de cliente genérico
-- ---------------------------------------------------------------------------

create or replace function public.fn_produtividade_nome_generico(p_nome text)
returns boolean
language sql
immutable
parallel safe
as $$
  -- Expressão ÚNICA, sem CTE e sem `SET search_path` — as duas coisas impedem o
  -- planner de fazer inline da função. Medido em 3.000 pedidos: 88 ms com a
  -- cláusula SET contra 10 ms inline. A proteção contra search_path hijack é
  -- mantida qualificando cada função e o operador em pg_catalog.
  -- O `.{0,2}` cobre nome vazio ou de até duas letras; o resto do alternador
  -- cobre "só dígitos", "mesa 7", "casal da esquina…" e os rótulos soltos.
  select pg_catalog.lower(
    pg_catalog.translate(
      coalesce(pg_catalog.btrim(p_nome), ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )
  ) OPERATOR(pg_catalog.~) ('^([[:space:]]*.{0,2}'
    || '|[0-9]+'
    || '|(mesa|comanda|balcao|local|pdv|caixa|cliente|consumidor)[[:space:]]*[0-9]*'
    || '|(casal|mesa|comanda|balcao|cliente|consumidor|turista|visitante|pessoa)[[:space:]].*'
    || '|clientes|consumidor pdv|consumidor final|turistas?|visitantes?|sem nome'
    || '|nao inform(ado|ou)|teste|avulso|fregues|moc[ao]|rapaz|senhor(a)?|menin[ao]|nome|x+'
    || ')$')
$$;

comment on function public.fn_produtividade_nome_generico(text) is
  'true quando o nome do cliente não identifica ninguém (vazio, "cliente", "mesa 7", só dígitos, 2 letras…).';

-- Revogar de PUBLIC, não de anon: o EXECUTE default de função vem do pseudo-role
-- PUBLIC, então `revoke from anon` não tiraria nada. As funções `security definer`
-- abaixo continuam chamando esta aqui, porque rodam como o dono.
revoke all on function public.fn_produtividade_nome_generico(text) from public;

-- ---------------------------------------------------------------------------
-- 3. Pesos vigentes com defaults aplicados
-- ---------------------------------------------------------------------------

create or replace function public.fn_produtividade_pesos()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'pontos_pedido_criado', 10,
    'pontos_pedido_fechado', 15,
    'pontos_item_adicionado', 2,
    'pontos_pedido_editado', 3,
    'bonus_cadastro_completo', 5,
    'penalidade_nome_generico', 8,
    'penalidade_contato_ausente', 5,
    'penalidade_pedido_cancelado', 0,
    'meta_pontos_dia', 150,
    'meta_pontos_semana', 900,
    'meta_pontos_mes', 3600
  ) || coalesce((select jsonb_object_agg(chave, valor) from produtividade_config), '{}'::jsonb)
$$;

comment on function public.fn_produtividade_pesos() is
  'Pesos e metas do módulo de produtividade, com os defaults do código aplicados sobre a tabela de config.';

revoke all on function public.fn_produtividade_pesos() from public;

-- ---------------------------------------------------------------------------
-- 4. Classificação de um pedido de garçom (fonte única das regras)
-- ---------------------------------------------------------------------------

create or replace function public.fn_produtividade_pedidos_classificados(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_garcom_id uuid default null
)
returns table (
  pedido_id uuid,
  numero_pedido integer,
  garcom_id uuid,
  nome_cliente text,
  tipo_entrega text,
  status text,
  total numeric,
  criado_em timestamptz,
  cancelado boolean,
  fechado boolean,
  nome_generico boolean,
  contato_ausente boolean,
  cadastro_completo boolean
)
language sql
stable
parallel safe
set search_path = public
as $$
  select
    ped.id,
    ped.numero_pedido,
    ped.garcom_id,
    ped.nome_cliente::text,
    lower(coalesce(ped.tipo_entrega, ''))::text as tipo_entrega,
    lower(coalesce(ped.status, ''))::text as status,
    coalesce(ped.total, 0) as total,
    ped.created_at,
    lower(coalesce(ped.status, '')) = 'cancelado' as cancelado,
    lower(coalesce(ped.status, '')) = 'entregue' as fechado,
    aval.nome_generico,
    (
      aval.entrega_ou_retirada
      and (
        aval.digitos_telefone < 8
        or (
          lower(coalesce(ped.tipo_entrega, '')) = 'entrega'
          and nullif(trim(coalesce(ped.endereco, ped.endereco_entrega, '')), '') is null
        )
      )
    ) as contato_ausente,
    (not aval.nome_generico and aval.digitos_telefone >= 8) as cadastro_completo
  from pedidos ped
  -- LATERAL para avaliar nome e telefone uma única vez por linha (custam regex).
  cross join lateral (
    select
      fn_produtividade_nome_generico(ped.nome_cliente) as nome_generico,
      length(regexp_replace(coalesce(ped.telefone, '')::text, '\D', '', 'g')) as digitos_telefone,
      lower(coalesce(ped.tipo_entrega, '')) in ('retirada', 'entrega') as entrega_ou_retirada
  ) as aval
  where ped.garcom_id is not null
    and ped.created_at >= p_inicio
    and ped.created_at < p_fim
    and (p_garcom_id is null or ped.garcom_id = p_garcom_id)
$$;

comment on function public.fn_produtividade_pedidos_classificados(timestamptz, timestamptz, uuid) is
  'Pedidos de garçom no período com as regras de boa prática já avaliadas. Fonte única usada pelas demais funções.';

revoke all on function public.fn_produtividade_pedidos_classificados(timestamptz, timestamptz, uuid) from public;

-- ---------------------------------------------------------------------------
-- 5. Métricas e pontuação por garçom
-- ---------------------------------------------------------------------------

create or replace function public.produtividade_garcons(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  garcom_id uuid,
  nome text,
  nome_usuario text,
  avatar_url text,
  cor_avatar text,
  ativo boolean,
  ultimo_acesso timestamptz,
  pedidos_criados integer,
  pedidos_fechados integer,
  pedidos_cancelados integer,
  pedidos_abertos integer,
  itens_adicionados integer,
  edicoes integer,
  vendas numeric,
  ticket_medio numeric,
  ocorrencias_nome integer,
  ocorrencias_contato integer,
  cadastros_completos integer,
  pontos_positivos numeric,
  pontos_negativos numeric,
  pontos numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select * from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null)
  ),
  por_pedido as (
    select
      c.garcom_id,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as pedidos_cancelados,
      count(*) filter (where not c.fechado and not c.cancelado)::integer as pedidos_abertos,
      coalesce(sum(c.total) filter (where not c.cancelado), 0) as vendas,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.garcom_id
  ),
  por_atividade as (
    select
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      -- Distinto por (dia operacional, pedido) — a mesma regra da série diária.
      -- Contar distinct só por pedido faria o total divergir da soma da série
      -- quando um pedido é editado em dois dias (mesa que atravessa as 03h).
      -- `pedido_id is not null` é obrigatório: em `count(distinct (dia, pedido_id))`
      -- o par não é nulo quando só o pedido é, e o evento órfão entraria na conta.
      count(distinct (
        ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date,
        a.pedido_id
      )) filter (
        where a.tipo_acao = 'pedido_modificado' and a.pedido_id is not null
      )::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by a.garcom_id
  ),
  consolidado as (
    select
      u.id as garcom_id,
      u.nome::text,
      u.nome_usuario::text,
      u.avatar_url,
      coalesce(u.cor_avatar, '#0296F9')::text as cor_avatar,
      coalesce(u.ativo, true) as ativo,
      u.ultimo_acesso,
      coalesce(pp.pedidos_criados, 0) as pedidos_criados,
      coalesce(pp.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(pp.pedidos_cancelados, 0) as pedidos_cancelados,
      coalesce(pp.pedidos_abertos, 0) as pedidos_abertos,
      coalesce(pa.itens_adicionados, 0) as itens_adicionados,
      coalesce(pa.edicoes, 0) as edicoes,
      coalesce(pp.vendas, 0) as vendas,
      coalesce(pp.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(pp.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(pp.cadastros_completos, 0) as cadastros_completos
    from usuarios_sistema u
    left join por_pedido pp on pp.garcom_id = u.id
    left join por_atividade pa on pa.garcom_id = u.id
    where u.papel = 'garcom'
  )
  select
    c.garcom_id,
    c.nome,
    c.nome_usuario,
    c.avatar_url,
    c.cor_avatar,
    c.ativo,
    c.ultimo_acesso,
    c.pedidos_criados,
    c.pedidos_fechados,
    c.pedidos_cancelados,
    c.pedidos_abertos,
    c.itens_adicionados,
    c.edicoes,
    c.vendas,
    case
      when c.pedidos_criados - c.pedidos_cancelados > 0
        then round(c.vendas / (c.pedidos_criados - c.pedidos_cancelados), 2)
      else 0
    end as ticket_medio,
    c.ocorrencias_nome,
    c.ocorrencias_contato,
    c.cadastros_completos,
    positivos.valor as pontos_positivos,
    negativos.valor as pontos_negativos,
    positivos.valor - negativos.valor as pontos
  from consolidado c
  cross join pesos
  cross join lateral (
    select round(
      (c.pedidos_criados - c.pedidos_cancelados) * (pesos.p ->> 'pontos_pedido_criado')::numeric
      + c.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + c.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + c.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + c.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
    , 2) as valor
  ) as positivos
  cross join lateral (
    select round(
      c.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      + c.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      + c.pedidos_cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as valor
  ) as negativos
$$;

comment on function public.produtividade_garcons(timestamptz, timestamptz) is
  'Métricas e pontuação de cada garçom no período. Pedidos de qualquer status entram; cancelado não pontua criação.';

revoke all on function public.produtividade_garcons(timestamptz, timestamptz) from public;
grant execute on function public.produtividade_garcons(timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Série por dia operacional (03:00 America/Sao_Paulo)
-- ---------------------------------------------------------------------------

create or replace function public.produtividade_serie_diaria(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table (
  dia date,
  garcom_id uuid,
  pontos numeric,
  pedidos_criados integer,
  pedidos_fechados integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  classificados as (
    select
      ((c.criado_em at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      c.*
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, null) c
  ),
  por_dia as (
    select
      c.dia,
      c.garcom_id,
      count(*) filter (where not c.cancelado)::integer as criados_validos,
      count(*)::integer as pedidos_criados,
      count(*) filter (where c.fechado)::integer as pedidos_fechados,
      count(*) filter (where c.cancelado)::integer as cancelados,
      count(*) filter (where c.nome_generico and not c.cancelado)::integer as ocorrencias_nome,
      count(*) filter (where c.contato_ausente and not c.cancelado)::integer as ocorrencias_contato,
      count(*) filter (where c.cadastro_completo and not c.cancelado)::integer as cadastros_completos
    from classificados c
    group by c.dia, c.garcom_id
  ),
  atividade_por_dia as (
    select
      ((a.created_at at time zone 'America/Sao_Paulo') - interval '3 hours')::date as dia,
      a.garcom_id,
      count(*) filter (where a.tipo_acao = 'item_adicionado')::integer as itens_adicionados,
      count(distinct a.pedido_id) filter (where a.tipo_acao = 'pedido_modificado')::integer as edicoes
    from atividade_garcom a
    where a.created_at >= p_inicio
      and a.created_at < p_fim
    group by 1, 2
  ),
  combinado as (
    select
      coalesce(d.dia, ad.dia) as dia,
      coalesce(d.garcom_id, ad.garcom_id) as garcom_id,
      coalesce(d.criados_validos, 0) as criados_validos,
      coalesce(d.pedidos_criados, 0) as pedidos_criados,
      coalesce(d.pedidos_fechados, 0) as pedidos_fechados,
      coalesce(d.cancelados, 0) as cancelados,
      coalesce(d.ocorrencias_nome, 0) as ocorrencias_nome,
      coalesce(d.ocorrencias_contato, 0) as ocorrencias_contato,
      coalesce(d.cadastros_completos, 0) as cadastros_completos,
      coalesce(ad.itens_adicionados, 0) as itens_adicionados,
      coalesce(ad.edicoes, 0) as edicoes
    from por_dia d
    full outer join atividade_por_dia ad
      on ad.dia = d.dia and ad.garcom_id = d.garcom_id
  )
  select
    k.dia,
    k.garcom_id,
    round(
      k.criados_validos * (pesos.p ->> 'pontos_pedido_criado')::numeric

      + k.pedidos_fechados * (pesos.p ->> 'pontos_pedido_fechado')::numeric
      + k.itens_adicionados * (pesos.p ->> 'pontos_item_adicionado')::numeric
      + k.edicoes * (pesos.p ->> 'pontos_pedido_editado')::numeric
      + k.cadastros_completos * (pesos.p ->> 'bonus_cadastro_completo')::numeric
      - k.ocorrencias_nome * (pesos.p ->> 'penalidade_nome_generico')::numeric
      - k.ocorrencias_contato * (pesos.p ->> 'penalidade_contato_ausente')::numeric
      - k.cancelados * (pesos.p ->> 'penalidade_pedido_cancelado')::numeric
    , 2) as pontos,
    k.pedidos_criados,
    k.pedidos_fechados
  from combinado k
  cross join pesos
  -- Mesmo recorte do ranking: só quem é garçom hoje, senão a série mostra um
  -- traço sem nome para usuários que mudaram de papel.
  join usuarios_sistema u on u.id = k.garcom_id and u.papel = 'garcom'
  order by k.dia, k.garcom_id
$$;

comment on function public.produtividade_serie_diaria(timestamptz, timestamptz) is
  'Pontos e pedidos por dia operacional (corte 03:00 America/Sao_Paulo) e por garçom.';

revoke all on function public.produtividade_serie_diaria(timestamptz, timestamptz) from public;
grant execute on function public.produtividade_serie_diaria(timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Ocorrências: os pedidos que custaram pontos
-- ---------------------------------------------------------------------------

create or replace function public.produtividade_ocorrencias(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_garcom_id uuid default null,
  p_limite integer default 20,
  p_offset integer default 0
)
returns table (
  pedido_id uuid,
  numero_pedido integer,
  garcom_id uuid,
  garcom_nome text,
  nome_cliente text,
  tipo_entrega text,
  status text,
  total numeric,
  criado_em timestamptz,
  motivos text[],
  pontos_perdidos numeric,
  total_registros bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pesos as (
    select fn_produtividade_pesos() as p
  ),
  problemas as (
    select
      c.*,
      array_remove(array[
        case when c.nome_generico then 'nome_generico' end,
        case when c.contato_ausente then 'contato_ausente' end
      ], null) as motivos
    from fn_produtividade_pedidos_classificados(p_inicio, p_fim, p_garcom_id) c
    where not c.cancelado
      and (c.nome_generico or c.contato_ausente)
      -- Mesmo recorte do ranking e da série: filtrar aqui (e não no join final)
      -- para o count(*) over () não contar quem está fora da lista.
      and exists (
        select 1 from usuarios_sistema u
        where u.id = c.garcom_id and u.papel = 'garcom'
      )
  ),
  contado as (
    select pr.*, count(*) over () as total_registros
    from problemas pr
  )
  select
    ct.pedido_id,
    ct.numero_pedido,
    ct.garcom_id,
    u.nome::text as garcom_nome,
    ct.nome_cliente,
    ct.tipo_entrega,
    ct.status,
    ct.total,
    ct.criado_em,
    ct.motivos,
    round(
      case when ct.nome_generico then (pesos.p ->> 'penalidade_nome_generico')::numeric else 0 end
      + case when ct.contato_ausente then (pesos.p ->> 'penalidade_contato_ausente')::numeric else 0 end
    , 2) as pontos_perdidos,
    ct.total_registros
  from contado ct
  cross join pesos
  left join usuarios_sistema u on u.id = ct.garcom_id
  order by ct.criado_em desc
  limit greatest(coalesce(p_limite, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

comment on function public.produtividade_ocorrencias(timestamptz, timestamptz, uuid, integer, integer) is
  'Pedidos que perderam pontos no período, com os motivos e o total descontado. Paginada; total_registros repete a contagem completa.';

revoke all on function public.produtividade_ocorrencias(timestamptz, timestamptz, uuid, integer, integer) from public;
grant execute on function public.produtividade_ocorrencias(timestamptz, timestamptz, uuid, integer, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7.1 Leitura e escrita da configuração (única porta de entrada da tabela)
-- ---------------------------------------------------------------------------

create or replace function public.produtividade_ler_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fn_produtividade_pesos()
$$;

comment on function public.produtividade_ler_config() is
  'Pesos e metas vigentes. A tabela produtividade_config não é acessível diretamente pelo anon.';

revoke all on function public.produtividade_ler_config() from public;
grant execute on function public.produtividade_ler_config() to anon, authenticated, service_role;

create or replace function public.produtividade_salvar_config(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text;
  v_valor numeric;
  v_chaves_validas text[] := array[
    'pontos_pedido_criado', 'pontos_pedido_fechado', 'pontos_item_adicionado',
    'pontos_pedido_editado', 'bonus_cadastro_completo', 'penalidade_nome_generico',
    'penalidade_contato_ausente', 'penalidade_pedido_cancelado',
    'meta_pontos_dia', 'meta_pontos_semana', 'meta_pontos_mes'
  ];
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida';
  end if;

  for v_chave in select jsonb_object_keys(p_config) loop
    if not (v_chave = any (v_chaves_validas)) then
      raise exception 'Chave desconhecida: %', v_chave;
    end if;

    begin
      v_valor := (p_config ->> v_chave)::numeric;
    exception when others then
      raise exception 'Valor inválido para %', v_chave;
    end;

    if v_valor is null or v_valor < 0 or v_valor > 100000 then
      raise exception 'Valor fora do intervalo permitido para %', v_chave;
    end if;

    insert into produtividade_config (chave, valor, atualizado_em)
    values (v_chave, v_valor, now())
    on conflict (chave) do update
      set valor = excluded.valor,
          atualizado_em = excluded.atualizado_em;
  end loop;

  return fn_produtividade_pesos();
end;
$$;

comment on function public.produtividade_salvar_config(jsonb) is
  'Grava apenas as chaves conhecidas, com valor entre 0 e 100000. Retorna a configuração completa.';

revoke all on function public.produtividade_salvar_config(jsonb) from public;
grant execute on function public.produtividade_salvar_config(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Índices: nenhum criado — medido, não é o gargalo
-- ---------------------------------------------------------------------------
--
-- EXPLAIN (ANALYZE, BUFFERS) em 2026-07-25, janela de 90 dias:
--   * recorte de `pedidos` (garcom_id not null + período): 2,4 ms via
--     idx_pedidos_created_at já existente — 2.997 linhas, 1.112 buffers.
--   * agregação de `atividade_garcom`: 3,4 ms em seq scan (a tabela tem 824 kB).
--   * o custo real estava na avaliação das regras por linha (regex), resolvido
--     acima chamando cada regra uma única vez por pedido via LATERAL.
--
-- Um índice composto (garcom_id, created_at) economizaria ~2 ms e adicionaria
-- manutenção de escrita em `pedidos`, que é a tabela mais quente do sistema.
-- Refazer esta medição se o volume de pedidos crescer uma ordem de grandeza.
