/**
 * Consulta de pedidos pelo cliente — apresentação.
 *
 * A tela chamava `format(new Date(pedido.created_at), …)` do date-fns direto no
 * JSX. `format` **lança** `RangeError` com data inválida, e um throw durante o
 * render derruba a árvore inteira do React: a página fica em branco/preta em
 * vez de mostrar um pedido com data faltando.
 *
 * O construtor `Date` também diverge entre navegadores: `2026-08-16 13:38:03+00`
 * (formato do Postgres, com espaço no lugar do `T`) é aceito pelo Chrome e
 * recusado pelo WebKit. Hoje o PostgREST devolve ISO com `T` — mas depender
 * disso é apostar que nenhuma consulta futura devolva o outro formato.
 *
 * Aqui nada lança. Data ruim vira texto; linha ruim é descartada.
 */

export const STATUS_PEDIDO_CLIENTE = [
  'pendente',
  'aguardando_pagamento',
  'confirmado',
  'preparando',
  'pronto',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
]

const APARENCIAS = {
  pendente: { rotulo: 'Pendente', classe: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  aguardando_pagamento: { rotulo: 'Aguardando pagamento', classe: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  confirmado: { rotulo: 'Confirmado', classe: 'border-primary/30 bg-primary/10 text-primary' },
  preparando: { rotulo: 'Preparando', classe: 'border-primary/30 bg-primary/10 text-primary' },
  pronto: { rotulo: 'Pronto', classe: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  saiu_para_entrega: { rotulo: 'Saiu para entrega', classe: 'border-primary/30 bg-primary/10 text-primary' },
  entregue: { rotulo: 'Entregue', classe: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  cancelado: { rotulo: 'Cancelado', classe: 'border-destructive/30 bg-destructive/10 text-destructive' },
}

const APARENCIA_PADRAO = {
  rotulo: 'Em andamento',
  classe: 'border-border/70 bg-muted/50 text-muted-foreground',
}

/** @param {unknown} status */
export const aparenciaStatusPedido = (status) => {
  const chave = String(status || '').trim().toLowerCase()
  return APARENCIAS[chave] || APARENCIA_PADRAO
}

/**
 * Aceita ISO e o formato do Postgres com espaço. Devolve `null` quando não dá
 * para confiar, em vez de um `Date` inválido que estoura mais adiante.
 *
 * @param {unknown} valor
 */
const paraData = (valor) => {
  if (typeof valor !== 'string' || !valor.trim()) return null

  const candidatos = [valor, valor.replace(' ', 'T')]
  for (const candidato of candidatos) {
    const data = new Date(candidato)
    if (!Number.isNaN(data.getTime())) return data
  }
  return null
}

/** @param {unknown} valor */
export const formatarDataPedido = (valor) => {
  const data = paraData(valor)
  if (!data) return 'Data indisponível'

  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const hora = String(data.getHours()).padStart(2, '0')
  const minuto = String(data.getMinutes()).padStart(2, '0')

  return `${dia}/${mes}/${data.getFullYear()} às ${hora}:${minuto}`
}

const paraNumero = (valor) => {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

/**
 * Linha da RPC → objeto seguro para a tela. Sem `id` não há pedido: descartar
 * é melhor que renderizar um item fantasma sem chave estável.
 *
 * @param {Record<string, unknown>|null} bruto
 */
export const normalizarPedidoConsulta = (bruto) => {
  if (!bruto || typeof bruto !== 'object') return null
  if (typeof bruto.id !== 'string' || !bruto.id) return null

  return {
    id: bruto.id,
    numeroExibicao: bruto.numero_pedido ? `#${bruto.numero_pedido}` : 'sem número',
    nomeCliente: typeof bruto.nome_cliente === 'string' ? bruto.nome_cliente : '',
    telefone: typeof bruto.telefone === 'string' ? bruto.telefone : '',
    status: typeof bruto.status === 'string' ? bruto.status : null,
    tipoEntrega: typeof bruto.tipo_entrega === 'string' ? bruto.tipo_entrega : '',
    formaPagamento: typeof bruto.forma_pagamento === 'string' ? bruto.forma_pagamento : '',
    total: Math.max(0, paraNumero(bruto.total)),
    criadoEm: typeof bruto.created_at === 'string' ? bruto.created_at : null,
    observacoes: typeof bruto.observacoes === 'string' ? bruto.observacoes : '',
  }
}

/** Menor telefone plausível: DDD + 8 dígitos. */
export const telefoneEhConsultavel = (telefone) =>
  typeof telefone === 'string' && telefone.replace(/\D/g, '').length >= 10
