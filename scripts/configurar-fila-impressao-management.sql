begin;

alter table public.fila_impressao
  add column if not exists automatico boolean not null default true;

comment on column public.fila_impressao.automatico is
  'Distingue eventos automáticos, sujeitos à janela da fila, de impressões manuais.';

update public.fila_impressao
set automatico = false
where origem in (
  'electron_manual',
  'electron_reimpressao',
  'admin_pdv_card',
  'admin_pdv_item',
  'painel_kanban',
  'admin_pedidos_lista',
  'admin_salao_card',
  'admin_garcons_pedidos',
  'admin_conferencia_com_taxa',
  'admin_conferencia_sem_taxa'
)
or origem like 'admin_timeline_%';

insert into public.configuracoes_loja (chave, valor, tipo, descricao, updated_at)
values
  ('fila_impressao_automatica_ativa', 'true', 'boolean', 'Permite criar eventos automáticos na fila de impressão.', now()),
  ('fila_impressao_horario_inicio', '00:00', 'time', 'Início da janela diária de impressão automática em America/Fortaleza.', now()),
  ('fila_impressao_horario_fim', '00:00', 'time', 'Fim da janela diária de impressão automática; igual ao início significa 24 horas.', now()),
  ('impressao_itens_editados_ativa', 'true', 'boolean', 'Imprime automaticamente itens adicionados durante a edição de um pedido.', now())
on conflict (chave) do nothing;

create or replace function public.fila_impressao_automatica_permitida(
  p_escopo text,
  p_instante timestamptz default now()
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_fila_ativa boolean := true;
  v_itens_editados_ativos boolean := true;
  v_inicio_texto text := '00:00';
  v_fim_texto text := '00:00';
  v_inicio time := time '00:00';
  v_fim time := time '00:00';
  v_hora_local time;
begin
  select
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'fila_impressao_automatica_ativa'),
      true
    ),
    coalesce(
      bool_or(lower(trim(valor)) in ('true', '1', 'sim', 'on'))
        filter (where chave = 'impressao_itens_editados_ativa'),
      true
    ),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_inicio'), '00:00'),
    coalesce(max(valor) filter (where chave = 'fila_impressao_horario_fim'), '00:00')
  into v_fila_ativa, v_itens_editados_ativos, v_inicio_texto, v_fim_texto
  from public.configuracoes_loja
  where chave in (
    'fila_impressao_automatica_ativa',
    'impressao_itens_editados_ativa',
    'fila_impressao_horario_inicio',
    'fila_impressao_horario_fim'
  );

  if not v_fila_ativa then
    return false;
  end if;

  if coalesce(p_escopo, 'pedido_completo') = 'itens_novos'
     and not v_itens_editados_ativos then
    return false;
  end if;

  if v_inicio_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_inicio := v_inicio_texto::time;
  end if;

  if v_fim_texto ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_fim := v_fim_texto::time;
  end if;

  if v_inicio = v_fim then
    return true;
  end if;

  v_hora_local := (coalesce(p_instante, now()) at time zone 'America/Fortaleza')::time;

  if v_inicio < v_fim then
    return v_hora_local >= v_inicio and v_hora_local < v_fim;
  end if;

  return v_hora_local >= v_inicio or v_hora_local < v_fim;
end;
$$;

create or replace function public.aplicar_configuracao_automatica_fila_impressao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.origem in ('electron_manual', 'electron_reimpressao') then
    new.automatico := false;
  end if;

  if coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(
       new.escopo,
       coalesce(new.criado_em, new.created_at, now())
     ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aplicar_configuracao_automatica_fila_impressao
  on public.fila_impressao;

create trigger trg_aplicar_configuracao_automatica_fila_impressao
before insert on public.fila_impressao
for each row
execute function public.aplicar_configuracao_automatica_fila_impressao();

create or replace function public.proteger_retorno_fila_impressao_automatica()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'pendente'
     and old.status is distinct from 'pendente'
     and coalesce(new.automatico, true)
     and not public.fila_impressao_automatica_permitida(new.escopo, now()) then
    new.status := 'cancelado';
    new.processado_em := now();
    new.erro_mensagem := 'Cancelado pela configuração da fila automática.';
    new.erro := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_retorno_fila_impressao_automatica
  on public.fila_impressao;

create trigger trg_proteger_retorno_fila_impressao_automatica
before update of status on public.fila_impressao
for each row
execute function public.proteger_retorno_fila_impressao_automatica();

create or replace function public.configurar_fila_impressao(
  p_fila_ativa boolean,
  p_horario_inicio text,
  p_horario_fim text,
  p_imprimir_itens_editados boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cancelados integer := 0;
begin
  if p_horario_inicio !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário inicial inválido.' using errcode = '22007';
  end if;

  if p_horario_fim !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Horário final inválido.' using errcode = '22007';
  end if;

  insert into public.configuracoes_loja (chave, valor, tipo, descricao, updated_at)
  values
    ('fila_impressao_automatica_ativa', p_fila_ativa::text, 'boolean', 'Permite criar eventos automáticos na fila de impressão.', now()),
    ('fila_impressao_horario_inicio', p_horario_inicio, 'time', 'Início da janela diária de impressão automática em America/Fortaleza.', now()),
    ('fila_impressao_horario_fim', p_horario_fim, 'time', 'Fim da janela diária de impressão automática; igual ao início significa 24 horas.', now()),
    ('impressao_itens_editados_ativa', p_imprimir_itens_editados::text, 'boolean', 'Imprime automaticamente itens adicionados durante a edição de um pedido.', now())
  on conflict (chave) do update
  set valor = excluded.valor,
      tipo = excluded.tipo,
      descricao = excluded.descricao,
      updated_at = excluded.updated_at;

  update public.fila_impressao
  set status = 'cancelado',
      processado_em = now(),
      erro_mensagem = 'Cancelado pela configuração da fila automática.',
      erro = null,
      updated_at = now()
  where status = 'pendente'
    and automatico = true
    and not public.fila_impressao_automatica_permitida(
      escopo,
      coalesce(criado_em, created_at, now())
    );

  get diagnostics v_cancelados = row_count;

  return jsonb_build_object('cancelados', v_cancelados);
end;
$$;

revoke all on function public.configurar_fila_impressao(boolean, text, text, boolean) from public;
grant execute on function public.configurar_fila_impressao(boolean, text, text, boolean)
  to anon, authenticated, service_role;

create index if not exists idx_fila_impressao_automaticos_pendentes
  on public.fila_impressao (criado_em)
  where status = 'pendente' and automatico = true;

commit;
