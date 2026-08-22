/**
 * Slot vazio do `@modal`.
 *
 * Rota paralela exige um `default` para as navegações em que o slot não tem
 * conteúdo — sem ele, qualquer rota fora de `/produto/[slug]` quebraria.
 */
export default function SemModal() {
  return null
}
