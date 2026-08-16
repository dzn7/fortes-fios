'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Quote,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { enviarImagemOriginalParaR2 } from '@/lib/servicoUploadImagem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { cn } from '@/lib/utils'
import {
  CHAVE_DEPOIMENTOS,
  CONFIGURACAO_DEPOIMENTOS_PADRAO,
  FORMATOS_DEPOIMENTO,
  LIMITE_DEPOIMENTOS,
  criarIdDepoimento,
  normalizarConfiguracaoDepoimentos,
  reordenarDepoimentos,
  type ConfiguracaoDepoimentos,
  type Depoimento,
  type FormatoDepoimento,
} from '@/lib/vitrineDepoimentos.mjs'

/**
 * Depoimentos no Admin.
 *
 * Segue o Estúdio na persistência (uma linha JSON em `configuracoes_loja`) e na
 * ideia de ligar/desligar a seção inteira, mas o fluxo de cadastro é mais curto
 * de propósito: **escolher a imagem já cria o item**. Nome e formato são editados
 * direto no card, sem modal — para um print, "abrir modal, preencher, confirmar"
 * é três passos para uma informação que cabe em uma linha.
 *
 * O upload vai para a pasta `depoimentos/`, a única processada por Sharp no
 * servidor com parâmetros que preservam texto (ver `/api/upload`).
 */
/** Mesma razão do componente do site: classe literal, dentro do alcance do JIT. */
const PROPORCAO_MINIATURA: Record<string, string> = {
  vertical: 'aspect-[9/16]',
  horizontal: 'aspect-[16/10]',
}

