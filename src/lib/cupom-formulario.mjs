/**
 * Domínio do formulário de cupom.
 *
 * A tela antiga pedia 16 campos que espelhavam colunas do banco
 * (`tipo_desconto`, `limite_desconto`, `uso_maximo_por_cliente`…) e não dizia em
 * lugar nenhum o que o cupom faria. Quem preenchia só descobria o efeito quando
 * um cliente usava.
 *
 * Aqui ficam as três coisas que faltavam, testáveis sem browser:
 *   - **presets**, para o caminho comum ser escolher e salvar;
 *   - **descrição em português** do que o cupom concede;
 *   - **simulação em reais**, para conferir antes de salvar.
 *
 * A validação do checkout continua em `src/lib/cupons.ts` — este módulo é sobre
 * criar o cupom, não sobre aplicá-lo.
 */

/** Pedido de exemplo usado na simulação. Um valor redondo lê melhor que um real. */
export const VALOR_SIMULACAO_PADRAO = 100

const paraNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0
  const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

const arredondar = (valor) => Math.round(valor * 100) / 100

const moeda = (valor) =>
  `R$ ${arredondar(paraNumero(valor)).toFixed(2).replace('.', ',')}`

/**
 * Código derivado do que o cupom faz. Ninguém precisa inventar `PROMO7X` — e um
 * código legível é o que o cliente consegue digitar sem errar.
 *
 * @param {string} tipoDesconto
 * @param {string|number} valorDesconto
 */
export const sugerirCodigo = (tipoDesconto, valorDesconto) => {
  if (tipoDesconto === 'frete_gratis') return 'FRETEGRATIS'

  const valor = paraNumero(valorDesconto)
  if (valor <= 0) return 'DESCONTO'

  const inteiro = Number.isInteger(valor) ? String(valor) : String(Math.round(valor))
  return tipoDesconto === 'valor_fixo' ? `MENOS${inteiro}` : `DESCONTO${inteiro}`
}

/**
 * O que o cupom concede, em uma frase. É o texto que a tela mostra no resumo e
 * o que o administrador confere antes de salvar.
 *
 * @param {Record<string, unknown>} formulario
 */
export const descreverCupom = (formulario) => {
  const dados = formulario || {}
  const valor = paraNumero(dados.valorDesconto)

  let base
  if (dados.tipoDesconto === 'frete_gratis') {
    base = 'frete grátis'
  } else if (dados.tipoDesconto === 'valor_fixo') {
    base = `${moeda(valor)} de desconto`
  } else {
    base = `${arredondar(valor)}% de desconto`
  }

  const partes = [`O cliente ganha ${base}`]

  if (dados.aplicaEm === 'produto') partes.push('no produto escolhido')

  const minimo = paraNumero(dados.pedidoMinimo)
  if (minimo > 0) partes.push(`em pedidos a partir de ${moeda(minimo)}`)

  const teto = paraNumero(dados.limiteDesconto)
  if (teto > 0 && dados.tipoDesconto === 'percentual') {
    partes.push(`limitado a ${moeda(teto)}`)
  }

  return `${partes.join(', ')}.`
}

/**
 * Quanto o cliente economiza num pedido de `valorPedido`.
 *
 * Devolve também o `motivo` — que é o que transforma "não aplicou" em
 * informação acionável em vez de um campo que parece quebrado.
 *
 * @param {Record<string, unknown>} formulario
 * @param {number} valorPedido
 */
export const simularCupom = (formulario, valorPedido = VALOR_SIMULACAO_PADRAO) => {
  const dados = formulario || {}
  const pedido = Math.max(0, paraNumero(valorPedido))
  const minimo = paraNumero(dados.pedidoMinimo)

  if (minimo > 0 && pedido < minimo) {
    return {
      aplicavel: false,
      desconto: 0,
      total: arredondar(pedido),
      motivo: `Este cupom só vale em pedidos de ${moeda(minimo)} ou mais.`,
    }
  }

  if (dados.tipoDesconto === 'frete_gratis') {
    return {
      aplicavel: true,
      desconto: 0,
      total: arredondar(pedido),
      motivo: 'O frete sai de graça; o valor dos produtos não muda.',
    }
  }

  let desconto
  if (dados.tipoDesconto === 'valor_fixo') {
    desconto = paraNumero(dados.valorDesconto)
  } else {
    desconto = (pedido * paraNumero(dados.valorDesconto)) / 100
    const teto = paraNumero(dados.limiteDesconto)
    if (teto > 0) desconto = Math.min(desconto, teto)
  }

  // Desconto nunca passa do próprio pedido: cupom não vira troco.
  desconto = arredondar(Math.min(Math.max(0, desconto), pedido))

  return {
    aplicavel: desconto > 0,
    desconto,
    total: arredondar(pedido - desconto),
    motivo: desconto > 0 ? '' : 'Com este valor de pedido, o desconto sai zerado.',
  }
}

