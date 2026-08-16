/**
 * Agenda e prazo de entrega.
 *
 * O checkout herdou do projeto de restaurante uma estimativa em MINUTOS
 * (`tempo_entrega_estimado = '20-30'`), que não descreve esta loja: aqui a
 * entrega é logística de encomenda, não delivery de comida. A tela dizia
 * "estimada em 20-30 min" antes mesmo de haver cidade escolhida.
 *
 * O modelo certo já existia pela metade — cidade com dias fixos mostra a próxima
 * data. Faltava o outro lado: cidade que entrega **todos os dias** não tem
 * "próxima data" útil (é sempre hoje), e prometer hoje é promessa que a operação
 * não controla. Para essas, e para quando ainda não há cidade escolhida, o texto
 * honesto é um prazo.
 */

export const DIAS_SEMANA_ENTREGA = [
  { valor: 0, curto: 'Dom', nome: 'domingo', recorrencia: 'aos domingos' },
  { valor: 1, curto: 'Seg', nome: 'segunda-feira', recorrencia: 'toda segunda-feira' },
  { valor: 2, curto: 'Ter', nome: 'terça-feira', recorrencia: 'toda terça-feira' },
  { valor: 3, curto: 'Qua', nome: 'quarta-feira', recorrencia: 'toda quarta-feira' },
  { valor: 4, curto: 'Qui', nome: 'quinta-feira', recorrencia: 'toda quinta-feira' },
  { valor: 5, curto: 'Sex', nome: 'sexta-feira', recorrencia: 'toda sexta-feira' },
  { valor: 6, curto: 'Sáb', nome: 'sábado', recorrencia: 'aos sábados' },
]

export const TODOS_DIAS_ENTREGA = [0, 1, 2, 3, 4, 5, 6]

export const normalizarDiasEntrega = (valor) => {
  if (!Array.isArray(valor)) return [...TODOS_DIAS_ENTREGA]
  const dias = Array.from(
    new Set(
      valor
        .map(Number)
        .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6),
    ),
  ).sort((a, b) => a - b)
  return dias.length > 0 ? dias : [...TODOS_DIAS_ENTREGA]
}

const dataLocalIso = (referencia) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referencia)
  const obter = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value || ''
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}

export const calcularProximaDataEntrega = (diasConfigurados, referencia = new Date()) => {
  const dias = normalizarDiasEntrega(diasConfigurados)
  const base = new Date(`${dataLocalIso(referencia)}T12:00:00.000Z`)
  for (let acrescimo = 0; acrescimo < 7; acrescimo += 1) {
    const candidata = new Date(base)
    candidata.setUTCDate(base.getUTCDate() + acrescimo)
    if (dias.includes(candidata.getUTCDay())) {
      return candidata.toISOString().slice(0, 10)
    }
  }
  return base.toISOString().slice(0, 10)
}

export const formatarDataPrevistaEntrega = (dataIso) => {
  const data = new Date(`${dataIso}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(data)
}

export const descreverAgendaEntrega = (diasConfigurados) => {
  const dias = normalizarDiasEntrega(diasConfigurados)
  if (dias.length === 7) return 'Entregas todos os dias'
  if (dias.length === 1) {
    const dia = DIAS_SEMANA_ENTREGA.find((item) => item.valor === dias[0])
    return `Entregas ${dia?.recorrencia || 'uma vez por semana'}`
  }
  const nomes = dias.map(
    (dia) => DIAS_SEMANA_ENTREGA.find((item) => item.valor === dia)?.nome,
  )
  return `Entregas: ${nomes.filter(Boolean).join(', ')}`
}

export const PRAZO_ENTREGA_PADRAO = 'em até 24 horas'

/** @param {unknown} diasConfigurados */
export const entregaTodosOsDias = (diasConfigurados) =>
  normalizarDiasEntrega(diasConfigurados).length === 7

/**
 * Como anunciar o prazo daquela cidade.
 *
 * `ehData` deixa a tela escolher o rótulo: "chega em <data>" lê diferente de
 * "entrega <prazo>", e quem renderiza precisa saber qual dos dois recebeu.
 *
 * @param {unknown} diasConfigurados
 * @param {Date} referencia
 */
export const descreverPrazoEntrega = (diasConfigurados, referencia = new Date()) => {
  // Sem configuração, `normalizarDiasEntrega` devolve a semana inteira — que já
  // é o caso do prazo, então os dois caminhos convergem aqui.
  if (entregaTodosOsDias(diasConfigurados)) {
    return { texto: PRAZO_ENTREGA_PADRAO, ehData: false }
  }

  const data = calcularProximaDataEntrega(diasConfigurados, referencia)
  return { texto: formatarDataPrevistaEntrega(data), ehData: true }
}
