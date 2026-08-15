export const CHAVE_ROTULO_CATEGORIA_TODOS = 'rotulo_categoria_todos'
export const ROTULO_CATEGORIA_TODOS_PADRAO = 'Todos os tipos de cabelo'

export function normalizarRotuloCategoriaTodos(valor) {
  const rotulo = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : ''
  return rotulo || ROTULO_CATEGORIA_TODOS_PADRAO
}
