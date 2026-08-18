import { PAPEIS, resolverPermissoes } from '../rbac.mjs'

/**
 * Acesso de manutenção do desenvolvedor — `dzndev`.
 *
 * **Por que este arquivo está em `src/lib/server/`.** A credencial já existiu,
 * até a task de RBAC, dentro de `AdminAuthContext.tsx` — um componente
 * `'use client'`. Ou seja: a senha era servida ao navegador de todo visitante e
 * bastava abrir o DevTools para lê-la. Aqui ela continua **hardcoded no
 * código**, como pedido, mas o módulo só é importado por `sessao-admin.ts`, que
 * só é importado por route handler. O bundle público nunca a vê.
 *
 * O acesso não cria linha em `usuarios_sistema`: é um perfil sintético,
 * reconhecido pelo id sentinela. A sessão emitida para ele é assinada como
 * qualquer outra — sem o `ADMIN_SESSAO_SECRET` ninguém forja o sentinela.
 *
 * Spec: specs/acesso-desenvolvedor.md
 */

export const USUARIO_DESENVOLVEDOR = 'dzndev'

/**
 * Senha fixa, a pedido do usuário. Risco assumido e registrado na spec §8:
 * quem tem o repositório tem o Admin, e trocá-la exige deploy.
 */
const SENHA_DESENVOLVEDOR = '1503'

/**
 * UUID v4 válido para o regex das rotas de acesso, e reservado: nada em
 * `usuarios_sistema` usa este valor (a coluna tem `gen_random_uuid()` como
 * default, que nunca produz o id todo-zeros).
 */
export const ID_DESENVOLVEDOR = '00000000-0000-4000-8000-000000000000'

/**
 * Versão de permissões do perfil sintético. É constante porque não há linha no
 * banco para bater — `lerSessao` reconhece o sentinela antes de consultar.
 */
export const VERSAO_PERMISSOES_DESENVOLVEDOR = 0

const NOME_EXIBIDO = 'Desenvolvedor'

/** Oliva da marca: o avatar do dzndev não usa o laranja herdado do projeto antigo. */
const COR_AVATAR = '#5f6f3f'

const texto = (valor) => (typeof valor === 'string' ? valor : '')

/**
 * O par exato. O **usuário** é comparado sem caixa e sem espaço nas pontas
 * (teclado de celular capitaliza e cola espaço sozinho); a **senha**, byte a
 * byte — normalizar senha aceitaria credencial que o usuário não digitou.
 *
 * @param {unknown} nomeUsuario
 * @param {unknown} senha
 */
export const ehCredencialDesenvolvedor = (nomeUsuario, senha) =>
  texto(nomeUsuario).trim().toLowerCase() === USUARIO_DESENVOLVEDOR &&
  texto(senha) === SENHA_DESENVOLVEDOR

/**
 * O `UsuarioAutorizado` sintético. Sempre um objeto novo: devolver uma
 * referência compartilhada deixaria um route handler distraído mutar o perfil
 * de todas as requisições seguintes do processo.
 */
export const perfilDesenvolvedor = () => ({
  id: ID_DESENVOLVEDOR,
  nome: NOME_EXIBIDO,
  nomeUsuario: USUARIO_DESENVOLVEDOR,
  papel: PAPEIS.ADMIN,
  avatarUrl: null,
  corAvatar: COR_AVATAR,
  permissoes: resolverPermissoes({ papel: PAPEIS.ADMIN, ativo: true }),
  permissoesVersao: VERSAO_PERMISSOES_DESENVOLVEDOR,
})

/** @param {unknown} id */
export const ehDesenvolvedor = (id) => id === ID_DESENVOLVEDOR

/**
 * Ator para `acessos_auditoria`.
 *
 * A coluna `ator_id` é FK para `usuarios_sistema(id)`. O desenvolvedor não tem
 * linha, então gravar o sentinela levantaria `23503` e derrubaria a operação
 * inteira — criar um acesso passaria a falhar justamente quando é o `dzndev`
 * quem cria. A coluna é anulável: `null` registra a ação sem inventar um ator.
 *
 * @param {string} id
 * @returns {string | null}
 */
export const idAtorParaAuditoria = (id) => (ehDesenvolvedor(id) ? null : id)
