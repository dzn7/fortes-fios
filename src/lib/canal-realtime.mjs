/**
 * Nome de tópico para canais do Supabase Realtime.
 *
 * **Por que isto existe.** `RealtimeClient.channel()` não cria um canal novo
 * quando o tópico já existe — ele devolve o que está lá:
 *
 * ```js
 * channel(nome) {
 *   const topico = `realtime:${nome}`
 *   const existente = this.getChannels().find((c) => c.topic === topico)
 *   if (existente) return existente          // ← devolve o de outra assinatura
 *   …
 * }
 * ```
 *
 * E `RealtimeChannel.on()` **lança** ao receber `postgres_changes` num canal
 * que já está `joining` ou `joined`:
 *
 * ```
 * Error: cannot add `postgres_changes` callbacks for realtime:<topico>
 *        after `subscribe()`.
 * ```
 *
 * O padrão `` `algo-${Date.now()}` `` parece resolver isso e não resolve:
 * componentes que assinam no mesmo commit do React leem o **mesmo**
 * milissegundo. Foi o que derrubou a home do site — `page.tsx`, `Header` e
 * `ModalCarrinho` usam `useStatusLoja`, os três montam juntos, e o segundo a
 * chamar `.on()` levantava um erro não capturado que desmontava a árvore.
 *
 * Um contador de módulo não depende da resolução do relógio: cada chamada
 * devolve um número diferente, ponto.
 *
 * Spec: specs/canal-realtime-unico.md
 */

/** Monotônico dentro do bundle. Não precisa sobreviver a reload: o socket também não. */
let sequencia = 0

const PREFIXO_PADRAO = 'canal'

/** Espaço e pontuação viram `-` para o tópico não precisar de escape em log nem em URL. */
const higienizar = (valor) =>
  (typeof valor === 'string' ? valor : '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Tópico único para um canal, com o prefixo legível na frente para o log do
 * Supabase continuar dizendo de quem é o canal.
 *
 * @param {unknown} prefixo
 * @returns {string}
 */
export const topicoUnico = (prefixo) => {
  sequencia += 1
  return `${higienizar(prefixo) || PREFIXO_PADRAO}-${sequencia}`
}
