export const DIAS_SEMANA_ENTREGA = [
  { valor: 0, curto: 'Dom', nome: 'domingo', recorrencia: 'aos domingos' },
  { valor: 1, curto: 'Seg', nome: 'segunda-feira', recorrencia: 'toda segunda-feira' },
  { valor: 2, curto: 'Ter', nome: 'terça-feira', recorrencia: 'toda terça-feira' },
  { valor: 3, curto: 'Qua', nome: 'quarta-feira', recorrencia: 'toda quarta-feira' },
  { valor: 4, curto: 'Qui', nome: 'quinta-feira', recorrencia: 'toda quinta-feira' },
  { valor: 5, curto: 'Sex', nome: 'sexta-feira', recorrencia: 'toda sexta-feira' },
  { valor: 6, curto: 'Sáb', nome: 'sábado', recorrencia: 'aos sábados' },
] as const

export type DiaSemanaEntrega = (typeof DIAS_SEMANA_ENTREGA)[number]['valor']

export const TODOS_DIAS_ENTREGA: DiaSemanaEntrega[] = [0, 1, 2, 3, 4, 5, 6]

export const normalizarDiasEntrega = (valor: unknown): DiaSemanaEntrega[] => {
  if (!Array.isArray(valor)) return [...TODOS_DIAS_ENTREGA]
  const dias = Array.from(
    new Set(
      valor
        .map(Number)
        .filter((dia): dia is DiaSemanaEntrega =>
          Number.isInteger(dia) && dia >= 0 && dia <= 6,
        ),
    ),
  ).sort((a, b) => a - b)
  return dias.length > 0 ? dias : [...TODOS_DIAS_ENTREGA]
}

const dataLocalIso = (referencia: Date) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referencia)
  const obter = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value || ''
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}

export const calcularProximaDataEntrega = (
  diasConfigurados: unknown,
  referencia = new Date(),
) => {
  const dias = normalizarDiasEntrega(diasConfigurados)
  const base = new Date(`${dataLocalIso(referencia)}T12:00:00.000Z`)
  for (let acrescimo = 0; acrescimo < 7; acrescimo += 1) {
    const candidata = new Date(base)
    candidata.setUTCDate(base.getUTCDate() + acrescimo)
    if (dias.includes(candidata.getUTCDay() as DiaSemanaEntrega)) {
      return candidata.toISOString().slice(0, 10)
    }
  }
  return base.toISOString().slice(0, 10)
}

export const formatarDataPrevistaEntrega = (dataIso: string) => {
  const data = new Date(`${dataIso}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(data)
}

export const descreverAgendaEntrega = (diasConfigurados: unknown) => {
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
