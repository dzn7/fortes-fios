import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { ehRespostaNegada, exigirPermissao } from '@/lib/server/sessao-admin'
import { normalizarPermissoes, PAPEIS_VALIDOS, resolverPermissoes } from '@/lib/rbac.mjs'
import { idAtorParaAuditoria } from '@/lib/server/acesso-desenvolvedor.mjs'

export const dynamic = 'force-dynamic'

/**
 * Acessos da equipe — criar, editar e permissionar usuários do Admin.
 *
 * Vive no servidor porque `papel`, `permissoes` e `permissoes_versao` saíram do
 * alcance de `anon` na migration `202608150004`: antes, qualquer pessoa com a
 * anon key (que é pública, vai no bundle) fazia `PATCH usuarios_sistema` e se
 * promovia a administrador. Nenhum controle no frontend sobreviveria a isso.
 *
 * Toda operação passa por `exigirPermissao` ANTES de tocar no banco.
 *
 * Spec: specs/rbac-admin.md §7
 */

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const COLUNAS_SEGURAS =
  'id, nome, nome_usuario, papel, avatar_url, cor_avatar, ativo, funcionario_id, ultimo_acesso, created_at'

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status })

type LinhaUsuario = {
  id: string
  papel: string
  ativo: boolean
  permissoes: unknown
}

export async function GET(request: NextRequest) {
  const autorizacao = await exigirPermissao(request, 'acessos.ver')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select(`${COLUNAS_SEGURAS}, permissoes, permissoes_versao`)
      .order('nome')

    if (error) throw new Error(error.message)

    // Devolve as permissões JÁ RESOLVIDAS: a tela não precisa reimplementar a
    // regra de preset + override, e não existe segunda fonte da verdade.
    const usuarios = (data || []).map((linha) => {
      const usuario = linha as unknown as LinhaUsuario & Record<string, unknown>
      return {
        ...usuario,
        permissoes: resolverPermissoes(usuario),
        overrides: normalizarPermissoes(usuario.permissoes),
      }
    })

    return NextResponse.json({ sucesso: true, usuarios })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao carregar acessos.', 500)
  }
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'acessos.criar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json()) as {
      nome?: unknown
      nomeUsuario?: unknown
      senha?: unknown
      papel?: unknown
      permissoes?: unknown
      funcionarioId?: unknown
      corAvatar?: unknown
    }

    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : ''
    const nomeUsuario =
      typeof corpo.nomeUsuario === 'string' ? corpo.nomeUsuario.trim().toLowerCase() : ''
    const senha = typeof corpo.senha === 'string' ? corpo.senha : ''
    const papel = typeof corpo.papel === 'string' ? corpo.papel : ''

    if (!nome || !nomeUsuario || nomeUsuario.length > 80) {
      return erro('Nome e usuário são obrigatórios.', 400)
    }
    if (senha.length < 6 || senha.length > 200) {
      return erro('A senha precisa ter ao menos 6 caracteres.', 400)
    }
    if (!PAPEIS_VALIDOS.includes(papel)) {
      return erro('Papel inválido.', 400)
    }

    const supabase = obterSupabaseAdmin()
    const { data: novoId, error: erroCriar } = await supabase.rpc('criar_usuario_sistema', {
      p_nome: nome,
      p_nome_usuario: nomeUsuario,
      p_senha: senha,
      p_papel: papel,
    })

    if (erroCriar) {
      if (erroCriar.message.includes('duplicate') || erroCriar.code === '23505') {
        return erro('Já existe um acesso com esse nome de usuário.', 409)
      }
      throw new Error(erroCriar.message)
    }

    // Vínculo e cor são cadastro, não privilégio: seguem por UPDATE, como no
    // PATCH. Sem gravar `funcionario_id` aqui, excluir o funcionário não teria
    // como achar o login dele — era metade do bug da Equipe.
    const cadastro: Record<string, unknown> = {}
    if (UUID_VALIDO.test(String(corpo.funcionarioId ?? ''))) {
      cadastro.funcionario_id = corpo.funcionarioId
    }
    if (typeof corpo.corAvatar === 'string' && corpo.corAvatar.trim()) {
      cadastro.cor_avatar = corpo.corAvatar.trim()
    }

    if (Object.keys(cadastro).length > 0) {
      const { error: erroCadastro } = await supabase
        .from('usuarios_sistema')
        .update(cadastro)
        .eq('id', novoId)
      if (erroCadastro) throw new Error(erroCadastro.message)
    }

    // Permissões só depois de existir a linha, e sempre pela função que audita.
    const overrides = normalizarPermissoes(corpo.permissoes)
    if (Object.keys(overrides).length > 0) {
      const { error: erroPermissoes } = await supabase.rpc('salvar_acesso_usuario', {
        p_ator_id: idAtorParaAuditoria(autorizacao.usuario.id),
        p_alvo_id: novoId,
        p_permissoes: overrides,
      })
      if (erroPermissoes) throw new Error(erroPermissoes.message)
    }

    await supabase.from('acessos_auditoria').insert({
      ator_id: idAtorParaAuditoria(autorizacao.usuario.id),
      alvo_id: novoId,
      acao: 'criado',
      depois: { papel, permissoes: overrides },
    })

    return NextResponse.json({ sucesso: true, id: novoId })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao criar acesso.', 500)
  }
}

