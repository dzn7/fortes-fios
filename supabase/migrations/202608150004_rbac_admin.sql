-- RBAC do Admin — fundação: identidade verificável + modelo de permissões.
-- Spec: specs/rbac-admin.md
--
-- Três problemas que esta migration fecha:
--
--   1. `senha_hash` era SHA-256 SEM SALT e `anon` tinha SELECT na tabela. Como
--      a anon key vai no bundle público, qualquer visitante baixava todos os
--      hashes e quebrava senha curta em segundos. Passa a bcrypt, e a coluna
--      sai do alcance de anon.
--   2. `anon` tinha UPDATE em `usuarios_sistema` — inclusive na coluna `papel`.
--      Ou seja: qualquer um se promovia a admin por uma requisição REST, e
--      nenhum controle de acesso no frontend sobreviveria a isso. `papel`,
--      `permissoes` e `permissoes_versao` passam a ser escrita de service_role.
--   3. Não havia onde guardar permissão por usuário nem como invalidar sessão
--      quando ela muda.
--
-- A troca de hash é transparente: quem tem hash antigo continua entrando, e o
-- hash é regravado em bcrypt no primeiro login bem-sucedido. Ninguém precisa
-- redefinir senha.

set search_path = pg_catalog, public, extensions;

-- ---------------------------------------------------------------------------
-- Esquema
-- ---------------------------------------------------------------------------

-- 'atendente' entra pelo mesmo /admin; garcom/entregador ficam porque as linhas
-- legadas ainda podem existir, mas não resolvem permissão de Admin nenhuma.
alter table public.usuarios_sistema
  drop constraint if exists usuarios_sistema_papel_check;
alter table public.usuarios_sistema
  add constraint usuarios_sistema_papel_check
  check (papel in ('admin', 'atendente', 'garcom', 'entregador'));

alter table public.usuarios_sistema
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- Incrementa a cada alteração de papel/permissões. A sessão carrega a versão
-- que tinha no login; divergiu, o servidor recusa e o cliente refaz. É o que
-- impede um atendente rebaixado de seguir com o conteúdo sensível em memória.
alter table public.usuarios_sistema
  add column if not exists permissoes_versao integer not null default 1;

comment on column public.usuarios_sistema.permissoes is
  'Overrides sobre o preset do papel. Chaves validadas contra o catálogo em src/lib/rbac.mjs.';

create table if not exists public.acessos_auditoria (
  id uuid primary key default gen_random_uuid(),
  ator_id uuid references public.usuarios_sistema(id) on delete set null,
  alvo_id uuid references public.usuarios_sistema(id) on delete set null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now(),
  constraint acessos_auditoria_acao_check check (acao in (
    'criado', 'papel_alterado', 'permissoes_alteradas',
    'desativado', 'reativado', 'senha_alterada', 'excluido'
  ))
);

comment on table public.acessos_auditoria is
  'Trilha de alterações de acesso. Escrita só por service_role via route handler.';

