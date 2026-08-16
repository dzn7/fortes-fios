-- Teste transacional do RBAC do Admin.
-- Executado pela Management API e sempre encerrado com rollback: nenhuma
-- fixture pode sobrar no projeto real.

begin;

do $$
declare
  v_admin uuid;
  v_admin_2 uuid;
  v_atendente uuid;
  v_count integer;
  v_papel text;
  v_versao integer;
  v_versao_depois integer;
  v_hash text;
  v_ok boolean;
begin
  ------------------------------------------------------------------
  -- 1. criar usuário grava bcrypt, nunca SHA-256
  ------------------------------------------------------------------
  v_admin := public.criar_usuario_sistema(
    '__teste_rbac_admin__', '__teste_rbac_admin__', 'senha-forte-1', 'admin');

  select senha_hash into v_hash from public.usuarios_sistema where id = v_admin;
  if left(v_hash, 2) <> '$2' then
    raise exception 'senha nova deveria nascer em bcrypt, nasceu %', left(v_hash, 4);
  end if;

  ------------------------------------------------------------------
  -- 2. autenticação aceita a senha certa e recusa a errada
  ------------------------------------------------------------------
  select count(*) into v_count
    from public.autenticar_usuario_admin('__teste_rbac_admin__', 'senha-forte-1');
  if v_count <> 1 then
    raise exception 'senha correta deveria autenticar, retornou % linhas', v_count;
  end if;

  select count(*) into v_count
    from public.autenticar_usuario_admin('__teste_rbac_admin__', 'senha-errada');
  if v_count <> 0 then
    raise exception 'senha errada não pode autenticar';
  end if;

  ------------------------------------------------------------------
  -- 3. hash legado continua entrando E é migrado para bcrypt no login
  ------------------------------------------------------------------
  v_atendente := public.criar_usuario_sistema(
    '__teste_rbac_atendente__', '__teste_rbac_atendente__', 'irrelevante', 'atendente');

  update public.usuarios_sistema
     set senha_hash = encode(extensions.digest('senha-legada', 'sha256'), 'hex')
   where id = v_atendente;

  select count(*) into v_count
    from public.autenticar_usuario_admin('__teste_rbac_atendente__', 'senha-legada');
  if v_count <> 1 then
    raise exception 'hash legado deveria continuar autenticando';
  end if;

  select senha_hash into v_hash from public.usuarios_sistema where id = v_atendente;
  if left(v_hash, 2) <> '$2' then
    raise exception 'login com hash legado deveria regravar em bcrypt, ficou %', left(v_hash, 4);
  end if;

  select public.senha_confere('senha-legada', v_hash) into v_ok;
  if not v_ok then
    raise exception 'a senha antiga precisa continuar valendo depois da migração';
  end if;

  ------------------------------------------------------------------
  -- 4. usuário inativo não autentica
  ------------------------------------------------------------------
  update public.usuarios_sistema set ativo = false where id = v_atendente;
  select count(*) into v_count
    from public.autenticar_usuario_admin('__teste_rbac_atendente__', 'senha-legada');
  if v_count <> 0 then
    raise exception 'usuário desativado não pode autenticar';
  end if;
  update public.usuarios_sistema set ativo = true where id = v_atendente;

  ------------------------------------------------------------------
  -- 5. alterar permissões sobe a versão (invalida sessão antiga)
  ------------------------------------------------------------------
  select permissoes_versao into v_versao
    from public.usuarios_sistema where id = v_atendente;

  perform public.salvar_acesso_usuario(
    v_admin, v_atendente, null, '{"financas.ver": true}'::jsonb, null);

  select permissoes_versao, permissoes->>'financas.ver'
    into v_versao_depois, v_papel
    from public.usuarios_sistema where id = v_atendente;

  if v_versao_depois <> v_versao + 1 then
    raise exception 'permissoes_versao deveria subir de % para %, foi para %',
      v_versao, v_versao + 1, v_versao_depois;
  end if;
  if v_papel <> 'true' then
    raise exception 'permissão concedida não foi gravada';
  end if;

  ------------------------------------------------------------------
  -- 6. ninguém altera o próprio acesso
  ------------------------------------------------------------------
  begin
    perform public.salvar_acesso_usuario(
      v_admin, v_admin, null, '{"financas.ver": false}'::jsonb, null);
    raise exception 'alterar o próprio acesso deveria ter sido recusado';
  exception when check_violation then
    null;
  end;

  ------------------------------------------------------------------
  -- 7. a loja não fica sem administrador ativo
  ------------------------------------------------------------------
  -- Neutraliza os admins reais do projeto para isolar o cenário.
  create temporary table __admins_reais on commit drop as
    select id from public.usuarios_sistema
     where papel = 'admin' and ativo = true and id <> v_admin;
  update public.usuarios_sistema set ativo = false
   where id in (select id from __admins_reais);

  begin
    perform public.salvar_acesso_usuario(v_atendente, v_admin, 'atendente', null, null);
    raise exception 'rebaixar o último admin ativo deveria ter sido recusado';
  exception when check_violation then
    null;
  end;

  begin
    perform public.salvar_acesso_usuario(v_atendente, v_admin, null, null, false);
    raise exception 'desativar o último admin ativo deveria ter sido recusado';
  exception when check_violation then
    null;
  end;

  -- Com um segundo admin ativo, a mesma operação passa.
  v_admin_2 := public.criar_usuario_sistema(
    '__teste_rbac_admin2__', '__teste_rbac_admin2__', 'senha-forte-2', 'admin');

  if not public.salvar_acesso_usuario(v_atendente, v_admin, 'atendente', null, null) then
    raise exception 'com outro admin ativo, o rebaixamento deveria passar';
  end if;

  select papel into v_papel from public.usuarios_sistema where id = v_admin;
  if v_papel <> 'atendente' then
    raise exception 'papel deveria ter virado atendente, está %', v_papel;
  end if;

  ------------------------------------------------------------------
  -- 8. auditoria registrou antes e depois
  ------------------------------------------------------------------
  select count(*) into v_count
    from public.acessos_auditoria
   where alvo_id = v_admin
     and acao = 'papel_alterado'
     and antes->>'papel' = 'admin'
     and depois->>'papel' = 'atendente';
  if v_count <> 1 then
    raise exception 'auditoria deveria ter 1 registro de troca de papel, tem %', v_count;
  end if;

  ------------------------------------------------------------------
  -- 9. papel fora do conjunto é recusado pelo banco
  ------------------------------------------------------------------
  begin
    update public.usuarios_sistema set papel = 'superusuario' where id = v_atendente;
    raise exception 'papel inválido deveria violar a constraint';
  exception when check_violation then
    null;
  end;

  ------------------------------------------------------------------
  -- 10. anon não alcança o que define privilégio
  ------------------------------------------------------------------
  if has_column_privilege('anon', 'public.usuarios_sistema', 'senha_hash', 'SELECT') then
    raise exception 'anon não pode ler senha_hash';
  end if;
  if has_column_privilege('anon', 'public.usuarios_sistema', 'papel', 'UPDATE') then
    raise exception 'anon não pode escrever papel';
  end if;
  if has_column_privilege('anon', 'public.usuarios_sistema', 'permissoes', 'UPDATE') then
    raise exception 'anon não pode escrever permissoes';
  end if;
  if has_table_privilege('anon', 'public.acessos_auditoria', 'SELECT') then
    raise exception 'anon não pode ler a auditoria de acessos';
  end if;

  -- E o que as telas atuais usam continua de pé.
  if not has_column_privilege('anon', 'public.usuarios_sistema', 'nome', 'SELECT') then
    raise exception 'as telas atuais precisam continuar lendo nome';
  end if;
  if not has_column_privilege('anon', 'public.usuarios_sistema', 'avatar_url', 'UPDATE') then
    raise exception 'a troca de avatar precisa continuar funcionando';
  end if;

  ------------------------------------------------------------------
  -- 11. fase 4: dado financeiro e função privilegiada fora do anon.
  -- O bug que isto pega: `revoke from anon` em FUNÇÃO é no-op silencioso,
  -- porque o EXECUTE vem de um grant a PUBLIC. Conferir por
  -- has_function_privilege, nunca por "eu escrevi o revoke".
  ------------------------------------------------------------------
  if has_table_privilege('anon', 'public.financas_diarias', 'SELECT') then
    raise exception 'anon não pode ler financas_diarias';
  end if;
  if has_table_privilege('anon', 'public.movimentacoes_caixa', 'SELECT') then
    raise exception 'anon não pode ler movimentacoes_caixa';
  end if;
  if has_table_privilege('anon', 'public.caixas', 'SELECT') then
    raise exception 'anon não pode ler caixas';
  end if;

  if has_function_privilege('anon', 'public.obter_lucro_produtos(timestamptz, timestamptz)', 'EXECUTE') then
    raise exception 'anon não pode executar obter_lucro_produtos';
  end if;
  if has_function_privilege('anon', 'public.estatisticas_pedidos_periodo(timestamptz, timestamptz)', 'EXECUTE') then
    raise exception 'anon não pode executar estatisticas_pedidos_periodo';
  end if;
  if has_function_privilege('anon', 'public.salvar_acesso_usuario(uuid, uuid, character varying, jsonb, boolean)', 'EXECUTE') then
    raise exception 'anon não pode executar salvar_acesso_usuario — isso contorna o RBAC inteiro';
  end if;
  if has_function_privilege('anon', 'public.criar_usuario_sistema(character varying, character varying, text, character varying, text, character varying, uuid)', 'EXECUTE') then
    raise exception 'anon não pode criar usuário do sistema';
  end if;
  if has_function_privilege('anon', 'public.atualizar_senha_usuario(uuid, text)', 'EXECUTE') then
    raise exception 'anon não pode trocar senha alheia';
  end if;
  if has_function_privilege('anon', 'public.listar_notificacoes(text, integer, boolean)', 'EXECUTE') then
    raise exception 'anon não pode listar notificações';
  end if;

  -- E o service_role, que é quem as rotas usam, continua alcançando tudo.
  if not has_function_privilege('service_role', 'public.salvar_acesso_usuario(uuid, uuid, character varying, jsonb, boolean)', 'EXECUTE') then
    raise exception 'service_role precisa executar salvar_acesso_usuario';
  end if;
  if not has_table_privilege('service_role', 'public.movimentacoes_caixa', 'SELECT') then
    raise exception 'service_role precisa ler movimentacoes_caixa';
  end if;
end;
$$;

rollback;
