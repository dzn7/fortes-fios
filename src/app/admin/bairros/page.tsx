'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Check, Gift, MapPin, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  DIAS_SEMANA_ENTREGA,
  TODOS_DIAS_ENTREGA,
  descreverAgendaEntrega,
  normalizarDiasEntrega,
  type DiaSemanaEntrega,
} from '@/lib/agenda-entrega'

type Bairro = {
  id: string
  nome: string
  taxa_entrega: number
  valor_minimo_pedido: number
  dias_entrega: DiaSemanaEntrega[]
  ativo: boolean
  entrega_gratis: boolean
  ordem: number
  created_at: string
}

export default function BairrosPage() {
  const router = useRouter()
  const [bairros, setBairros] = useState<Bairro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [novaTaxa, setNovaTaxa] = useState('')
  const [novoValorMinimo, setNovoValorMinimo] = useState('70')
  const [novosDiasEntrega, setNovosDiasEntrega] = useState<DiaSemanaEntrega[]>([...TODOS_DIAS_ENTREGA])
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [bairroParaExcluir, setBairroParaExcluir] = useState<string | null>(null)

  useEffect(() => {
    void carregarBairros()

    const channel = supabase
      .channel('bairros-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bairros' },
        () => {
          void carregarBairros()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  async function carregarBairros() {
    try {
      const { data, error } = await supabase
        .from('bairros')
        .select('*')
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setBairros(
        (data || []).map((bairro) => ({
          ...bairro,
          taxa_entrega: Number(bairro.taxa_entrega || 0),
          valor_minimo_pedido: Number(bairro.valor_minimo_pedido || 0),
          ordem: Number(bairro.ordem || 0),
          dias_entrega: normalizarDiasEntrega(bairro.dias_entrega),
          entrega_gratis: Boolean(bairro.entrega_gratis),
          ativo: bairro.ativo !== false,
        })),
      )
    } catch (error) {
      console.error('Erro ao carregar bairros:', error)
    } finally {
      setCarregando(false)
    }
  }

  async function criarBairro() {
    if (!novoNome.trim() || !novaTaxa || !novoValorMinimo) return

    setSalvando(true)
    try {
      const { error } = await supabase.from('bairros').insert({
        nome: novoNome.trim(),
        taxa_entrega: parseFloat(novaTaxa),
        valor_minimo_pedido: parseFloat(novoValorMinimo),
        dias_entrega: novosDiasEntrega,
        ativo: true,
        ordem: bairros.length + 1,
      })

      if (error) throw error

      setNovoNome('')
      setNovaTaxa('')
      setNovoValorMinimo('70')
      setNovosDiasEntrega([...TODOS_DIAS_ENTREGA])
      setMostrarFormNovo(false)
      toast.success('Cidade criada')
    } catch (error) {
      console.error('Erro ao criar cidade:', error)
      toast.error('Erro ao criar cidade. Verifique se o nome já existe.')
    } finally {
      setSalvando(false)
    }
  }

  async function atualizarBairro(id: string, nome: string, taxa: number, valorMinimo: number, diasEntrega: DiaSemanaEntrega[]) {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('bairros')
        .update({ nome, taxa_entrega: taxa, valor_minimo_pedido: valorMinimo, dias_entrega: diasEntrega })
        .eq('id', id)

      if (error) throw error
      setEditandoId(null)
      toast.success('Cidade atualizada')
    } catch (error) {
      console.error('Erro ao atualizar cidade:', error)
      toast.error('Erro ao atualizar cidade.')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(bairro: Bairro) {
    try {
      const { error } = await supabase
        .from('bairros')
        .update({ ativo: !bairro.ativo })
        .eq('id', bairro.id)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao alternar status:', error)
      toast.error('Erro ao alterar status.')
    }
  }

  async function alternarEntregaGratis(bairro: Bairro) {
    try {
      const { error } = await supabase
        .from('bairros')
        .update({ entrega_gratis: !bairro.entrega_gratis })
        .eq('id', bairro.id)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao alternar entrega grátis:', error)
      toast.error('Erro ao alterar entrega grátis.')
    }
  }

  async function excluirBairroConfirmado(id: string) {
    try {
      const { error } = await supabase.from('bairros').delete().eq('id', id)
      if (error) throw error
      toast.success('Cidade excluída')
    } catch (error) {
      console.error('Erro ao excluir cidade:', error)
      toast.error('Erro ao excluir cidade.')
    } finally {
      setBairroParaExcluir(null)
    }
  }

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <MapPin className="size-5 text-primary" />
              Cidades de entrega
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Taxa, compra mínima e dias de entrega · {bairros.length} cadastrada
              {bairros.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 flex-1 shadow-none sm:flex-none"
              onClick={() => router.push('/admin/pedidos?configuracoes=entrega')}
            >
              <Settings className="mr-2 size-4" />
              Prazos e mínimos
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 flex-1 shadow-none sm:flex-none"
              onClick={() => setMostrarFormNovo(true)}
            >
              <Plus className="mr-2 size-4" />
              Nova cidade
            </Button>
          </div>
        </div>

        {mostrarFormNovo && (
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-foreground">Adicionar cidade</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="bairro-novo-nome" className="text-xs text-muted-foreground">
                  Nome
                </Label>
                <Input
                  id="bairro-novo-nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex.: Porto - PI"
                  className="h-10 border-border/70 shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade-novo-minimo" className="text-xs text-muted-foreground">
                  Compra mínima (R$)
                </Label>
                <Input
                  id="cidade-novo-minimo"
                  type="number"
                  step="0.50"
                  min="0"
                  value={novoValorMinimo}
                  onChange={(e) => setNovoValorMinimo(e.target.value)}
                  placeholder="70,00"
                  className="h-10 border-border/70 shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro-nova-taxa" className="text-xs text-muted-foreground">
                  Taxa (R$)
                </Label>
                <Input
                  id="bairro-nova-taxa"
                  type="number"
                  step="0.50"
                  min="0"
                  value={novaTaxa}
                  onChange={(e) => setNovaTaxa(e.target.value)}
                  placeholder="0,00"
                  className="h-10 border-border/70 shadow-none"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  className="h-10 flex-1 shadow-none sm:flex-none"
                  onClick={() => void criarBairro()}
                  disabled={salvando || !novoNome.trim() || !novaTaxa || !novoValorMinimo || novosDiasEntrega.length === 0}
                >
                  <Check className="mr-2 size-4" />
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shadow-none"
                  onClick={() => {
                    setMostrarFormNovo(false)
                    setNovoNome('')
                    setNovaTaxa('')
                    setNovoValorMinimo('70')
                    setNovosDiasEntrega([...TODOS_DIAS_ENTREGA])
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-border/60 pt-4">
              <SeletorDiasEntrega value={novosDiasEntrega} onChange={setNovosDiasEntrega} />
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          {carregando ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando cidades...</div>
          ) : bairros.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <MapPin className="size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Nenhuma cidade cadastrada</p>
              <p className="text-sm text-muted-foreground">Clique em “Nova cidade” para começar.</p>
            </div>
          ) : (
            <>
              <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[minmax(0,1.4fr)_7rem_8rem_6.5rem_5rem_7rem] md:gap-3">
                <span>Cidade</span>
                <span className="text-center">Compra mínima</span>
                <span className="text-center">Taxa</span>
                <span className="text-center">Grátis</span>
                <span className="text-center">Status</span>
                <span className="text-right">Ações</span>
              </div>

              <div className="divide-y divide-border/60">
                {bairros.map((bairro) => (
                  <BairroItem
                    key={bairro.id}
                    bairro={bairro}
                    editando={editandoId === bairro.id}
                    onEditar={() => setEditandoId(bairro.id)}
                    onCancelar={() => setEditandoId(null)}
                    onSalvar={(nome, taxa, valorMinimo, diasEntrega) => void atualizarBairro(bairro.id, nome, taxa, valorMinimo, diasEntrega)}
                    onAlternarAtivo={() => void alternarAtivo(bairro)}
                    onAlternarEntregaGratis={() => void alternarEntregaGratis(bairro)}
                    onExcluir={() => setBairroParaExcluir(bairro.id)}
                    formatarMoeda={formatarMoeda}
                    salvando={salvando}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <p className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Cidades inativas não aparecem no checkout. A previsão usa o próximo dia marcado, inclusive hoje quando houver entrega.
        </p>
      </div>

      <Dialog open={Boolean(bairroParaExcluir)} onOpenChange={(open) => !open && setBairroParaExcluir(null)}>
        <DialogContent className="rounded-xl border-border/70 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir cidade</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta cidade? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" className="h-9 shadow-none" onClick={() => setBairroParaExcluir(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 shadow-none"
              onClick={() => bairroParaExcluir && void excluirBairroConfirmado(bairroParaExcluir)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

type BairroItemProps = {
  bairro: Bairro
  editando: boolean
  onEditar: () => void
  onCancelar: () => void
  onSalvar: (nome: string, taxa: number, valorMinimo: number, diasEntrega: DiaSemanaEntrega[]) => void
  onAlternarAtivo: () => void
  onAlternarEntregaGratis: () => void
  onExcluir: () => void
  formatarMoeda: (valor: number) => string
  salvando: boolean
}

function BairroItem({
  bairro,
  editando,
  onEditar,
  onCancelar,
  onSalvar,
  onAlternarAtivo,
  onAlternarEntregaGratis,
  onExcluir,
  formatarMoeda,
  salvando,
}: BairroItemProps) {
  const [nome, setNome] = useState(bairro.nome)
  const [taxa, setTaxa] = useState(bairro.taxa_entrega.toString())
  const [valorMinimo, setValorMinimo] = useState(bairro.valor_minimo_pedido.toString())
  const [diasEntrega, setDiasEntrega] = useState<DiaSemanaEntrega[]>(bairro.dias_entrega)

  useEffect(() => {
    if (editando) {
      setNome(bairro.nome)
      setTaxa(bairro.taxa_entrega.toString())
      setValorMinimo(bairro.valor_minimo_pedido.toString())
      setDiasEntrega(bairro.dias_entrega)
    }
  }, [editando, bairro])

  if (editando) {
    return (
      <div className="space-y-3 bg-primary/5 px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_7rem_8rem_6.5rem_5rem_7rem] md:items-center md:gap-3">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="h-10 border-border/70 shadow-none"
          autoFocus
          aria-label="Nome da cidade"
        />
        <Input
          type="number"
          step="0.50"
          min="0"
          value={valorMinimo}
          onChange={(e) => setValorMinimo(e.target.value)}
          className="h-10 border-border/70 text-center shadow-none"
          aria-label="Compra mínima"
        />
        <Input
          type="number"
          step="0.50"
          min="0"
          value={taxa}
          onChange={(e) => setTaxa(e.target.value)}
          className="h-10 border-border/70 text-center shadow-none"
          aria-label="Taxa de entrega"
        />
        <div className="hidden md:block" />
        <div className="hidden md:block" />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="icon"
            className="size-9 shadow-none"
            disabled={salvando || !nome.trim() || !taxa || !valorMinimo || diasEntrega.length === 0}
            onClick={() => onSalvar(nome, parseFloat(taxa), parseFloat(valorMinimo), diasEntrega)}
            aria-label="Salvar"
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shadow-none"
            onClick={onCancelar}
            aria-label="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </div>
        </div>
        <SeletorDiasEntrega value={diasEntrega} onChange={setDiasEntrega} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_7rem_8rem_6.5rem_5rem_7rem] md:gap-3',
        !bairro.ativo && 'opacity-60',
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{bairro.nome}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {descreverAgendaEntrega(bairro.dias_entrega)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
          <Badge
            variant="outline"
            className={cn(
              'rounded-md shadow-none',
              bairro.entrega_gratis
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {bairro.entrega_gratis ? 'Grátis' : formatarMoeda(bairro.taxa_entrega)}
          </Badge>
          <Badge variant="outline" className="rounded-md border-border/70 bg-muted/40 shadow-none">
            Mín. {formatarMoeda(bairro.valor_minimo_pedido)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'rounded-md shadow-none',
              bairro.ativo
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border/70 bg-muted text-muted-foreground',
            )}
          >
            {bairro.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <div className="hidden justify-center md:flex">
        <span className="inline-flex rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground">
          {formatarMoeda(bairro.valor_minimo_pedido)}
        </span>
      </div>

      <div className="hidden justify-center md:flex">
        <span
          className={cn(
            'inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold tabular-nums',
            bairro.entrega_gratis
              ? 'border-border/70 bg-muted text-muted-foreground line-through'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {formatarMoeda(bairro.taxa_entrega)}
        </span>
      </div>

      <div className="hidden items-center justify-center md:flex">
        <button
          type="button"
          onClick={onAlternarEntregaGratis}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-pressed={Boolean(bairro.entrega_gratis)}
          aria-label={bairro.entrega_gratis ? 'Desativar entrega grátis' : 'Ativar entrega grátis'}
        >
          <span
            className={cn(
              'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
              bairro.entrega_gratis ? 'justify-end bg-primary' : 'justify-start bg-muted-foreground/30',
            )}
          >
            <span className="size-4 rounded-full bg-background shadow-sm" />
          </span>
          {bairro.entrega_gratis ? <Gift className="size-3.5 text-primary" /> : null}
        </button>
      </div>

      <div className="hidden justify-center md:flex">
        <button
          type="button"
          onClick={onAlternarAtivo}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            bairro.ativo
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border/70 bg-muted text-muted-foreground',
          )}
        >
          {bairro.ativo ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shadow-none md:hidden"
          onClick={onAlternarEntregaGratis}
        >
          <Gift className="mr-1.5 size-3.5" />
          {bairro.entrega_gratis ? 'Grátis' : 'Taxa'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shadow-none md:hidden"
          onClick={onAlternarAtivo}
        >
          {bairro.ativo ? 'Ativo' : 'Inativo'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          onClick={onEditar}
          aria-label="Editar cidade"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-destructive hover:text-destructive"
          onClick={onExcluir}
          aria-label="Excluir cidade"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function SeletorDiasEntrega({
  value,
  onChange,
}: {
  value: DiaSemanaEntrega[]
  onChange: (dias: DiaSemanaEntrega[]) => void
}) {
  const alternarDia = (dia: DiaSemanaEntrega) => {
    onChange(
      value.includes(dia)
        ? value.filter((item) => item !== dia)
        : [...value, dia].sort((a, b) => a - b),
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">
        Dias de entrega
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DIAS_SEMANA_ENTREGA.map((dia) => {
          const selecionado = value.includes(dia.valor)
          return (
            <button
              key={dia.valor}
              type="button"
              aria-pressed={selecionado}
              onClick={() => alternarDia(dia.valor)}
              className={cn(
                'min-h-10 rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selecionado
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {dia.curto}
            </button>
          )
        })}
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-destructive">Selecione ao menos um dia.</p>
      ) : (
        <p className="text-xs text-muted-foreground">{descreverAgendaEntrega(value)}</p>
      )}
    </fieldset>
  )
}
