import { supabase } from './supabase'

/**
 * `atendente` é o papel operacional deste projeto — entra pelo mesmo `/admin` e
 * enxerga só o que o administrador autorizou. `garcom` e `entregador` são de
 * fluxos legados: continuam graváveis, mas não resolvem permissão nenhuma.
 */
export type PapelUsuario = 'admin' | 'atendente' | 'garcom' | 'entregador'

export type UsuarioSistema = {
  id: string
  nome: string
  nome_usuario: string
  papel: PapelUsuario
  avatar_url: string | null
  cor_avatar: string
  funcionario_id: string | null
}

export type ResultadoLogin = {
  sucesso: boolean
  usuario?: UsuarioSistema
  erro?: string
}

const CHAVE_SESSAO = 'usuario_sistema_sessao'

export async function loginUsuarioSistema(
  nomeUsuario: string,
  senha: string
): Promise<ResultadoLogin> {
  try {
    const { data, error } = await supabase.rpc('verificar_senha_usuario', {
      p_nome_usuario: nomeUsuario,
      p_senha: senha,
    })

    if (error) {
      console.error('[Autenticacao] Erro ao verificar senha:', error)
      return { sucesso: false, erro: 'Erro ao conectar com o servidor' }
    }

    if (!data || data.length === 0) {
      return { sucesso: false, erro: 'Usuario ou senha incorretos' }
    }

    const registro = data[0]
    const usuario: UsuarioSistema = {
      id: registro.id,
      nome: registro.nome,
      nome_usuario: registro.nome_usuario,
      papel: registro.papel as PapelUsuario,
      avatar_url: registro.avatar_url,
      cor_avatar: registro.cor_avatar || '#f97316',
      funcionario_id: registro.funcionario_id,
    }

    salvarSessao(usuario)
    return { sucesso: true, usuario }
  } catch (erro) {
    console.error('[Autenticacao] Erro inesperado:', erro)
    return { sucesso: false, erro: 'Erro inesperado ao fazer login' }
  }
}

export function salvarSessao(usuario: UsuarioSistema): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
}

export function obterSessao(): UsuarioSistema | null {
  if (typeof window === 'undefined') return null
  try {
    const dados = localStorage.getItem(CHAVE_SESSAO)
    if (!dados) return null
    return JSON.parse(dados) as UsuarioSistema
  } catch {
    return null
  }
}

export function limparSessao(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CHAVE_SESSAO)
}

export function verificarPapel(
  usuario: UsuarioSistema | null,
  papelRequerido: PapelUsuario
): boolean {
  if (!usuario) return false
  return usuario.papel === papelRequerido
}

export async function listarUsuariosSistema(): Promise<UsuarioSistema[]> {
  try {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome, nome_usuario, papel, avatar_url, cor_avatar, funcionario_id, ativo')
      .order('nome')

    if (error) throw error
    return (data || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      nome_usuario: u.nome_usuario,
      papel: u.papel as PapelUsuario,
      avatar_url: u.avatar_url,
      cor_avatar: u.cor_avatar || '#f97316',
      funcionario_id: u.funcionario_id,
    }))
  } catch (erro) {
    console.error('[Autenticacao] Erro ao listar usuarios:', erro)
    return []
  }
}

/**
 * Perfis de uma ou mais funções. O login do Admin passa `['admin','atendente']`
 * porque os dois entram pela mesma porta — o que muda depois é a permissão.
 */
export async function listarUsuariosPorPapel(
  papel: PapelUsuario | PapelUsuario[]
): Promise<UsuarioSistema[]> {
  try {
    const papeis = Array.isArray(papel) ? papel : [papel]
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome, nome_usuario, papel, avatar_url, cor_avatar, funcionario_id')
      .in('papel', papeis)
      .eq('ativo', true)
      .order('nome')

    if (error) throw error
    return (data || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      nome_usuario: u.nome_usuario,
      papel: u.papel as PapelUsuario,
      avatar_url: u.avatar_url,
      cor_avatar: u.cor_avatar || '#f97316',
      funcionario_id: u.funcionario_id,
    }))
  } catch (erro) {
    console.error('[Autenticacao] Erro ao listar usuarios por papel:', erro)
    return []
  }
}

/**
 * Chamada à rota de Acessos.
 *
 * As RPCs `criar_usuario_sistema`, `atualizar_senha_usuario` e
 * `salvar_acesso_usuario` são `SECURITY DEFINER` e deixaram de ser executáveis
 * por `anon` na migration `202608150006`. Enquanto estavam abertas, qualquer
 * pessoa com a anon key criava um administrador ou trocava a senha alheia por
 * uma chamada REST — sem passar por tela nenhuma.
 */
const chamarRotaAcessos = async (
  metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  corpo?: Record<string, unknown>,
  query?: string,
): Promise<{ sucesso: boolean; id?: string; erro?: string }> => {
  try {
    const resposta = await fetch(`/api/admin/acessos${query ?? ''}`, {
      method: metodo,
      credentials: 'same-origin',
      ...(corpo
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
        : {}),
    })
    const json = (await resposta.json()) as { sucesso?: boolean; id?: string; erro?: string }

    if (resposta.status === 403) {
      return { sucesso: false, erro: json.erro || 'Seu acesso não inclui esta operação.' }
    }
    if (!resposta.ok || !json.sucesso) {
      return { sucesso: false, erro: json.erro || 'Não foi possível concluir a operação.' }
    }
    return { sucesso: true, id: json.id }
  } catch {
    return { sucesso: false, erro: 'Erro ao conectar com o servidor' }
  }
}

export async function criarUsuarioSistema(dados: {
  nome: string
  nomeUsuario: string
  senha: string
  papel: PapelUsuario
  avatarUrl?: string
  corAvatar?: string
  funcionarioId?: string
  permissoes?: Record<string, boolean>
}): Promise<{ sucesso: boolean; id?: string; erro?: string }> {
  return chamarRotaAcessos('POST', {
    nome: dados.nome,
    nomeUsuario: dados.nomeUsuario,
    senha: dados.senha,
    papel: dados.papel,
    ...(dados.permissoes ? { permissoes: dados.permissoes } : {}),
  })
}

export async function atualizarUsuarioSistema(
  id: string,
  dados: {
    nome?: string
    papel?: PapelUsuario
    avatarUrl?: string | null
    corAvatar?: string
    ativo?: boolean
    funcionarioId?: string | null
    permissoes?: Record<string, boolean>
  }
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    return chamarRotaAcessos('PATCH', {
      id,
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.papel !== undefined ? { papel: dados.papel } : {}),
      ...(dados.avatarUrl !== undefined ? { avatarUrl: dados.avatarUrl } : {}),
      ...(dados.corAvatar !== undefined ? { corAvatar: dados.corAvatar } : {}),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      ...(dados.funcionarioId !== undefined ? { funcionarioId: dados.funcionarioId } : {}),
      ...(dados.permissoes !== undefined ? { permissoes: dados.permissoes } : {}),
    })
  } catch (erro) {
    console.error('[Autenticacao] Erro ao atualizar usuario:', erro)
    return { sucesso: false, erro: 'Erro ao atualizar usuario' }
  }
}

export async function atualizarSenhaUsuario(
  id: string,
  novaSenha: string
): Promise<{ sucesso: boolean; erro?: string }> {
  return chamarRotaAcessos('PUT', { id, senha: novaSenha })
}

export async function excluirUsuarioSistema(
  id: string
): Promise<{ sucesso: boolean; erro?: string }> {
  return chamarRotaAcessos('DELETE', undefined, `?id=${encodeURIComponent(id)}`)
}
