export type CargaSessao = {
  usuarioId: string
  papel: string
  versao: number
  exp: number
}

export const DURACAO_SESSAO_SEGUNDOS: number

export function assinarSessao(
  carga: { usuarioId: string; papel: string; versao: number },
  segredo: string,
  agoraSegundos?: number,
): string

export function verificarSessao(
  token: unknown,
  segredo: string,
  agoraSegundos?: number,
): CargaSessao | null
