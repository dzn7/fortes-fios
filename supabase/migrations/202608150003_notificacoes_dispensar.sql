-- Correção: "Dispensar" gravava e nada acontecia.
--
-- `notificacoes_leitura.silenciada_em` era escrito pela rota POST, mas nenhuma
-- das duas funções de leitura olhava para a coluna: o item dispensado voltava
-- em `listar_notificacoes` e continuava contando em `resumo_notificacoes`.
--
-- Semântica que passa a valer:
--   - dispensada  = ocorrência silenciada por ESTE usuário. Sai da lista ativa
--                   e sai dos contadores; a linha continua `ativa` no banco,
--                   porque a condição continua verdadeira.
--   - reincidência = linha NOVA (o índice único parcial garante isso), com
--                   `notificacoes_leitura` vazio, então volta a aparecer.
--
-- `p_incluir_resolvidas` passa a significar "incluir histórico": resolvidas E
-- dispensadas. O nome do parâmetro é mantido para não quebrar a assinatura.

set search_path = pg_catalog, public, extensions;

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
  where n.estado = 'ativa'
    and l.silenciada_em is null;
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
  where (n.estado = 'ativa' and l.silenciada_em is null)
     or p_incluir_resolvidas
  order by
    (n.estado = 'ativa' and l.silenciada_em is null) desc,
    (n.prioridade = 'urgente') desc,
    n.criada_em desc
  limit greatest(1, least(coalesce(p_limite, 20), 200));
$$;

revoke all on function public.resumo_notificacoes(text) from anon, authenticated;
revoke all on function public.listar_notificacoes(text, integer, boolean) from anon, authenticated;
