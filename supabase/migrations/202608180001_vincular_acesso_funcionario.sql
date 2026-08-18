-- ---------------------------------------------------------------------------
-- Liga os acessos órfãos ao funcionário correspondente.
--
-- Contexto: `criarUsuarioSistema` recebia `funcionarioId` e o descartava antes
-- de montar o POST, e a rota de Acessos não lia o campo. O vínculo nunca era
-- gravado — dos 3 usuários existentes, 2 estavam com `funcionario_id` nulo,
-- incluindo um com funcionário homônimo cadastrado.
--
-- Sem o vínculo, excluir um funcionário não tem como achar o login dele, e o
-- acesso sobrevive à demissão: a pessoa some da Equipe e continua no cartão de
-- perfis de `/admin/login`.
--
-- O casamento é DELIBERADAMENTE conservador. Vínculo errado é pior que vínculo
-- ausente: apagaria o login da pessoa errada na próxima exclusão. Só liga
-- quando não há dúvida nenhuma.
--
-- Spec: specs/exclusao-acesso-funcionario.md
-- ---------------------------------------------------------------------------

-- `unaccent` não está instalada neste projeto e instalar extensão é decisão
-- própria (AGENTS §3.2). `translate` resolve os acentos que ocorrem em nome
-- brasileiro e é determinístico. Espelha `normalizarNome` de `cadastro-equipe.ts`.
with usuarios_normalizados as (
  select
    id,
    btrim(regexp_replace(
      lower(translate(
        nome,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
      )),
      '\s+', ' ', 'g'
    )) as chave
  from public.usuarios_sistema
  where funcionario_id is null
),
funcionarios_normalizados as (
  select
    id,
    btrim(regexp_replace(
      lower(translate(
        nome,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
      )),
      '\s+', ' ', 'g'
    )) as chave
  from public.funcionarios
),
-- Um usuário só é candidato se existir EXATAMENTE UM funcionário com o mesmo
-- nome normalizado. Dois homônimos na equipe → empate → não liga.
candidatos as (
  -- `array_agg(...)[1]` e não `min(...)`: o Postgres não tem `min(uuid)`. O
  -- `having` abaixo já garante linha única, então qualquer agregado devolve o
  -- mesmo valor — este só não exige converter uuid para texto e voltar.
  select u.id as usuario_id, (array_agg(f.id))[1] as funcionario_id
    from usuarios_normalizados u
    join funcionarios_normalizados f on f.chave = u.chave
   where u.chave <> ''
   group by u.id
  having count(*) = 1
)
update public.usuarios_sistema alvo
   set funcionario_id = candidatos.funcionario_id,
       updated_at = now()
  from candidatos
 where alvo.id = candidatos.usuario_id
   and alvo.funcionario_id is null
   -- E o funcionário não pode já pertencer a outro login.
   and not exists (
     select 1
       from public.usuarios_sistema outro
      where outro.funcionario_id = candidatos.funcionario_id
   );

comment on column public.usuarios_sistema.funcionario_id is
  'Funcionário dono deste login. Excluir o funcionário apaga o acesso junto (specs/exclusao-acesso-funcionario.md).';