export function EditorDepoimentos() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDepoimentos>(
    CONFIGURACAO_DEPOIMENTOS_PADRAO,
  )
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const inputArquivoRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_DEPOIMENTOS)
        .maybeSingle()

      setConfiguracao(normalizarConfiguracaoDepoimentos(data?.valor))
    } catch {
      toast.error('Não foi possível carregar os depoimentos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const atualizar = (campos: Partial<ConfiguracaoDepoimentos>) => {
    setConfiguracao((atual) => ({ ...atual, ...campos }))
  }

  const atualizarItem = (id: string, campos: Partial<Depoimento>) => {
    setConfiguracao((atual) => ({
      ...atual,
      depoimentos: atual.depoimentos.map((item) =>
        item.id === id ? { ...item, ...campos } : item,
      ),
    }))
  }

  const salvar = async () => {
    const normalizada = normalizarConfiguracaoDepoimentos(JSON.stringify(configuracao))

    if (normalizada.ativo && !normalizada.depoimentos.some((item) => item.ativo)) {
      toast.warning('Publique ao menos um depoimento antes de ativar a seção.')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_DEPOIMENTOS,
          valor: JSON.stringify(normalizada),
          tipo: 'json',
          descricao: 'Depoimentos de clientes exibidos na vitrine.',
        },
        { onConflict: 'chave' },
      )

      if (error) throw error
      setConfiguracao(normalizada)
      toast.success('Depoimentos atualizados')
    } catch {
      toast.error('Não foi possível salvar os depoimentos.')
    } finally {
      setSalvando(false)
    }
  }

  /** Escolher a imagem já cria o depoimento: é o passo que importa. */
  const adicionarPorArquivo = async (arquivo: File) => {
    if (configuracao.depoimentos.length >= LIMITE_DEPOIMENTOS) {
      toast.warning(`O limite é de ${LIMITE_DEPOIMENTOS} depoimentos.`)
      return
    }

    setEnviando(true)
    try {
      const id = criarIdDepoimento()
      // Sem compactação no cliente: quem comprime é o Sharp, no servidor.
      const resultado = await enviarImagemOriginalParaR2(arquivo, 'depoimentos', id)

      if (!resultado.sucesso || !resultado.url) {
        throw new Error(resultado.erro || 'Falha no upload')
      }

      // Retrato é o caso comum do print de celular, então `vertical` é o
      // palpite certo na maioria das vezes — e continua trocável no card.
      const formatoSugerido: FormatoDepoimento = await new Promise((resolve) => {
        const leitor = new FileReader()
        leitor.onload = () => {
          const imagem = new window.Image()
          imagem.onload = () =>
            resolve(imagem.naturalWidth > imagem.naturalHeight ? 'horizontal' : 'vertical')
          imagem.onerror = () => resolve('vertical')
          imagem.src = String(leitor.result)
        }
        leitor.onerror = () => resolve('vertical')
        leitor.readAsDataURL(arquivo)
      })

      setConfiguracao((atual) => ({
        ...atual,
        depoimentos: [
          ...atual.depoimentos,
          { id, nome: '', imagemUrl: resultado.url as string, formato: formatoSugerido, ativo: true },
        ],
      }))

      toast.success('Depoimento adicionado. Não esqueça de salvar.')
    } catch (erro) {
      console.error('[Depoimentos] Falha no upload:', erro)
      toast.error('Não foi possível enviar a imagem. Tente de novo.')
    } finally {
      setEnviando(false)
      if (inputArquivoRef.current) inputArquivoRef.current.value = ''
    }
  }

  const remover = (id: string) => {
    setConfiguracao((atual) => ({
      ...atual,
      depoimentos: atual.depoimentos.filter((item) => item.id !== id),
    }))
  }

  const mover = (indice: number, direcao: -1 | 1) => {
    setConfiguracao((atual) => ({
      ...atual,
      depoimentos: reordenarDepoimentos(atual.depoimentos, indice, direcao),
    }))
  }

  const publicados = configuracao.depoimentos.filter((item) => item.ativo).length

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg border',
              configuracao.ativo
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-border/70 bg-muted text-muted-foreground',
            )}
          >
            <Quote className="size-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Depoimentos</h2>
              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs font-medium',
                  configuracao.ativo
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border/70 bg-muted/40 text-muted-foreground',
                )}
              >
                {configuracao.ativo ? 'na vitrine' : 'oculta'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {publicados === 0
                ? 'Prints de clientes exibidos na página inicial.'
                : `${publicados} ${publicados === 1 ? 'depoimento publicado' : 'depoimentos publicados'} de ${configuracao.depoimentos.length}.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={configuracao.ativo}
          disabled={carregando}
          onClick={() => atualizar({ ativo: !configuracao.ativo })}
          className={cn(
            'inline-flex h-10 min-w-[140px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
            configuracao.ativo
              ? 'border-border/70 bg-background hover:bg-muted'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400',
          )}
        >
          {configuracao.ativo ? 'Ocultar seção' : 'Mostrar na vitrine'}
        </button>
      </div>

      <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="depoimentos-titulo">Título da seção</Label>
          <Input
            id="depoimentos-titulo"
            value={configuracao.titulo}
            onChange={(evento) => atualizar({ titulo: evento.target.value })}
            className="h-11 border-border/70 shadow-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depoimentos-chamada">Linha de apoio</Label>
          <Input
            id="depoimentos-chamada"
            value={configuracao.chamada}
            onChange={(evento) => atualizar({ chamada: evento.target.value })}
            className="h-11 border-border/70 shadow-none"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Depoimentos</Label>
          <input
            ref={inputArquivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0]
              if (arquivo) void adicionarPorArquivo(arquivo)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            disabled={enviando || configuracao.depoimentos.length >= LIMITE_DEPOIMENTOS}
            onClick={() => inputArquivoRef.current?.click()}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            Adicionar print
          </Button>
        </div>

        {carregando ? (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : configuracao.depoimentos.length === 0 ? (
          <ListaVazia
            icone={<Quote className="size-6" />}
            titulo="Nenhum depoimento ainda"
            descricao="Envie o print de um cliente. O formato é detectado sozinho e você ajusta se precisar."
          />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {configuracao.depoimentos.map((item, indice) => {
              const proporcao = PROPORCAO_MINIATURA[item.formato] ?? PROPORCAO_MINIATURA.vertical

              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex gap-3 rounded-xl border p-3',
                    item.ativo ? 'border-border/70 bg-background' : 'border-border/60 bg-muted/30',
                  )}
                >
                  {/* Miniatura na proporção real: é o preview do que o site fará. */}
                  <div
                    className={cn(
                      'relative w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted',
                      proporcao,
                    )}
                  >
                    <Image
                      src={item.imagemUrl}
                      alt={item.nome || 'Depoimento'}
                      fill
                      sizes="80px"
                      className="object-contain"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Input
                      value={item.nome}
                      onChange={(evento) => atualizarItem(item.id, { nome: evento.target.value })}
                      placeholder="Nome do cliente (opcional)"
                      className="h-9 border-border/70 shadow-none"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {FORMATOS_DEPOIMENTO.map((opcao) => (
                        <button
                          key={opcao.id}
                          type="button"
                          onClick={() => atualizarItem(item.id, { formato: opcao.id })}
                          title={opcao.ajuda}
                          className={cn(
                            'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                            item.formato === opcao.id
                              ? 'border-primary/25 bg-primary/10 text-primary'
                              : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {opcao.rotulo}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => atualizarItem(item.id, { ativo: !item.ativo })}
                        aria-label={item.ativo ? 'Ocultar depoimento' : 'Publicar depoimento'}
                        title={item.ativo ? 'Ocultar' : 'Publicar'}
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {item.ativo ? (
                          <Eye className="size-4" strokeWidth={1.8} />
                        ) : (
                          <EyeOff className="size-4" strokeWidth={1.8} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => mover(indice, -1)}
                        disabled={indice === 0}
                        aria-label="Mover para cima"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                      >
                        <ArrowUp className="size-4" strokeWidth={1.8} />
                      </button>

                      <button
                        type="button"
                        onClick={() => mover(indice, 1)}
                        disabled={indice === configuracao.depoimentos.length - 1}
                        aria-label="Mover para baixo"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                      >
                        <ArrowDown className="size-4" strokeWidth={1.8} />
                      </button>

                      <button
                        type="button"
                        onClick={() => remover(item.id)}
                        aria-label="Remover depoimento"
                        className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button
          type="button"
          className="h-11 w-full sm:h-9 sm:w-auto"
          onClick={() => void salvar()}
          disabled={salvando || carregando}
        >
          {salvando ? 'Salvando…' : 'Salvar depoimentos'}
        </Button>
      </div>
    </div>
  )
}