export async function PATCH(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  try {
    const corpo = (await request.json()) as {
      id?: unknown
      nome?: unknown
      papel?: unknown
      permissoes?: unknown
      ativo?: unknown
      avatarUrl?: unknown
      corAvatar?: unknown
      funcionarioId?: unknown
    }

    const id = typeof corpo.id === 'string' ? corpo.id : ''
    if (!UUID_VALIDO.test(id)) return erro('Usuário inválido.', 400)

    const papel = typeof corpo.papel === 'string' ? corpo.papel : null
    if (papel !== null && !PAPEIS_VALIDOS.includes(papel)) {
      return erro('Papel inválido.', 400)
    }

    // Dois níveis: mexer em papel, permissões ou ativação é conceder poder e
    // exige `acessos.permissoes`. Trocar nome ou avatar é cadastro comum.
    const mexeEmPrivilegio =
      papel !== null || corpo.permissoes !== undefined || typeof corpo.ativo === 'boolean'

    const autorizacao = await exigirPermissao(
      request,
      mexeEmPrivilegio ? 'acessos.permissoes' : 'acessos.editar',
    )
    if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

    if (mexeEmPrivilegio && id === autorizacao.usuario.id) {
      return erro('Você não pode alterar o próprio acesso.', 403)
    }

    const supabase = obterSupabaseAdmin()

    if (mexeEmPrivilegio) {
      const { data, error } = await supabase.rpc('salvar_acesso_usuario', {
        p_ator_id: idAtorParaAuditoria(autorizacao.usuario.id),
        p_alvo_id: id,
        p_papel: papel,
        p_permissoes:
          corpo.permissoes === undefined ? null : normalizarPermissoes(corpo.permissoes),
        p_ativo: typeof corpo.ativo === 'boolean' ? corpo.ativo : null,
      })

      if (error) {
        // As invariantes do banco (último admin, auto-edição) chegam como
        // check_violation e viram 409, não 500: não é falha, é recusa.
        if (error.code === '23514' || error.message.includes('administrador ativo')) {
          return erro(error.message.replace(/^.*?:\s*/, ''), 409)
        }
        throw new Error(error.message)
      }
      if (data !== true) return erro('Usuário não encontrado.', 404)
    }

    // Campos de cadastro seguem por UPDATE direto: não são privilégio e não
    // precisam da auditoria de acesso.
    const cadastro: Record<string, unknown> = {}
    if (typeof corpo.nome === 'string' && corpo.nome.trim()) cadastro.nome = corpo.nome.trim()
    if (corpo.avatarUrl !== undefined) cadastro.avatar_url = corpo.avatarUrl
    if (typeof corpo.corAvatar === 'string') cadastro.cor_avatar = corpo.corAvatar
    if (corpo.funcionarioId !== undefined) cadastro.funcionario_id = corpo.funcionarioId

    if (Object.keys(cadastro).length > 0) {
      const { error } = await supabase.from('usuarios_sistema').update(cadastro).eq('id', id)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao salvar acesso.', 500)
  }
}

/** Troca de senha. Sempre pelo servidor: a RPC que gera o hash é privilegiada. */
export async function PUT(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'acessos.editar')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const corpo = (await request.json()) as { id?: unknown; senha?: unknown }
    const id = typeof corpo.id === 'string' ? corpo.id : ''
    const senha = typeof corpo.senha === 'string' ? corpo.senha : ''

    if (!UUID_VALIDO.test(id)) return erro('Usuário inválido.', 400)
    if (senha.length < 6 || senha.length > 200) {
      return erro('A senha precisa ter ao menos 6 caracteres.', 400)
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase.rpc('atualizar_senha_usuario', {
      p_usuario_id: id,
      p_nova_senha: senha,
    })

    if (error) throw new Error(error.message)
    if (!data) return erro('Usuário não encontrado.', 404)

    await supabase.from('acessos_auditoria').insert({
      ator_id: idAtorParaAuditoria(autorizacao.usuario.id),
      alvo_id: id,
      acao: 'senha_alterada',
    })

    return NextResponse.json({ sucesso: true })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao alterar senha.', 500)
  }
}

