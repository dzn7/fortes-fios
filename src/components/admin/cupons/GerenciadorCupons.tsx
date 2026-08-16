'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgePercent,
  Check,
  Copy,
  Eye,
  EyeOff,
  Gift,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trash2,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase, Produto } from '@/lib/supabase'
import { Cupom, normalizarCodigoCupom, TipoDescontoCupom } from '@/lib/cupons'
import {
  PRESETS_CUPOM,
  VALOR_SIMULACAO_PADRAO,
  aplicarPreset,
  erroDoCampo,
  sugerirCodigo,
  validarFormularioCupom,
  type FormularioCupom,
} from '@/lib/cupom-formulario.mjs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ListaSkeleton, ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { cn } from '@/lib/utils'
import { ResumoCupom } from './ResumoCupom'

/**
 * Cupons.
 *
 * A versão anterior veio de outro sistema: pedia 16 campos que espelhavam
 * colunas do banco, usava `<select>` cru com cor `zinc` fixa fora do design
 * system, oferecia "aplicar em combo" (tabela vazia, rota legada) e não dizia
 * em lugar nenhum o que o cupom faria.
 *
 * O desenho agora parte do que a pessoa quer fazer:
 *   1. escolhe uma receita pronta (10%, R$ 15, frete grátis);
 *   2. confere no painel o efeito em reais;
 *   3. salva.
 * Tudo que não é essencial — pedido mínimo, teto, limites de uso, validade —
 * fica atrás de "Regras avançadas", desligado por padrão.
 *
 * Spec de UI: UI.md §Cupons · domínio testável em `src/lib/cupom-formulario.mjs`
 */

type CupomComMetricas = Cupom & {
  totalDescontoAplicado: number
  totalFreteConcedido: number
  quantidadeUsosConfirmados: number
}

const FORMULARIO_INICIAL: FormularioCupom = {
  codigo: '',
  nome: '',
  descricao: '',
  tipoDesconto: 'percentual',
  valorDesconto: '',
  pedidoMinimo: '',
  limiteDesconto: '',
  aplicaEm: 'pedido',
  produtoId: '',
  usoMaximoTotal: '',
  usoMaximoPorCliente: '',
  validadeFim: '',
  ativo: true,
}

const TIPOS_DESCONTO: {
  valor: TipoDescontoCupom
  rotulo: string
  ajuda: string
  icone: typeof BadgePercent
}[] = [
  {
    valor: 'percentual',
    rotulo: 'Porcentagem',
    ajuda: 'Ex.: 10% do pedido',
    icone: BadgePercent,
  },
  { valor: 'valor_fixo', rotulo: 'Valor fixo', ajuda: 'Ex.: R$ 15 de abatimento', icone: Ticket },
  { valor: 'frete_gratis', rotulo: 'Frete grátis', ajuda: 'O cliente não paga entrega', icone: Truck },
]

const formatarMoeda = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatarData = (valor: string | null) => {
  if (!valor) return null
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return null
  return data.toLocaleDateString('pt-BR')
}

