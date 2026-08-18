import type { PermissoesAdmin } from '../rbac.mjs'

export type PerfilDesenvolvedor = {
  id: string
  nome: string
  nomeUsuario: string
  papel: string
  avatarUrl: string | null
  corAvatar: string
  permissoes: PermissoesAdmin
  permissoesVersao: number
}

export const USUARIO_DESENVOLVEDOR: string
export const ID_DESENVOLVEDOR: string
export const VERSAO_PERMISSOES_DESENVOLVEDOR: number

export function ehCredencialDesenvolvedor(nomeUsuario: unknown, senha: unknown): boolean
export function perfilDesenvolvedor(): PerfilDesenvolvedor
export function ehDesenvolvedor(id: unknown): boolean
export function idAtorParaAuditoria(id: string): string | null
