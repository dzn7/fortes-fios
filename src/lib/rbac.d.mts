export type PapelAdmin = 'admin' | 'atendente'
export type Sensibilidade = 'operacional' | 'estrategica' | 'critica'

export type AcaoModulo = {
  id: string
  rotulo: string
  sensibilidade: Sensibilidade
}

export type ModuloAdmin = {
  id: string
  nome: string
  rota: string
  acoes: AcaoModulo[]
}

export type PermissoesAdmin = Record<string, boolean>

export type UsuarioParaPermissoes = {
  id?: string
  papel?: string
  ativo?: boolean
  permissoes?: unknown
}

export const PAPEIS: { ADMIN: 'admin'; ATENDENTE: 'atendente' }
export const PAPEIS_ADMIN: PapelAdmin[]
export const PAPEIS_VALIDOS: string[]
export const SENSIBILIDADES: {
  OPERACIONAL: 'operacional'
  ESTRATEGICA: 'estrategica'
  CRITICA: 'critica'
}

export const MODULOS_ADMIN: ModuloAdmin[]
export const CHAVES_RBAC: string[]
export const PRESET_ATENDENTE: Readonly<PermissoesAdmin>
export const PRESETS_POR_PAPEL: Record<string, Readonly<PermissoesAdmin>>

export function chave(modulo: string, acao: string): string
export function permissoesTotais(): PermissoesAdmin
export function normalizarPermissoes(valor: unknown): PermissoesAdmin
export function resolverPermissoes(usuario: UsuarioParaPermissoes | null): PermissoesAdmin
export function podeExecutar(permissoes: PermissoesAdmin | null | undefined, item: string): boolean
export function permissaoDaRota(rota: string): string | null
export function podeVerRota(rota: string, permissoes: PermissoesAdmin): boolean
export function podeEditarPermissoesDe(
  ator: { id?: string; permissoes?: PermissoesAdmin },
  alvo: { id?: string },
): boolean
