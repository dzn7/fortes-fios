/**
 * Ações do Admin que passam por autorização no servidor.
 *
 * Toda escrita sensível do Admin deve vir por aqui em vez de falar direto com o
 * Supabase pelo cliente. O motivo é concreto: um atendente sem `pedidos.excluir`
 * conseguia excluir pedido, porque a tela escrevia com a anon key e ninguém
 * checava permissão.
 *
 * Um 403 vira mensagem de permissão, não "erro ao salvar" — a pessoa precisa
 * entender que faltou autorização, não que o sistema falhou.
 *
 * Spec: specs/rbac-admin.md §7
 */

export type ResultadoAcao = { sucesso: boolean; erro?: string; dados?: Record<string, unknown> }

const chamar = async (
  url: string,
  metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  corpo?: unknown,
): Promise<ResultadoAcao> => {
  try {
    const resposta = await fetch(url, {
      method: metodo,
      credentials: 'same-origin',
      ...(corpo === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    })

    const json = (await resposta.json().catch(() => ({}))) as {
      sucesso?: boolean
      erro?: string
    } & Record<string, unknown>

    if (resposta.status === 401) {
      return { sucesso: false, erro: 'Sua sessão expirou. Entre novamente.' }
    }
    if (resposta.status === 403) {
      return { sucesso: false, erro: json.erro || 'Seu acesso não inclui esta operação.' }
    }
    if (!resposta.ok || !json.sucesso) {
      return { sucesso: false, erro: json.erro || 'Não foi possível concluir a operação.' }
    }
    return { sucesso: true, dados: json }
  } catch {
    return { sucesso: false, erro: 'Erro ao conectar com o servidor' }
  }
}

/** Exige `pedidos.excluir`. */
export const excluirPedidos = (ids: string | string[]): Promise<ResultadoAcao> =>
  chamar('/api/admin/pedidos', 'DELETE', { ids: Array.isArray(ids) ? ids : [ids] })

/** Exige `pedidos.cancelar` quando o destino é `cancelado`, senão `pedidos.mudar_status`. */
export const atualizarStatusPedidos = (
  ids: string | string[],
  status: string,
): Promise<ResultadoAcao> =>
  chamar('/api/admin/pedidos', 'PATCH', {
    ids: Array.isArray(ids) ? ids : [ids],
    status,
  })

/** Exige `estoque.ajustar`. Devolve a quantidade confirmada pelo banco. */
export const ajustarEstoque = async (
  produtoId: string,
  operacao: { delta: number } | { quantidade: number },
): Promise<ResultadoAcao & { quantidade?: number }> => {
  const resultado = await chamar('/api/admin/estoque', 'PATCH', { produtoId, ...operacao })
  const quantidade = resultado.dados?.quantidade
  return { ...resultado, quantidade: typeof quantidade === 'number' ? quantidade : undefined }
}

/** Exige `produtos.criar` / `.editar` / `.excluir` conforme o método. */
export const salvarProduto = (dados: Record<string, unknown>): Promise<ResultadoAcao> =>
  chamar('/api/admin/produtos', dados.id ? 'PATCH' : 'POST', dados)

export const excluirProduto = (id: string): Promise<ResultadoAcao> =>
  chamar(`/api/admin/produtos?id=${encodeURIComponent(id)}`, 'DELETE')
