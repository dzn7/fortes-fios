export type TipoDescontoFormulario = 'percentual' | 'valor_fixo' | 'frete_gratis'
export type TipoAplicacaoFormulario = 'pedido' | 'produto'

export type FormularioCupom = {
  codigo: string
  nome: string
  descricao?: string
  tipoDesconto: TipoDescontoFormulario
  valorDesconto: string
  pedidoMinimo: string
  limiteDesconto: string
  aplicaEm: TipoAplicacaoFormulario
  produtoId: string
  usoMaximoTotal: string
  usoMaximoPorCliente: string
  validadeFim: string
  ativo: boolean
}

export type ErroCampoCupom = { campo: string; mensagem: string }

export type SimulacaoCupom = {
  aplicavel: boolean
  desconto: number
  total: number
  motivo: string
}

export type PresetCupom = {
  id: string
  rotulo: string
  descricao: string
  valores: Partial<FormularioCupom>
}

export const VALOR_SIMULACAO_PADRAO: number
export const PRESETS_CUPOM: PresetCupom[]

export function sugerirCodigo(
  tipoDesconto: TipoDescontoFormulario,
  valorDesconto: string | number,
): string

export function descreverCupom(formulario: Partial<FormularioCupom>): string

export function simularCupom(
  formulario: Partial<FormularioCupom>,
  valorPedido?: number,
): SimulacaoCupom

export function aplicarPreset<T extends Partial<FormularioCupom>>(
  formulario: T,
  idPreset: string,
): T

export function validarFormularioCupom(
  formulario: Partial<FormularioCupom>,
): ErroCampoCupom[]

export function erroDoCampo(erros: ErroCampoCupom[], campo: string): ErroCampoCupom | null
