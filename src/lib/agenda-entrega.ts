/**
 * Reexport tipado de `agenda-entrega.mjs`.
 *
 * A lógica mora no `.mjs` para ser testável por `node --test` sem transpilação,
 * como os demais módulos de domínio do projeto. Este arquivo existe só para os
 * call sites em TypeScript continuarem importando de `@/lib/agenda-entrega`.
 */
export {
  DIAS_SEMANA_ENTREGA,
  TODOS_DIAS_ENTREGA,
  PRAZO_ENTREGA_PADRAO,
  normalizarDiasEntrega,
  calcularProximaDataEntrega,
  formatarDataPrevistaEntrega,
  descreverAgendaEntrega,
  descreverPrazoEntrega,
  entregaTodosOsDias,
} from './agenda-entrega.mjs'

export type { DiaSemanaEntrega, PrazoEntrega } from './agenda-entrega.mjs'
