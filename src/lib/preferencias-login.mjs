/**
 * "Lembrar de mim" no login do Admin.
 *
 * A versão anterior guardava `admin_saved_password` em texto claro no
 * `localStorage` — qualquer script da página, extensão ou pessoa com o aparelho
 * em mãos lia a senha do administrador. Foi removida por isso.
 *
 * O que a pessoa realmente quer de "lembrar" é **não redigitar e não relogar**.
 * As duas coisas são entregues sem guardar senha:
 *   - o nome de usuário fica salvo e o campo vem preenchido;
 *   - a sessão em si é o cookie assinado de 8 horas (`/api/admin/sessao`), que
 *     mantém a pessoa dentro sem nenhum segredo no navegador.
 *
 * Este módulo existe para que essa regra seja explícita e testável, e não uma
 * decisão implícita dentro de um componente.
 */

export const CHAVE_LOGIN_LEMBRADO = 'admin_login_lembrado'

const PREFERENCIA_VAZIA = { nomeUsuario: '', lembrar: false }

/** Mesma normalização do login: o que se lembra tem que casar com o que se envia. */
const normalizarUsuario = (valor) =>
  typeof valor === 'string' ? valor.trim().toLowerCase() : ''

/**
 * Monta o que vai para o storage. A senha é aceita na entrada só para deixar
 * evidente, aqui, que ela é descartada — quem chama não precisa lembrar disso.
 *
 * @param {{ nomeUsuario?: string, senha?: string, lembrar?: boolean }} entrada
 */
export const montarLoginLembrado = (entrada) => {
  const nomeUsuario = normalizarUsuario(entrada?.nomeUsuario)

  if (!entrada?.lembrar || !nomeUsuario) return { ...PREFERENCIA_VAZIA }
  return { nomeUsuario, lembrar: true }
}

/**
 * Lê o storage. Devolve sempre o formato novo — preferência antiga que ainda
 * carregue senha é lida sem ela, e a senha some no próximo gravar.
 *
 * @param {unknown} bruto
 */
export const lerLoginLembrado = (bruto) => {
  if (typeof bruto !== 'string' || !bruto) return { ...PREFERENCIA_VAZIA }

  let dados
  try {
    dados = JSON.parse(bruto)
  } catch {
    return { ...PREFERENCIA_VAZIA }
  }

  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return { ...PREFERENCIA_VAZIA }
  }

  const nomeUsuario = normalizarUsuario(dados.nomeUsuario)
  if (!nomeUsuario || dados.lembrar !== true) return { ...PREFERENCIA_VAZIA }

  return { nomeUsuario, lembrar: true }
}
