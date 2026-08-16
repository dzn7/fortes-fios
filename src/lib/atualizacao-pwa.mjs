/**
 * O que fazer quando o service worker troca de controlador.
 *
 * Existe porque a resposta anterior era sempre a mesma — `window.location.reload()`
 * 100 ms depois do `controllerchange` — e era ela que derrubava a primeira visita:
 * `clients.claim()` dispara `controllerchange` numa página que ainda está
 * carregando, e a recarga automática caía em cima do carregamento em curso,
 * atendida por um worker recém-ativado. Daí o sintoma "na entrada falha, no
 * reload manual funciona".
 *
 * A decisão é separada do componente para poder ser testada sem browser
 * (AGENTS §3.4 proíbe teste de browser; a verificação é por código).
 */

export const ACOES_ATUALIZACAO = {
  /** A página aberta já está correta — não mexer nela. */
  IGNORAR: 'ignorar',
  /** Versão nova assumiu: mostrar o aviso e deixar a pessoa escolher. */
  OFERECER: 'oferecer',
  /** A pessoa pediu a atualização; só aqui pode recarregar. */
  RECARREGAR: 'recarregar',
}

/**
 * @param {{ tinhaControlador?: unknown, pedidoPelaPessoa?: unknown }} [entrada]
 * @returns {'ignorar' | 'oferecer' | 'recarregar'}
 */
export const decidirAcaoAoTrocarControlador = (entrada) => {
  const dados = entrada && typeof entrada === 'object' ? entrada : {}

  // Recarregar é consequência de clique, nunca de evento do worker.
  if (dados.pedidoPelaPessoa === true) return ACOES_ATUALIZACAO.RECARREGAR

  // Sem controlador antes = primeira instalação. O HTML e os chunks que a
  // página já carregou são os corretos; recarregar não corrige nada.
  if (dados.tinhaControlador !== true) return ACOES_ATUALIZACAO.IGNORAR

  return ACOES_ATUALIZACAO.OFERECER
}
