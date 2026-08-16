export type AcaoAtualizacao = 'ignorar' | 'oferecer' | 'recarregar'

export const ACOES_ATUALIZACAO: {
  IGNORAR: 'ignorar'
  OFERECER: 'oferecer'
  RECARREGAR: 'recarregar'
}

export function decidirAcaoAoTrocarControlador(entrada?: {
  tinhaControlador?: unknown
  pedidoPelaPessoa?: unknown
}): AcaoAtualizacao
