-- 🔴 Correção: os `revoke ... from anon` das migrations anteriores eram no-op.
--
-- Função em Postgres nasce com `EXECUTE` concedido a `PUBLIC` — é o `=X/postgres`
-- que aparece em `pg_proc.proacl`. `anon` e `authenticated` executam por herança
-- desse grant, sem grant próprio. Revogar de quem não tem grant explícito não
-- tira nada e **não devolve erro**: o comando "funciona", o privilégio fica, e a
-- auditoria por `\dp` parece correta.
--
-- Resultado: até aqui, `salvar_acesso_usuario`, `criar_usuario_sistema` e
-- `atualizar_senha_usuario` — todas `SECURITY DEFINER`, todas rodando como
-- `postgres` — continuavam chamáveis por qualquer um com a anon key. Ou seja: o
-- RBAC inteiro era contornável por uma requisição REST que criava um
-- administrador ou trocava a senha de outra pessoa.
--
-- Regra que fica: para fechar função, revogar de `PUBLIC`, não de `anon`.
-- Conferência correta é `has_function_privilege('anon', oid, 'EXECUTE')`.

set search_path = pg_catalog, public, extensions;

-- ---------------------------------------------------------------------------
-- Privilégio: criar acesso, trocar senha, mudar papel/permissões
-- ---------------------------------------------------------------------------

revoke all on function public.salvar_acesso_usuario(uuid, uuid, character varying, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.criar_usuario_sistema(character varying, character varying, text, character varying, text, character varying, uuid)
  from public, anon, authenticated;
revoke all on function public.atualizar_senha_usuario(uuid, text)
  from public, anon, authenticated;
revoke all on function public.autenticar_usuario_admin(text, text)
  from public, anon, authenticated;
revoke all on function public.obter_sessao_admin(uuid)
  from public, anon, authenticated;
revoke all on function public.hash_senha(text)
  from public, anon, authenticated;
revoke all on function public.senha_confere(text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notificações: as tabelas já estavam fechadas, mas estas funções são
-- SECURITY DEFINER e devolviam o conteúdo delas para quem chamasse.
-- ---------------------------------------------------------------------------

revoke all on function public.listar_notificacoes(text, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.resumo_notificacoes(text)
  from public, anon, authenticated;
revoke all on function public.reconciliar_notificacoes()
  from public, anon, authenticated;
revoke all on function public.sincronizar_notificacoes_estoque(uuid)
  from public, anon, authenticated;
revoke all on function public.sincronizar_notificacoes_pedido(uuid)
  from public, anon, authenticated;
revoke all on function public.descrever_estoque_produto(integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.descrever_pedido_aguardando(text, integer, text, timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Devolve explicitamente a quem precisa: tudo isso é chamado por route handler
-- com service_role.
-- ---------------------------------------------------------------------------

grant execute on function public.salvar_acesso_usuario(uuid, uuid, character varying, jsonb, boolean) to service_role;
grant execute on function public.criar_usuario_sistema(character varying, character varying, text, character varying, text, character varying, uuid) to service_role;
grant execute on function public.atualizar_senha_usuario(uuid, text) to service_role;
grant execute on function public.autenticar_usuario_admin(text, text) to service_role;
grant execute on function public.obter_sessao_admin(uuid) to service_role;
grant execute on function public.hash_senha(text) to service_role;
grant execute on function public.senha_confere(text, text) to service_role;
grant execute on function public.listar_notificacoes(text, integer, boolean) to service_role;
grant execute on function public.resumo_notificacoes(text) to service_role;
grant execute on function public.reconciliar_notificacoes() to service_role;
grant execute on function public.sincronizar_notificacoes_estoque(uuid) to service_role;
grant execute on function public.sincronizar_notificacoes_pedido(uuid) to service_role;
grant execute on function public.descrever_estoque_produto(integer, integer, text) to service_role;
grant execute on function public.descrever_pedido_aguardando(text, integer, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Seguem abertas de propósito, porque o cliente as usa legitimamente:
--
--   verificar_senha_usuario        login de garçom/entregador, client-side
--   obter_pedidos_cliente_por_telefone   histórico do cliente na loja pública
--   ajustar_estoque_produto        tela de Estoque do Admin, client-side
--   definir_estoque_produto        idem
--
-- 🔴 As duas de estoque são um buraco conhecido e PRÉ-EXISTENTE: com a anon key
-- dá para zerar o estoque de qualquer produto. Fechá-las exige migrar a tela de
-- Estoque para route handler — fase própria, fora do escopo desta.
-- ---------------------------------------------------------------------------
