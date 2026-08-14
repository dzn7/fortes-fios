import { supabase } from '@/lib/supabase'

type DadosClientePedido = {
  nome: string
  telefone: string
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}

type ClienteRegistrado = {
  id: string
  telefone: string
}

export const normalizarTelefoneCliente = (telefone: string) => telefone.replace(/\D/g, '')

export async function registrarClientePedido({
  nome,
  telefone,
  endereco,
  bairro,
  cidade,
}: DadosClientePedido): Promise<ClienteRegistrado> {
  const telefoneNormalizado = normalizarTelefoneCliente(telefone)
  if (!telefoneNormalizado) {
    throw new Error('Informe o telefone do cliente para salvar o pedido.')
  }

  const agora = new Date().toISOString()
  const dados: Record<string, string | null> = {
    telefone: telefoneNormalizado,
    ultimo_pedido_em: agora,
    updated_at: agora,
  }
  const nomeNormalizado = nome.trim()
  const enderecoNormalizado = endereco?.trim() || ''
  const bairroNormalizado = bairro?.trim() || ''
  const cidadeNormalizada = cidade?.trim() || ''

  if (nomeNormalizado) dados.nome = nomeNormalizado
  if (enderecoNormalizado) dados.endereco = enderecoNormalizado
  if (bairroNormalizado) dados.bairro = bairroNormalizado
  if (cidadeNormalizada) dados.cidade = cidadeNormalizada

  const { data, error } = await supabase
    .from('usuarios_cliente')
    .upsert(dados, { onConflict: 'telefone' })
    .select('id, primeiro_pedido_em')
    .single()

  if (error) throw error

  if (!data.primeiro_pedido_em) {
    const { error: primeiroPedidoError } = await supabase
      .from('usuarios_cliente')
      .update({ primeiro_pedido_em: agora })
      .eq('id', data.id)
      .is('primeiro_pedido_em', null)

    if (primeiroPedidoError) throw primeiroPedidoError
  }

  return { id: data.id as string, telefone: telefoneNormalizado }
}
