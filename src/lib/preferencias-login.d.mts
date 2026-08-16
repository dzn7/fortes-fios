export type LoginLembrado = {
  nomeUsuario: string
  lembrar: boolean
}

export const CHAVE_LOGIN_LEMBRADO: string

export function montarLoginLembrado(entrada: {
  nomeUsuario?: string
  senha?: string
  lembrar?: boolean
}): LoginLembrado

export function lerLoginLembrado(bruto: unknown): LoginLembrado