create index if not exists acessos_auditoria_alvo_idx
  on public.acessos_auditoria (alvo_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Senha: bcrypt com migração transparente
-- ---------------------------------------------------------------------------

/*
 * `true` quando a senha confere, em qualquer um dos dois formatos.
 * bcrypt se identifica pelo prefixo `$2`; o resto é o SHA-256 hex legado.
 */
create or replace function public.senha_confere(p_senha text, p_hash text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_hash is null or p_senha is null then false
    when left(p_hash, 2) = '$2' then p_hash = extensions.crypt(p_senha, p_hash)
    else p_hash = encode(extensions.digest(p_senha, 'sha256'), 'hex')
  end;
$$;

create or replace function public.hash_senha(p_senha text)
returns text
language sql
volatile
set search_path = ''
as $$
  select extensions.crypt(p_senha, extensions.gen_salt('bf'));
$$;

/*
 * Autenticação do Admin. Devolve zero linhas quando a senha não confere ou o
 * usuário está inativo — quem chama não distingue os dois casos, para não
 * virar oráculo de "este usuário existe".
 *
 * Efeito colateral proposital: regrava o hash legado em bcrypt.
 */
create or replace function public.autenticar_usuario_admin(
  p_nome_usuario text,
  p_senha text
)
returns table (
  id uuid,
  nome character varying,
  nome_usuario character varying,
  papel character varying,
  avatar_url text,
  cor_avatar character varying,
  ativo boolean,
  permissoes jsonb,
  permissoes_versao integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios_sistema%rowtype;
begin
  select * into v_usuario
    from public.usuarios_sistema u
   where u.nome_usuario = lower(btrim(p_nome_usuario))
     and u.ativo = true;

  if not found or not public.senha_confere(p_senha, v_usuario.senha_hash) then
    return;
  end if;

  if left(v_usuario.senha_hash, 2) <> '$2' then
    update public.usuarios_sistema
       set senha_hash = public.hash_senha(p_senha)
     where usuarios_sistema.id = v_usuario.id;
  end if;

  update public.usuarios_sistema
     set ultimo_acesso = now()
   where usuarios_sistema.id = v_usuario.id;

  return query
    select v_usuario.id, v_usuario.nome, v_usuario.nome_usuario, v_usuario.papel,
           v_usuario.avatar_url, v_usuario.cor_avatar, v_usuario.ativo,
           v_usuario.permissoes, v_usuario.permissoes_versao;
end;
$$;

/*
 * Revalidação de sessão: o cookie diz quem é e com que versão entrou; isto diz
 * quem a pessoa é AGORA. Uma leitura por chave primária.
 */
create or replace function public.obter_sessao_admin(p_usuario_id uuid)
returns table (
  id uuid,
  nome character varying,
  nome_usuario character varying,
  papel character varying,
  avatar_url text,
  cor_avatar character varying,
  ativo boolean,
  permissoes jsonb,
  permissoes_versao integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.nome, u.nome_usuario, u.papel, u.avatar_url, u.cor_avatar,
         u.ativo, u.permissoes, u.permissoes_versao
    from public.usuarios_sistema u
   where u.id = p_usuario_id;
$$;

-- O login legado (garçom/entregador) continua funcionando, agora com os dois
-- formatos de hash. Assinatura preservada: há call site em src/lib/autenticacao.ts.
create or replace function public.verificar_senha_usuario(
  p_nome_usuario character varying,
  p_senha text
)
returns table (
  id uuid,
  nome character varying,
  nome_usuario character varying,
  papel character varying,
  avatar_url text,
  cor_avatar character varying,
  funcionario_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios_sistema%rowtype;
begin
  select * into v_usuario
    from public.usuarios_sistema u
   where u.nome_usuario = lower(btrim(p_nome_usuario))
     and u.ativo = true;

  if not found or not public.senha_confere(p_senha, v_usuario.senha_hash) then
    return;
  end if;

  if left(v_usuario.senha_hash, 2) <> '$2' then
    update public.usuarios_sistema
       set senha_hash = public.hash_senha(p_senha)
     where usuarios_sistema.id = v_usuario.id;
  end if;

  update public.usuarios_sistema
     set ultimo_acesso = now()
   where usuarios_sistema.id = v_usuario.id;

  return query
    select v_usuario.id, v_usuario.nome, v_usuario.nome_usuario, v_usuario.papel,
           v_usuario.avatar_url, v_usuario.cor_avatar, v_usuario.funcionario_id;
end;
$$;

-- Criação e troca de senha passam a gravar bcrypt. Assinaturas preservadas.
create or replace function public.criar_usuario_sistema(
  p_nome character varying,
  p_nome_usuario character varying,
  p_senha text,
  p_papel character varying,
  p_avatar_url text default null,
  p_cor_avatar character varying default '#f97316',
  p_funcionario_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare novo_id uuid;
begin
  insert into public.usuarios_sistema
    (nome, nome_usuario, senha_hash, papel, avatar_url, cor_avatar, funcionario_id)
  values
    (btrim(p_nome), lower(btrim(p_nome_usuario)), public.hash_senha(p_senha),
     p_papel, p_avatar_url, p_cor_avatar, p_funcionario_id)
  returning id into novo_id;
  return novo_id;
end;
$$;

create or replace function public.atualizar_senha_usuario(
  p_usuario_id uuid,
  p_nova_senha text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.usuarios_sistema
     set senha_hash = public.hash_senha(p_nova_senha),
         updated_at = now()
   where id = p_usuario_id;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões: só service_role escreve, e a versão sobe sozinha
-- ---------------------------------------------------------------------------

/*
 * Aplica papel e/ou permissões e registra auditoria na mesma transação.
 * Duas invariantes que ficam no BANCO, não na UI:
 *   - ninguém altera as próprias permissões;
 *   - a loja não fica sem administrador ativo.
 */
create or replace function public.salvar_acesso_usuario(
  p_ator_id uuid,
  p_alvo_id uuid,
  p_papel character varying default null,
  p_permissoes jsonb default null,
  p_ativo boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.usuarios_sistema%rowtype;
  v_papel character varying;
  v_ativo boolean;
  v_admins_restantes integer;
begin
  if p_ator_id = p_alvo_id then
    raise exception 'Um usuário não altera o próprio acesso.'
      using errcode = 'check_violation';
  end if;

  select * into v_antes from public.usuarios_sistema where id = p_alvo_id;
  if not found then
    return false;
  end if;

  v_papel := coalesce(p_papel, v_antes.papel);
  v_ativo := coalesce(p_ativo, v_antes.ativo);

  -- Rebaixar ou desativar o último admin ativo trancaria todo mundo para fora.
  if v_antes.papel = 'admin' and v_antes.ativo
     and (v_papel <> 'admin' or not v_ativo) then
    select count(*) into v_admins_restantes
      from public.usuarios_sistema
     where papel = 'admin' and ativo = true and id <> p_alvo_id;

    if v_admins_restantes = 0 then
      raise exception 'A loja precisa de pelo menos um administrador ativo.'
        using errcode = 'check_violation';
    end if;
  end if;

  update public.usuarios_sistema
     set papel = v_papel,
         ativo = v_ativo,
         permissoes = coalesce(p_permissoes, v_antes.permissoes),
         permissoes_versao = permissoes_versao + 1,
         updated_at = now()
   where id = p_alvo_id;

  insert into public.acessos_auditoria (ator_id, alvo_id, acao, antes, depois)
  select
    p_ator_id,
    p_alvo_id,
    case
      when v_antes.ativo and not v_ativo then 'desativado'
      when not v_antes.ativo and v_ativo then 'reativado'
      when v_antes.papel is distinct from v_papel then 'papel_alterado'
      else 'permissoes_alteradas'
    end,
    jsonb_build_object('papel', v_antes.papel, 'ativo', v_antes.ativo,
                       'permissoes', v_antes.permissoes),
    jsonb_build_object('papel', v_papel, 'ativo', v_ativo,
                       'permissoes', coalesce(p_permissoes, v_antes.permissoes));

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de tabela
--
-- Grant por COLUNA em vez de revogar a tabela inteira: as telas atuais leem
-- `usuarios_sistema` pelo cliente em 8 arquivos e nenhuma delas pede
-- `senha_hash` (conferido). Assim o buraco fecha hoje, sem quebrar tela — a
-- revogação completa vem junto com a migração dessas consultas para route
-- handler (spec §10, fase 4).
-- ---------------------------------------------------------------------------

revoke all on public.usuarios_sistema from anon, authenticated;

grant select (
  id, nome, nome_usuario, papel, avatar_url, cor_avatar,
  ativo, funcionario_id, ultimo_acesso, created_at, updated_at
) on public.usuarios_sistema to anon, authenticated;

-- Escrita client-side sobrevive só no que não é privilégio. `papel`,
-- `permissoes`, `permissoes_versao` e `senha_hash` ficam fora: são a diferença
-- entre um atendente e um administrador.
grant update (
  nome, avatar_url, cor_avatar, ativo, funcionario_id, ultimo_acesso, updated_at
) on public.usuarios_sistema to anon, authenticated;

grant insert, delete on public.usuarios_sistema to anon, authenticated;

revoke all on public.acessos_auditoria from anon, authenticated;

revoke all on function public.autenticar_usuario_admin(text, text) from anon, authenticated;
revoke all on function public.obter_sessao_admin(uuid) from anon, authenticated;
revoke all on function public.salvar_acesso_usuario(uuid, uuid, character varying, jsonb, boolean) from anon, authenticated;
revoke all on function public.hash_senha(text) from anon, authenticated;