const paraNumero = (valor: string) => {
  const numero = Number(String(valor).replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

const dataParaInput = (valor: string | null) => {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toISOString().slice(0, 10)
}

/** Etiqueta curta do desconto, o que a lista precisa mostrar de relance. */
const rotuloDesconto = (cupom: Cupom) => {
  if (cupom.tipo_desconto === 'frete_gratis') return 'Frete grátis'
  if (cupom.tipo_desconto === 'valor_fixo') return `− ${formatarMoeda(cupom.valor_desconto)}`
  return `− ${cupom.valor_desconto}%`
}

const cupomExpirado = (cupom: Cupom) => {
  if (!cupom.validade_fim) return false
  const fim = new Date(cupom.validade_fim)
  return !Number.isNaN(fim.getTime()) && fim.getTime() < Date.now()
}

export default function GerenciadorCupons() {
  const [cupons, setCupons] = useState<CupomComMetricas[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')

  const [modalAberto, setModalAberto] = useState(false)
  const [idEditando, setIdEditando] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormularioCupom>(FORMULARIO_INICIAL)
  const [mostrarAvancado, setMostrarAvancado] = useState(false)
  const [valorSimulacao, setValorSimulacao] = useState(String(VALOR_SIMULACAO_PADRAO))
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [cupomParaExcluir, setCupomParaExcluir] = useState<CupomComMetricas | null>(null)
  const [codigoCopiado, setCodigoCopiado] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const [respostaCupons, respostaUsos, respostaProdutos] = await Promise.all([
        supabase.from('cupons').select('*').order('created_at', { ascending: false }),
        supabase.from('cupons_usos').select('cupom_id, valor_desconto, valor_frete_descontado'),
        supabase
          .from('produtos')
          .select('id, nome, preco, categoria, disponivel')
          .eq('disponivel', true)
          .order('nome'),
      ])

      if (respostaCupons.error) throw respostaCupons.error
      if (respostaUsos.error) throw respostaUsos.error
      if (respostaProdutos.error) throw respostaProdutos.error

      const metricas = (respostaUsos.data || []).reduce<
        Record<string, { usos: number; desconto: number; frete: number }>
      >((acumulado, uso: Record<string, unknown>) => {
        const id = String(uso.cupom_id)
        const atual = acumulado[id] || { usos: 0, desconto: 0, frete: 0 }
        atual.usos += 1
        atual.desconto += Number(uso.valor_desconto || 0)
        atual.frete += Number(uso.valor_frete_descontado || 0)
        acumulado[id] = atual
        return acumulado
      }, {})

      setCupons(
        (respostaCupons.data || []).map((registro: Record<string, unknown>) => {
          const metrica = metricas[String(registro.id)] || { usos: 0, desconto: 0, frete: 0 }
          return {
            ...registro,
            valor_desconto: Number(registro.valor_desconto || 0),
            pedido_minimo: Number(registro.pedido_minimo || 0),
            limite_desconto:
              registro.limite_desconto === null ? null : Number(registro.limite_desconto),
            uso_maximo_total:
              registro.uso_maximo_total === null ? null : Number(registro.uso_maximo_total),
            uso_maximo_por_cliente:
              registro.uso_maximo_por_cliente === null
                ? null
                : Number(registro.uso_maximo_por_cliente),
            total_usos: Number(registro.total_usos || 0),
            totalDescontoAplicado: metrica.desconto,
            totalFreteConcedido: metrica.frete,
            quantidadeUsosConfirmados: metrica.usos,
          } as CupomComMetricas
        }),
      )
      setProdutos((respostaProdutos.data || []) as Produto[])
    } catch (erro) {
      console.error('[Cupons] Falha ao carregar dados:', erro)
      toast.error('Não foi possível carregar os cupons.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  const erros = useMemo(() => validarFormularioCupom(formulario), [formulario])
  const erroDe = (campo: string) => (tentouSalvar ? erroDoCampo(erros, campo) : null)

  const atualizar = (campos: Partial<FormularioCupom>) => {
    setFormulario((atual) => ({ ...atual, ...campos }))
  }

  /**
   * Trocar o tipo de desconto reescreve o código sugerido — mas só enquanto o
   * código ainda for uma sugestão. Se a pessoa digitou o dela, mandamos ela.
   */
  const trocarTipo = (tipo: TipoDescontoCupom) => {
    setFormulario((atual) => {
      const eraSugestao =
        !atual.codigo || atual.codigo === sugerirCodigo(atual.tipoDesconto, atual.valorDesconto)
      const proximo: FormularioCupom = {
        ...atual,
        tipoDesconto: tipo,
        valorDesconto: tipo === 'frete_gratis' ? '' : atual.valorDesconto,
        limiteDesconto: tipo === 'percentual' ? atual.limiteDesconto : '',
      }
      return eraSugestao
        ? { ...proximo, codigo: sugerirCodigo(tipo, proximo.valorDesconto) }
        : proximo
    })
  }

  const trocarValor = (valor: string) => {
    setFormulario((atual) => {
      const eraSugestao =
        !atual.codigo || atual.codigo === sugerirCodigo(atual.tipoDesconto, atual.valorDesconto)
      const proximo = { ...atual, valorDesconto: valor }
      return eraSugestao
        ? { ...proximo, codigo: sugerirCodigo(atual.tipoDesconto, valor) }
        : proximo
    })
  }

  const abrirNovo = () => {
    setIdEditando(null)
    setFormulario(FORMULARIO_INICIAL)
    setMostrarAvancado(false)
    setTentouSalvar(false)
    setValorSimulacao(String(VALOR_SIMULACAO_PADRAO))
    setModalAberto(true)
  }

  const abrirEdicao = (cupom: CupomComMetricas) => {
    setIdEditando(cupom.id)
    setFormulario({
      codigo: cupom.codigo,
      nome: cupom.nome,
      descricao: cupom.descricao || '',
      tipoDesconto: cupom.tipo_desconto,
      valorDesconto: cupom.valor_desconto ? String(cupom.valor_desconto) : '',
      pedidoMinimo: cupom.pedido_minimo ? String(cupom.pedido_minimo) : '',
      limiteDesconto: cupom.limite_desconto ? String(cupom.limite_desconto) : '',
      // `combo` não existe mais na tela: a tabela está vazia e a rota é legada.
      aplicaEm: cupom.aplica_em === 'produto' ? 'produto' : 'pedido',
      produtoId: cupom.produto_id || '',
      usoMaximoTotal: cupom.uso_maximo_total ? String(cupom.uso_maximo_total) : '',
      usoMaximoPorCliente: cupom.uso_maximo_por_cliente
        ? String(cupom.uso_maximo_por_cliente)
        : '',
      validadeFim: dataParaInput(cupom.validade_fim),
      ativo: cupom.ativo,
    })
    // Abre já expandido quando o cupom usa alguma regra avançada — senão a
    // pessoa edita sem ver o que está configurado.
    setMostrarAvancado(
      Boolean(
        cupom.pedido_minimo ||
          cupom.limite_desconto ||
          cupom.uso_maximo_total ||
          cupom.uso_maximo_por_cliente ||
          cupom.validade_fim ||
          cupom.aplica_em === 'produto',
      ),
    )
    setTentouSalvar(false)
    setValorSimulacao(String(VALOR_SIMULACAO_PADRAO))
    setModalAberto(true)
  }

  const fecharModal = () => {
    if (salvando) return
    setModalAberto(false)
  }

  const salvar = async () => {
    setTentouSalvar(true)
    if (erros.length > 0) {
      toast.warning(erros[0].mensagem)
      return
    }

    setSalvando(true)
    try {
      const payload = {
        codigo: normalizarCodigoCupom(formulario.codigo),
        nome: formulario.nome.trim(),
        descricao: formulario.descricao?.trim() || null,
        ativo: formulario.ativo,
        tipo_desconto: formulario.tipoDesconto,
        valor_desconto:
          formulario.tipoDesconto === 'frete_gratis' ? 0 : paraNumero(formulario.valorDesconto),
        pedido_minimo: paraNumero(formulario.pedidoMinimo),
        limite_desconto: formulario.limiteDesconto ? paraNumero(formulario.limiteDesconto) : null,
        uso_maximo_total: formulario.usoMaximoTotal
          ? Math.round(paraNumero(formulario.usoMaximoTotal))
          : null,
        uso_maximo_por_cliente: formulario.usoMaximoPorCliente
          ? Math.round(paraNumero(formulario.usoMaximoPorCliente))
          : null,
        uso_unico: formulario.usoMaximoPorCliente === '1',
        aplica_em: formulario.aplicaEm,
        produto_id: formulario.aplicaEm === 'produto' ? formulario.produtoId || null : null,
        combo_id: null,
        validade_inicio: null,
        // Vale até o fim do dia escolhido: quem digita 31/12 espera que o dia 31 conte.
        validade_fim: formulario.validadeFim
          ? new Date(`${formulario.validadeFim}T23:59:59`).toISOString()
          : null,
      }

      const resposta = idEditando
        ? await supabase.from('cupons').update(payload).eq('id', idEditando)
        : await supabase.from('cupons').insert(payload)

      if (resposta.error) {
        if (resposta.error.code === '23505') {
          toast.error('Já existe um cupom com esse código.')
          return
        }
        throw resposta.error
      }

      toast.success(idEditando ? 'Cupom atualizado' : 'Cupom criado')
      setModalAberto(false)
      void carregarDados()
    } catch (erro) {
      console.error('[Cupons] Falha ao salvar:', erro)
      toast.error('Não foi possível salvar o cupom.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (cupom: CupomComMetricas) => {
    const { error } = await supabase
      .from('cupons')
      .update({ ativo: !cupom.ativo })
      .eq('id', cupom.id)

    if (error) {
      toast.error('Não foi possível alterar o cupom.')
      return
    }
    toast.success(cupom.ativo ? 'Cupom desativado' : 'Cupom ativado')
    void carregarDados()
  }

  const excluir = async () => {
    if (!cupomParaExcluir) return
    const { error } = await supabase.from('cupons').delete().eq('id', cupomParaExcluir.id)

    if (error) {
      toast.error('Não foi possível excluir o cupom.')
      return
    }
    toast.success('Cupom excluído')
    setCupomParaExcluir(null)
    void carregarDados()
  }

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCodigoCopiado(codigo)
      setTimeout(() => setCodigoCopiado(null), 1600)
    } catch {
      toast.error('Não foi possível copiar o código.')
    }
  }

  const cuponsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return cupons.filter((cupom) => {
      if (filtroStatus === 'ativos' && !cupom.ativo) return false
      if (filtroStatus === 'inativos' && cupom.ativo) return false
      if (!termo) return true
      return (
        cupom.codigo.toLowerCase().includes(termo) || cupom.nome.toLowerCase().includes(termo)
      )
    })
  }, [busca, cupons, filtroStatus])

  const ativos = cupons.filter((cupom) => cupom.ativo).length
  const descontoConcedido = cupons.reduce(
    (soma, cupom) => soma + cupom.totalDescontoAplicado + cupom.totalFreteConcedido,
    0,
  )
  const usosTotais = cupons.reduce((soma, cupom) => soma + cupom.quantidadeUsosConfirmados, 0)

  const acoesDoCupom = (cupom: CupomComMetricas): MenuAcaoItem[] => [
    {
      key: 'editar',
      label: 'Editar',
      icon: <Pencil className="h-4 w-4" />,
      onSelect: () => abrirEdicao(cupom),
    },
    {
      key: 'ativo',
      label: cupom.ativo ? 'Desativar' : 'Ativar',
      icon: cupom.ativo ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      ),
      onSelect: () => void alternarAtivo(cupom),
      variant: cupom.ativo ? 'default' : 'success',
    },
    {
      key: 'excluir',
      label: 'Excluir',
      icon: <Trash2 className="h-4 w-4" />,
      onSelect: () => setCupomParaExcluir(cupom),
      variant: 'destructive',
      separatorBefore: true,
    },
  ]

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Ticket className="h-6 w-6 text-primary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
                Cupons
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {cupons.length === 0
                  ? 'Nenhum cupom criado ainda'
                  : `${ativos} ${ativos === 1 ? 'ativo' : 'ativos'} de ${cupons.length}`}
              </p>
            </div>
          </div>

          <Button onClick={abrirNovo} className="h-11 w-full gap-2 sm:h-9 sm:w-auto">
            <Plus className="h-4 w-4" />
            Criar cupom
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: 'Cupons ativos', valor: String(ativos) },
          { rotulo: 'Vezes usados', valor: String(usosTotais) },
          { rotulo: 'Desconto concedido', valor: formatarMoeda(descontoConcedido) },
        ].map((metrica) => (
          <div
            key={metrica.rotulo}
            className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {metrica.rotulo}
            </p>
            <p className="mt-1.5 truncate text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {metrica.valor}
            </p>
          </div>
        ))}
      </div>

      <section className="min-w-0 space-y-4 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por código ou nome"
              className="h-10 border-border/70 pl-9 shadow-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { valor: 'todos', rotulo: 'Todos' },
                { valor: 'ativos', rotulo: 'Ativos' },
                { valor: 'inativos', rotulo: 'Inativos' },
              ] as const
            ).map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setFiltroStatus(opcao.valor)}
                className={cn(
                  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                  filtroStatus === opcao.valor
                    ? 'border-primary/25 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>

        {carregando ? (
          <ListaSkeleton quantidade={3} />
        ) : cuponsFiltrados.length === 0 ? (
          <ListaVazia
            icone={<Gift className="h-6 w-6" />}
            titulo={cupons.length === 0 ? 'Nenhum cupom ainda' : 'Nada com esses filtros'}
            descricao={
              cupons.length === 0
                ? 'Crie um cupom de desconto para o cliente usar no carrinho.'
                : 'Ajuste a busca ou o status para ver outros cupons.'
            }
            acao={
              cupons.length === 0 ? (
                <Button onClick={abrirNovo} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar o primeiro cupom
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2.5">
            {cuponsFiltrados.map((cupom) => {
              const expirado = cupomExpirado(cupom)
              const validade = formatarData(cupom.validade_fim)

              return (
                <article
                  key={cupom.id}
                  className={cn(
                    'flex min-w-0 flex-col gap-3 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center',
                    cupom.ativo && !expirado
                      ? 'border-border/70 bg-background'
                      : 'border-border/60 bg-muted/30',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                        cupom.ativo && !expirado
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {cupom.tipo_desconto === 'frete_gratis' ? (
                        <Truck strokeWidth={1.8} className="size-5" />
                      ) : (
                        rotuloDesconto(cupom)
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => void copiarCodigo(cupom.codigo)}
                          title="Copiar código"
                          className="inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-foreground transition-colors hover:bg-accent"
                        >
                          {cupom.codigo}
                          {codigoCopiado === cupom.codigo ? (
                            <Check strokeWidth={2.2} className="size-3 text-primary" />
                          ) : (
                            <Copy strokeWidth={1.8} className="size-3 text-muted-foreground" />
                          )}
                        </button>

                        {!cupom.ativo ? (
                          <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Inativo
                          </span>
                        ) : expirado ? (
                          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            Expirado
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 truncate text-sm font-medium text-foreground">
                        {cupom.nome}
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          cupom.pedido_minimo > 0
                            ? `mínimo ${formatarMoeda(cupom.pedido_minimo)}`
                            : null,
                          validade ? `até ${validade}` : null,
                          cupom.quantidadeUsosConfirmados > 0
                            ? `${cupom.quantidadeUsosConfirmados} ${cupom.quantidadeUsosConfirmados === 1 ? 'uso' : 'usos'}`
                            : 'sem uso ainda',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    {cupom.totalDescontoAplicado + cupom.totalFreteConcedido > 0 ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatarMoeda(
                          cupom.totalDescontoAplicado + cupom.totalFreteConcedido,
                        )}{' '}
                        concedidos
                      </span>
                    ) : null}
                    <MenuAcoes
                      ariaLabel={`Ações do cupom ${cupom.codigo}`}
                      items={acoesDoCupom(cupom)}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <Dialog
        open={modalAberto}
        onOpenChange={(aberto) => {
          if (!aberto) fecharModal()
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh] sm:max-w-2xl lg:max-w-4xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              {idEditando ? 'Editar cupom' : 'Criar cupom'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Escolha o desconto e confira o resultado antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {/*
            Duas colunas a partir de `lg`: formulário à esquerda, resumo do
            efeito à direita. No mobile o `Dialog` já vira Drawer e o resumo
            aparece depois do formulário, sem competir com os campos.
          */}
          <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden">
            <div className="space-y-5 px-5 py-4 lg:min-w-0 lg:flex-1 lg:overflow-y-auto">
              {!idEditando ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" aria-hidden />
                    Começar com
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {PRESETS_CUPOM.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFormulario((atual) => aplicarPreset(atual, preset.id))}
                        className="rounded-lg border border-border/70 bg-background p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <p className="text-sm font-medium text-foreground">{preset.rotulo}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {preset.descricao}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Tipo de desconto</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TIPOS_DESCONTO.map((tipo) => {
                    const Icone = tipo.icone
                    const selecionado = formulario.tipoDesconto === tipo.valor
                    return (
                      <button
                        key={tipo.valor}
                        type="button"
                        onClick={() => trocarTipo(tipo.valor)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          selecionado
                            ? 'border-primary/30 bg-primary/[0.06]'
                            : 'border-border/70 bg-background hover:bg-muted/40',
                        )}
                      >
                        <Icone
                          className={cn(
                            'size-4',
                            selecionado ? 'text-primary' : 'text-muted-foreground',
                          )}
                          strokeWidth={1.8}
                        />
                        <p className="mt-1.5 text-sm font-medium text-foreground">{tipo.rotulo}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {tipo.ajuda}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {formulario.tipoDesconto !== 'frete_gratis' ? (
                <div className="space-y-2">
                  <Label htmlFor="cupom-valor">
                    {formulario.tipoDesconto === 'percentual'
                      ? 'Porcentagem de desconto *'
                      : 'Valor do desconto *'}
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {formulario.tipoDesconto === 'percentual' ? '%' : 'R$'}
                    </span>
                    <Input
                      id="cupom-valor"
                      inputMode="decimal"
                      value={formulario.valorDesconto}
                      onChange={(evento) => trocarValor(evento.target.value)}
                      placeholder={formulario.tipoDesconto === 'percentual' ? '10' : '15,00'}
                      className={cn(
                        'h-11 border-border/70 pl-9 shadow-none',
                        erroDe('valorDesconto') && 'border-destructive',
                      )}
                    />
                  </div>
                  {erroDe('valorDesconto') ? (
                    <p className="text-xs text-destructive">{erroDe('valorDesconto')?.mensagem}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cupom-codigo">Código *</Label>
                  <Input
                    id="cupom-codigo"
                    value={formulario.codigo}
                    onChange={(evento) =>
                      atualizar({ codigo: normalizarCodigoCupom(evento.target.value) })
                    }
                    placeholder="DESCONTO10"
                    className={cn(
                      'h-11 border-border/70 font-mono uppercase tracking-wide shadow-none',
                      erroDe('codigo') && 'border-destructive',
                    )}
                  />
                  {erroDe('codigo') ? (
                    <p className="text-xs text-destructive">{erroDe('codigo')?.mensagem}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">É o que o cliente digita.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cupom-nome">Nome interno *</Label>
                  <Input
                    id="cupom-nome"
                    value={formulario.nome}
                    onChange={(evento) => atualizar({ nome: evento.target.value })}
                    placeholder="Desconto de boas-vindas"
                    className={cn(
                      'h-11 border-border/70 shadow-none',
                      erroDe('nome') && 'border-destructive',
                    )}
                  />
                  {erroDe('nome') ? (
                    <p className="text-xs text-destructive">{erroDe('nome')?.mensagem}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Só você vê.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setMostrarAvancado((atual) => !atual)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <SlidersHorizontal className="size-4 text-muted-foreground" strokeWidth={1.8} />
                    Regras avançadas
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {mostrarAvancado ? 'Ocultar' : 'Opcional'}
                  </span>
                </button>

                {mostrarAvancado ? (
                  <div className="space-y-4 border-t border-border/50 p-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="cupom-minimo">Pedido mínimo</Label>
                        <Input
                          id="cupom-minimo"
                          inputMode="decimal"
                          value={formulario.pedidoMinimo}
                          onChange={(evento) => atualizar({ pedidoMinimo: evento.target.value })}
                          placeholder="Sem mínimo"
                          className="h-11 border-border/70 shadow-none"
                        />
                      </div>

                      {formulario.tipoDesconto === 'percentual' ? (
                        <div className="space-y-2">
                          <Label htmlFor="cupom-teto">Desconto máximo</Label>
                          <Input
                            id="cupom-teto"
                            inputMode="decimal"
                            value={formulario.limiteDesconto}
                            onChange={(evento) =>
                              atualizar({ limiteDesconto: evento.target.value })
                            }
                            placeholder="Sem teto"
                            className="h-11 border-border/70 shadow-none"
                          />
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="cupom-validade">Vale até</Label>
                        <Input
                          id="cupom-validade"
                          type="date"
                          value={formulario.validadeFim}
                          onChange={(evento) => atualizar({ validadeFim: evento.target.value })}
                          className={cn(
                            'h-11 border-border/70 shadow-none',
                            erroDe('validadeFim') && 'border-destructive',
                          )}
                        />
                        {erroDe('validadeFim') ? (
                          <p className="text-xs text-destructive">
                            {erroDe('validadeFim')?.mensagem}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cupom-usos">Usos no total</Label>
                        <Input
                          id="cupom-usos"
                          inputMode="numeric"
                          value={formulario.usoMaximoTotal}
                          onChange={(evento) => atualizar({ usoMaximoTotal: evento.target.value })}
                          placeholder="Ilimitado"
                          className="h-11 border-border/70 shadow-none"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="cupom-usos-cliente">Usos por cliente</Label>
                        <Input
                          id="cupom-usos-cliente"
                          inputMode="numeric"
                          value={formulario.usoMaximoPorCliente}
                          onChange={(evento) =>
                            atualizar({ usoMaximoPorCliente: evento.target.value })
                          }
                          placeholder="Ilimitado"
                          className="h-11 border-border/70 shadow-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use 1 para cupom de uso único por pessoa.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-border/50 pt-4">
                      <Label>Onde vale</Label>
                      <Select
                        value={formulario.aplicaEm}
                        onValueChange={(valor) =>
                          atualizar({
                            aplicaEm: valor as FormularioCupom['aplicaEm'],
                            produtoId: valor === 'pedido' ? '' : formulario.produtoId,
                          })
                        }
                      >
                        <SelectTrigger className="h-11 border-border/70 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pedido">No pedido inteiro</SelectItem>
                          <SelectItem value="produto">Em um produto específico</SelectItem>
                        </SelectContent>
                      </Select>

                      {formulario.aplicaEm === 'produto' ? (
                        <div className="space-y-2 pt-2">
                          <Label>Produto *</Label>
                          <Select
                            value={formulario.produtoId}
                            onValueChange={(valor) => atualizar({ produtoId: valor })}
                          >
                            <SelectTrigger
                              className={cn(
                                'h-11 border-border/70 shadow-none',
                                erroDe('produtoId') && 'border-destructive',
                              )}
                            >
                              <SelectValue placeholder="Escolha o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {produtos.map((produto) => (
                                <SelectItem key={produto.id} value={produto.id}>
                                  {produto.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {erroDe('produtoId') ? (
                            <p className="text-xs text-destructive">
                              {erroDe('produtoId')?.mensagem}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Ativo</p>
                  <p className="text-xs text-muted-foreground">Clientes já podem usar</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formulario.ativo}
                  aria-label={formulario.ativo ? 'Desativar cupom' : 'Ativar cupom'}
                  onClick={() => atualizar({ ativo: !formulario.ativo })}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    formulario.ativo ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      formulario.ativo && 'translate-x-5',
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/20 px-5 py-4 lg:w-[20rem] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <ResumoCupom
                formulario={formulario}
                valorPedido={valorSimulacao}
                onValorPedidoChange={setValorSimulacao}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : idEditando ? 'Salvar alterações' : 'Criar cupom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(cupomParaExcluir)}
        onOpenChange={(aberto) => !aberto && setCupomParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              {cupomParaExcluir?.quantidadeUsosConfirmados
                ? `O cupom ${cupomParaExcluir.codigo} já foi usado ${cupomParaExcluir.quantidadeUsosConfirmados}× — o histórico desses pedidos continua, mas o cupom some da lista.`
                : `O cupom ${cupomParaExcluir?.codigo} será removido. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void excluir()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
