import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Token de sessão do Admin: carga JSON + HMAC-SHA256.
 *
 * Existe porque o projeto não usa Supabase Auth (`auth.users` está vazio) e a
 * autenticação anterior era uma string em `localStorage` que qualquer um
 * escrevia. Sem algo que o SERVIDOR consiga conferir, não há autorização real —
 * só componente escondido.
 *
 * Formato: `<carga em base64url>.<hmac em base64url>`. A carga é legível, e
 * tudo bem: ela não é segredo, é declaração assinada. Trocar um byte dela
 * invalida a assinatura, que é o ponto.
 *
 * Vai em cookie `httpOnly` + `Secure` + `SameSite=Lax`, então não é alcançável
 * por JavaScript da página nem viaja em requisição de terceiro.
 *
 * `node:crypto` é embutido — nenhuma dependência nova (AGENTS §3.2).
 *
 * Spec: specs/rbac-admin.md §7
 */

/** Oito horas: cobre um turno inteiro sem obrigar novo login no meio. */
export const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60

/** Abaixo disso o segredo não tem entropia para um HMAC sério. */
const TAMANHO_MINIMO_SEGREDO = 32

const base64url = (texto) => Buffer.from(texto, 'utf8').toString('base64url')

const assinar = (cargaB64, segredo) =>
  createHmac('sha256', segredo).update(cargaB64).digest('base64url')

/**
 * @param {{ usuarioId: string, papel: string, versao: number }} carga
 * @param {string} segredo
 * @param {number} agoraSegundos
 */
export const assinarSessao = (carga, segredo, agoraSegundos = Math.floor(Date.now() / 1000)) => {
  if (typeof segredo !== 'string' || segredo.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error('Segredo de sessão ausente ou curto demais.')
  }
  if (!carga || typeof carga.usuarioId !== 'string' || !carga.usuarioId) {
    throw new Error('Sessão precisa de usuarioId.')
  }
  if (typeof carga.papel !== 'string' || !carga.papel) {
    throw new Error('Sessão precisa de papel.')
  }
  if (!Number.isInteger(carga.versao)) {
    throw new Error('Sessão precisa de versão inteira de permissões.')
  }

  const completa = {
    usuarioId: carga.usuarioId,
    papel: carga.papel,
    versao: carga.versao,
    exp: agoraSegundos + DURACAO_SESSAO_SEGUNDOS,
  }

  const cargaB64 = base64url(JSON.stringify(completa))
  return `${cargaB64}.${assinar(cargaB64, segredo)}`
}

/**
 * Devolve a carga quando o token é íntegro e está no prazo; `null` em qualquer
 * outro caso. Nunca lança: entrada malformada chega por request, e derrubar o
 * route handler por causa dela seria o próprio problema.
 *
 * @param {unknown} token
 * @param {string} segredo
 * @param {number} agoraSegundos
 */
export const verificarSessao = (
  token,
  segredo,
  agoraSegundos = Math.floor(Date.now() / 1000),
) => {
  if (typeof segredo !== 'string' || segredo.length < TAMANHO_MINIMO_SEGREDO) return null
  if (typeof token !== 'string' || !token) return null

  const partes = token.split('.')
  if (partes.length !== 2) return null

  const [cargaB64, assinaturaRecebida] = partes
  if (!cargaB64 || !assinaturaRecebida) return null

  const esperada = assinar(cargaB64, segredo)

  // Comparação em tempo constante: `===` vaza, pelo tempo de resposta, quantos
  // bytes iniciais o atacante já acertou.
  const a = Buffer.from(assinaturaRecebida)
  const b = Buffer.from(esperada)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const carga = JSON.parse(Buffer.from(cargaB64, 'base64url').toString('utf8'))
    if (!carga || typeof carga !== 'object') return null
    if (typeof carga.usuarioId !== 'string' || !carga.usuarioId) return null
    if (!Number.isInteger(carga.exp) || carga.exp <= agoraSegundos) return null
    return carga
  } catch {
    return null
  }
}