/**
 * Guardas de exclusão de acesso, compartilhadas pelos dois seletores.
 *
 * `alvos` é o conjunto inteiro que a requisição vai apagar: a contagem de
 * administradores restantes precisa descontar todos eles de uma vez, senão dois
 * acessos apagados juntos passariam pela checagem um cobrindo o outro.
 */
const recusarExclusaoDeAcesso = async (
  supabase: ReturnType<typeof obterSupabaseAdmin>,
  alvoId: string,
  alvos: string[],
  atorId: string,
): Promise<NextResponse | null> => {
  if (alvoId === atorId) return erro('Você não pode excluir o próprio acesso.', 403)

  const { data: alvo } = await supabase
    .from('usuarios_sistema')
    .select('papel, ativo')
    .eq('id', alvoId)
    .maybeSingle()

  // Mesma invariante do `salvar_acesso_usuario`: a loja não fica sem admin.
  if (alvo?.papel === 'admin' && alvo.ativo) {
    const { count } = await supabase
      .from('usuarios_sistema')
      .select('id', { count: 'exact', head: true })
      .eq('papel', 'admin')
      .eq('ativo', true)
      .not('id', 'in', `(${alvos.join(',')})`)

    if (!count) return erro('A loja precisa de pelo menos um administrador ativo.', 409)
  }

  return null
}

/**
 * Exclusão de acesso por dois seletores:
 *
 *   ?id=<uuid>            → aquele acesso (a aba de Acessos)
 *   ?funcionarioId=<uuid> → o(s) acesso(s) daquele funcionário (a tela de Equipe)
 *
 * O segundo existe porque excluir funcionário apagava só `funcionarios` e
 * deixava o login vivo: a pessoa sumia da Equipe e continuava no cartão de
 * perfis de `/admin/login`, entrando com a senha antiga.
 *
 * Spec: specs/exclusao-acesso-funcionario.md
 */
export async function DELETE(request: NextRequest) {
  if (!origemValida(request)) return erro('Origem inválida.', 403)

  const autorizacao = await exigirPermissao(request, 'acessos.excluir')
  if (ehRespostaNegada(autorizacao)) return autorizacao.resposta

  try {
    const supabase = obterSupabaseAdmin()
    const parametros = request.nextUrl.searchParams
    const id = parametros.get('id') || ''
    const funcionarioId = parametros.get('funcionarioId') || ''

    let alvos: string[]

    if (UUID_VALIDO.test(id)) {
      alvos = [id]
    } else if (UUID_VALIDO.test(funcionarioId)) {
      const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('id')
        .eq('funcionario_id', funcionarioId)

      if (error) throw new Error(error.message)
      alvos = (data || []).map((linha) => (linha as { id: string }).id)

      // Funcionário sem login é caso normal, não erro: a tela precisa seguir
      // adiante e apagar o funcionário.
      if (alvos.length === 0) return NextResponse.json({ sucesso: true, excluidos: 0 })
    } else {
      return erro('Usuário inválido.', 400)
    }

    for (const alvo of alvos) {
      const recusa = await recusarExclusaoDeAcesso(supabase, alvo, alvos, autorizacao.usuario.id)
      if (recusa) return recusa
    }

    const { error } = await supabase.from('usuarios_sistema').delete().in('id', alvos)
    if (error) throw new Error(error.message)

    return NextResponse.json({ sucesso: true, excluidos: alvos.length })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'Falha ao excluir acesso.', 500)
  }
}