/**
 * Receitas prontas para o caminho comum. Um cupom de 10% é a esmagadora maioria
 * do uso real; obrigar a passar por 16 campos para chegar nele é o que torna a
 * tela difícil.
 */
export const PRESETS_CUPOM = [
  {
    id: 'percentual-10',
    rotulo: '10% de desconto',
    descricao: 'O clássico para atrair primeira compra',
    valores: { tipoDesconto: 'percentual', valorDesconto: '10', nome: 'Desconto de 10%' },
  },
  {
    id: 'valor-15',
    rotulo: 'R$ 15 de desconto',
    descricao: 'Valor fixo, a partir de R$ 80 em compras',
    valores: {
      tipoDesconto: 'valor_fixo',
      valorDesconto: '15',
      pedidoMinimo: '80',
      nome: 'R$ 15 de desconto',
    },
  },
  {
    id: 'frete-gratis',
    rotulo: 'Frete grátis',
    descricao: 'O cliente não paga a entrega',
    valores: { tipoDesconto: 'frete_gratis', valorDesconto: '', nome: 'Frete grátis' },
  },
]

/**
 * @param {Record<string, unknown>} formulario
 * @param {string} idPreset
 */
export const aplicarPreset = (formulario, idPreset) => {
  const preset = PRESETS_CUPOM.find((item) => item.id === idPreset)
  if (!preset) return formulario

  const proximo = { ...formulario, ...preset.valores }
  // O código acompanha o preset: mudar o desconto e manter DESCONTO10 é a
  // receita para o cliente digitar um código que promete outra coisa.
  proximo.codigo = sugerirCodigo(proximo.tipoDesconto, proximo.valorDesconto)
  return proximo
}

const erro = (campo, mensagem) => ({ campo, mensagem })

/**
 * Erros por campo, para a tela marcar o input em vez de disparar um toast por
 * vez e obrigar a descobrir os problemas um a um.
 *
 * @param {Record<string, unknown>} formulario
 */
export const validarFormularioCupom = (formulario) => {
  const dados = formulario || {}
  const erros = []

  const codigo = String(dados.codigo || '').trim()
  if (!codigo) {
    erros.push(erro('codigo', 'Escolha um código para o cliente digitar.'))
  } else if (codigo.length < 3) {
    erros.push(erro('codigo', 'O código precisa de ao menos 3 caracteres.'))
  }

  if (!String(dados.nome || '').trim()) {
    erros.push(erro('nome', 'Dê um nome para você reconhecer este cupom.'))
  }

  if (dados.tipoDesconto !== 'frete_gratis') {
    const valor = paraNumero(dados.valorDesconto)
    if (valor <= 0) {
      erros.push(erro('valorDesconto', 'Informe um desconto maior que zero.'))
    } else if (dados.tipoDesconto === 'percentual' && valor > 100) {
      erros.push(erro('valorDesconto', 'A porcentagem não pode passar de 100%.'))
    }
  }

  if (dados.aplicaEm === 'produto' && !String(dados.produtoId || '').trim()) {
    erros.push(erro('produtoId', 'Escolha o produto que recebe o desconto.'))
  }

  const validade = String(dados.validadeFim || '').trim()
  if (validade) {
    const fim = new Date(`${validade}T23:59:59`)
    if (Number.isNaN(fim.getTime())) {
      erros.push(erro('validadeFim', 'Data inválida.'))
    } else if (fim.getTime() < Date.now()) {
      erros.push(erro('validadeFim', 'Essa data já passou.'))
    }
  }

  for (const campo of ['usoMaximoTotal', 'usoMaximoPorCliente']) {
    const bruto = String(dados[campo] || '').trim()
    if (bruto && paraNumero(bruto) < 1) {
      erros.push(erro(campo, 'Use um número maior que zero, ou deixe em branco.'))
    }
  }

  return erros
}

/**
 * @param {Array<{campo: string, mensagem: string}>} erros
 * @param {string} campo
 */
export const erroDoCampo = (erros, campo) =>
  (Array.isArray(erros) ? erros : []).find((item) => item.campo === campo) || null
