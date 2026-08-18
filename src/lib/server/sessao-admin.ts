import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  DURACAO_SESSAO_SEGUNDOS,
  assinarSessao,
  verificarSessao,
} from '@/lib/sessao-token.mjs'
import { podeExecutar, resolverPermissoes } from '@/lib/rbac.mjs'
import {
  ID_DESENVOLVEDOR,
  ehCredencialDesenvolvedor,
  perfilDesenvolvedor,
} from '@/lib/server/acesso-desenvolvedor.mjs'

/**
 * Sessão do Admin no servidor — a fronteira de autorização.
 *
 * Antes disto, o servidor não tinha como saber quem chamava: a identidade era
 * uma string em `localStorage` que o próprio cliente escrevia. Toda checagem de
 * permissão precisa nascer aqui, não no componente.
 *
 * Spec: specs/rbac-admin.md §7
 */

export const NOME_COOKIE_SESSAO = 'ff_sessao_admin'

export type UsuarioAutorizado = {
  id: string
  nome: string
  nomeUsuario: string
  papel: string
  avatarUrl: string | null
  corAvatar: string
  permissoes: Record<string, boolean>
  permissoesVersao: number
}

type LinhaUsuario = {
  id: string
  nome: string
  nome_usuario: string
  papel: string
  avatar_url: string | null
  cor_avatar: string | null
  ativo: boolean
  permissoes: unknown
  permissoes_versao: number
}

const obterSegredo = () => {
  const segredo = (process.env.ADMIN_SESSAO_SECRET || '').trim()
  if (segredo.length < 32) {
    throw new Error(
      'ADMIN_SESSAO_SECRET ausente ou curto demais. Gere 48 bytes aleatórios e configure no ambiente.',
    )
  }
  return segredo
}

const montarUsuario = (linha: LinhaUsuario): UsuarioAutorizado => ({
  id: linha.id,
  nome: linha.nome,
  nomeUsuario: linha.nome_usuario,
  papel: linha.papel,
  avatarUrl: linha.avatar_url,
  corAvatar: linha.cor_avatar || '#f97316',
  permissoes: resolverPermissoes({
    papel: linha.papel,
    ativo: linha.ativo,
    permissoes: linha.permissoes,
  }),
  permissoesVersao: linha.permissoes_versao,
})

/** Opções do cookie. `httpOnly` tira o token do alcance de qualquer script da página. */
export const opcoesCookieSessao = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
})

export const definirCookieSessao = (resposta: NextResponse, usuario: UsuarioAutorizado) => {
  const token = assinarSessao(
    { usuarioId: usuario.id, papel: usuario.papel, versao: usuario.permissoesVersao },
    obterSegredo(),
  )
  resposta.cookies.set(NOME_COOKIE_SESSAO, token, opcoesCookieSessao(DURACAO_SESSAO_SEGUNDOS))
  return resposta
}

export const limparCookieSessao = (resposta: NextResponse) => {
  resposta.cookies.set(NOME_COOKIE_SESSAO, '', opcoesCookieSessao(0))
  return resposta
}

/** Autentica pelo banco. Devolve `null` sem distinguir usuário inexistente de senha errada. */
export const autenticar = async (
  nomeUsuario: string,
  senha: string,
): Promise<UsuarioAutorizado | null> => {
  // Antes do banco: o acesso de manutenção não tem linha em `usuarios_sistema`,
  // e conferi-lo primeiro garante que criar um usuário com o mesmo nome não
  // sequestra o atalho. Ver specs/acesso-desenvolvedor.md.
  if (ehCredencialDesenvolvedor(nomeUsuario, senha)) return perfilDesenvolvedor()

  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('autenticar_usuario_admin', {
    p_nome_usuario: nomeUsuario,
    p_senha: senha,
  })

  if (error) throw new Error(error.message)

  const linha = (Array.isArray(data) ? data[0] : null) as LinhaUsuario | null
  return linha ? montarUsuario(linha) : null
}

export type ResultadoSessao =
  | { ok: true; usuario: UsuarioAutorizado }
  | { ok: false; motivo: 'ausente' | 'invalida' | 'permissoes_alteradas' | 'inativo' }

/**
 * Lê o cookie e reconfere contra o banco.
 *
 * A releitura não é desperdício: é o que impede um atendente rebaixado de
 * seguir usando o sistema com a permissão antiga até o cookie expirar. Custa
 * uma busca por chave primária, no mesmo round-trip que a rota já faria.
 */
export const lerSessao = async (request: NextRequest): Promise<ResultadoSessao> => {
  const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value
  if (!token) return { ok: false, motivo: 'ausente' }

  const carga = verificarSessao(token, obterSegredo())
  if (!carga) return { ok: false, motivo: 'invalida' }

  // O perfil sintético não tem linha para reconferir. A assinatura já provou a
  // origem do cookie: sem o segredo ninguém escreve este id no payload.
  if (carga.usuarioId === ID_DESENVOLVEDOR) {
    return { ok: true, usuario: perfilDesenvolvedor() }
  }

  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('obter_sessao_admin', {
    p_usuario_id: carga.usuarioId,
  })

  if (error) throw new Error(error.message)

  const linha = (Array.isArray(data) ? data[0] : null) as LinhaUsuario | null
  if (!linha) return { ok: false, motivo: 'invalida' }
  if (!linha.ativo) return { ok: false, motivo: 'inativo' }
  if (linha.permissoes_versao !== carga.versao) {
    return { ok: false, motivo: 'permissoes_alteradas' }
  }

  return { ok: true, usuario: montarUsuario(linha) }
}

/**
 * Porteiro dos route handlers sensíveis. Devolve o usuário ou a resposta pronta
 * para o `return` — 401 quando não há sessão válida, 403 quando há sessão mas
 * falta a permissão.
 *
 * Usar SEMPRE antes de tocar no banco: negar depois de consultar já vazou o
 * dado para dentro do processo e, num log de erro, para fora dele.
 */
export const exigirPermissao = async (
  request: NextRequest,
  permissao: string,
): Promise<{ usuario: UsuarioAutorizado } | { resposta: NextResponse }> => {
  const sessao = await lerSessao(request)

  if (!sessao.ok) {
    return {
      resposta: NextResponse.json(
        { sucesso: false, erro: 'Sessão inválida.', motivo: sessao.motivo },
        { status: 401 },
      ),
    }
  }

  if (!podeExecutar(sessao.usuario.permissoes, permissao)) {
    return {
      resposta: NextResponse.json(
        { sucesso: false, erro: 'Sem permissão para esta operação.' },
        { status: 403 },
      ),
    }
  }

  return { usuario: sessao.usuario }
}

export const ehRespostaNegada = (
  resultado: { usuario: UsuarioAutorizado } | { resposta: NextResponse },
): resultado is { resposta: NextResponse } => 'resposta' in resultado
