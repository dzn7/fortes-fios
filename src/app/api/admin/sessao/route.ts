import { NextRequest, NextResponse } from 'next/server'
import {
  autenticar,
  definirCookieSessao,
  lerSessao,
  limparCookieSessao,
} from '@/lib/server/sessao-admin'

export const dynamic = 'force-dynamic'

/**
 * Sessão do Admin.
 *
 *   POST   → login: confere a senha no banco e emite o cookie assinado
 *   GET    → quem sou eu: usuário e permissões já resolvidas
 *   DELETE → logout: apaga o cookie
 *
 * A senha só existe dentro do POST. Nada dela vai para o cliente, e o cookie
 * emitido é `httpOnly` — o JavaScript da página não o alcança.
 *
 * Spec: specs/rbac-admin.md §7
 */

/** Só aceita login vindo da própria origem: corta CSRF de formulário externo. */
const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const usuarioParaCliente = (usuario: {
  id: string
  nome: string
  nomeUsuario: string
  papel: string
  avatarUrl: string | null
  corAvatar: string
  permissoes: Record<string, boolean>
}) => ({
  id: usuario.id,
  nome: usuario.nome,
  nome_usuario: usuario.nomeUsuario,
  papel: usuario.papel,
  avatar_url: usuario.avatarUrl,
  cor_avatar: usuario.corAvatar,
})

export async function POST(request: NextRequest) {
  if (!origemValida(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Origem inválida.' }, { status: 403 })
  }

  try {
    const corpo = (await request.json()) as { nomeUsuario?: unknown; senha?: unknown }
    const nomeUsuario =
      typeof corpo.nomeUsuario === 'string' ? corpo.nomeUsuario.trim().toLowerCase() : ''
    const senha = typeof corpo.senha === 'string' ? corpo.senha : ''

    if (!nomeUsuario || nomeUsuario.length > 80 || !senha || senha.length > 200) {
      return NextResponse.json(
        { sucesso: false, erro: 'Usuário ou senha inválidos.' },
        { status: 400 },
      )
    }

    const usuario = await autenticar(nomeUsuario, senha)

    // Mensagem única: distinguir "não existe" de "senha errada" entregaria uma
    // lista de usuários válidos a quem estiver tentando.
    if (!usuario) {
      return NextResponse.json(
        { sucesso: false, erro: 'Usuário ou senha incorretos.' },
        { status: 401 },
      )
    }

    const resposta = NextResponse.json({
      sucesso: true,
      usuario: usuarioParaCliente(usuario),
      permissoes: usuario.permissoes,
    })
    return definirCookieSessao(resposta, usuario)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao entrar.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessao = await lerSessao(request)

    if (!sessao.ok) {
      const resposta = NextResponse.json(
        { sucesso: false, motivo: sessao.motivo },
        { status: 401 },
      )
      // Sessão que não vale mais não pode continuar no navegador ocupando lugar
      // e reenviando a cada request.
      return sessao.motivo === 'ausente' ? resposta : limparCookieSessao(resposta)
    }

    return NextResponse.json({
      sucesso: true,
      usuario: usuarioParaCliente(sessao.usuario),
      permissoes: sessao.usuario.permissoes,
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao ler a sessão.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

export async function DELETE() {
  return limparCookieSessao(NextResponse.json({ sucesso: true }))
}
