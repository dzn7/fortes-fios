'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  Crop,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import ModalRecorteImagem from '@/components/admin/ModalRecorteImagem'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { uploadImagemB2 } from '@/lib/backblaze'
import { arquivoParaUrl, validarArquivoImagem } from '@/lib/recorteImagem'
import {
  CHAVE_RESULTADOS_STUDIO,
  CONFIGURACAO_RESULTADOS_STUDIO_PADRAO,
  ConfiguracaoResultadosStudio,
  criarIdResultadoStudio,
  normalizarConfiguracaoResultadosStudio,
  ResultadoStudio,
} from '@/lib/vitrineResultadosStudio'

type FormularioResultado = Omit<ResultadoStudio, 'id'>

const FORMULARIO_VAZIO: FormularioResultado = {
  imagemUrl: '',
  titulo: '',
  descricao: '',
  ativo: true,
}

const obterUrlEditavel = (url: string) => {
  const urlPublica = process.env.NEXT_PUBLIC_B2_PUBLIC_URL
  if (!urlPublica || !url.startsWith(`${urlPublica}/`)) return url
  const arquivo = url.slice(urlPublica.length + 1)
  return `/api/upload?arquivo=${encodeURIComponent(arquivo)}`
}

export default function EditorResultadosStudio() {
  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoResultadosStudio>(
      CONFIGURACAO_RESULTADOS_STUDIO_PADRAO,
    )
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [resultadoEmEdicaoId, setResultadoEmEdicaoId] = useState<string | null>(
    null,
  )
  const [formulario, setFormulario] =
    useState<FormularioResultado>(FORMULARIO_VAZIO)
  const [resultadoParaExcluir, setResultadoParaExcluir] =
    useState<ResultadoStudio | null>(null)
  const [recorteAberto, setRecorteAberto] = useState(false)
  const [imagemParaRecorte, setImagemParaRecorte] = useState('')
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const inputImagemRef = useRef<HTMLInputElement>(null)

  const carregarConfiguracao = useCallback(async () => {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_RESULTADOS_STUDIO)
        .maybeSingle()

      if (error) throw error
      setConfiguracao(normalizarConfiguracaoResultadosStudio(data?.valor))
    } catch {
      toast.error('Não foi possível carregar os resultados do studio')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarConfiguracao()
  }, [carregarConfiguracao])

  const salvarConfiguracao = async () => {
    const configuracaoNormalizada = normalizarConfiguracaoResultadosStudio(
      JSON.stringify(configuracao),
    )

    if (
      configuracaoNormalizada.ativo &&
      !configuracaoNormalizada.resultados.some((resultado) => resultado.ativo)
    ) {
      toast.warning('Publique ao menos uma foto de resultado')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        {
          chave: CHAVE_RESULTADOS_STUDIO,
          valor: JSON.stringify(configuracaoNormalizada),
          tipo: 'json',
          descricao:
            'Logo e resultados do studio exibidos após o catálogo público.',
        },
        { onConflict: 'chave' },
      )
      if (error) throw error
      setConfiguracao(configuracaoNormalizada)
      toast.success('Resultados do studio atualizados')
    } catch {
      toast.error('Não foi possível salvar os resultados do studio')
    } finally {
      setSalvando(false)
    }
  }

  const abrirNovoResultado = () => {
    setResultadoEmEdicaoId(null)
    setFormulario(FORMULARIO_VAZIO)
    setDialogAberto(true)
  }

  const abrirEdicaoResultado = (resultado: ResultadoStudio) => {
    setResultadoEmEdicaoId(resultado.id)
    setFormulario({
      imagemUrl: resultado.imagemUrl,
      titulo: resultado.titulo,
      descricao: resultado.descricao,
      ativo: resultado.ativo,
    })
    setDialogAberto(true)
  }

  const salvarResultado = () => {
    if (!formulario.imagemUrl) {
      toast.warning('Adicione e enquadre uma foto para continuar')
      return
    }

    setConfiguracao((estadoAtual) => ({
      ...estadoAtual,
      resultados: resultadoEmEdicaoId
        ? estadoAtual.resultados.map((resultado) =>
            resultado.id === resultadoEmEdicaoId
              ? { ...resultado, ...formulario }
              : resultado,
          )
        : [
            ...estadoAtual.resultados,
            { id: criarIdResultadoStudio(), ...formulario },
          ],
    }))
    setDialogAberto(false)
    toast.success(
      resultadoEmEdicaoId
        ? 'Resultado atualizado na edição'
        : 'Resultado adicionado à edição',
      { description: 'Use “Salvar alterações” para publicar no site.' },
    )
  }

  const moverResultado = (indice: number, deslocamento: -1 | 1) => {
    const proximoIndice = indice + deslocamento
    if (
      proximoIndice < 0 ||
      proximoIndice >= configuracao.resultados.length
    ) {
      return
    }
    setConfiguracao((estadoAtual) => {
      const resultados = [...estadoAtual.resultados]
      ;[resultados[indice], resultados[proximoIndice]] = [
        resultados[proximoIndice],
        resultados[indice],
      ]
      return { ...estadoAtual, resultados }
    })
  }

  const alternarResultado = (id: string) => {
    setConfiguracao((estadoAtual) => ({
      ...estadoAtual,
      resultados: estadoAtual.resultados.map((resultado) =>
        resultado.id === id
          ? { ...resultado, ativo: !resultado.ativo }
          : resultado,
      ),
    }))
  }

  const excluirResultado = () => {
    if (!resultadoParaExcluir) return
    setConfiguracao((estadoAtual) => ({
      ...estadoAtual,
      resultados: estadoAtual.resultados.filter(
        (resultado) => resultado.id !== resultadoParaExcluir.id,
      ),
    }))
    setResultadoParaExcluir(null)
    toast.success('Resultado removido da edição', {
      description: 'Use “Salvar alterações” para publicar no site.',
    })
  }

  const abrirRecorte = (imagemUrl: string) => {
    setImagemParaRecorte(obterUrlEditavel(imagemUrl))
    setDialogAberto(false)
    setRecorteAberto(true)
  }

  const selecionarImagem = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = event.target.files?.[0]
    event.target.value = ''
    if (!arquivo) return
    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      toast.warning(validacao.erro || 'Selecione uma imagem válida')
      return
    }

    try {
      abrirRecorte(await arquivoParaUrl(arquivo))
    } catch {
      toast.error('Não foi possível abrir esta imagem')
    }
  }

  const fecharRecorte = () => {
    setRecorteAberto(false)
    setImagemParaRecorte('')
    setDialogAberto(true)
  }

  const confirmarRecorte = async (_base64: string, blob: Blob) => {
    setEnviandoImagem(true)
    try {
      const arquivo = new File(
        [blob],
        `resultado-studio-${Date.now()}.jpg`,
        { type: blob.type || 'image/jpeg' },
      )
      const resultado = await uploadImagemB2(arquivo, 'vitrine')
      if (!resultado.sucesso || !resultado.url) {
        throw new Error(resultado.erro || 'Falha no envio')
      }
      setFormulario((estadoAtual) => ({
        ...estadoAtual,
        imagemUrl: resultado.url || '',
      }))
      setRecorteAberto(false)
      setImagemParaRecorte('')
      setDialogAberto(true)
      toast.success('Foto enquadrada e enviada')
    } catch (erro) {
      toast.error(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível enviar a imagem',
      )
    } finally {
      setEnviandoImagem(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Resultados do studio</CardTitle>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Apresente a parceria e fotos reais do salão após o catálogo. A
              ordem desta lista será a mesma exibida no site.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-11 shrink-0"
            onClick={() => void salvarConfiguracao()}
            disabled={carregando || salvando}
          >
            {salvando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Salvar alterações
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 p-5 sm:p-6">
          {carregando ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Carregando configuração...
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="space-y-4">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium">
                        Exibir no site
                      </span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">
                        A seção aparece depois do catálogo quando houver ao
                        menos uma foto publicada.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={configuracao.ativo}
                      onChange={(event) =>
                        setConfiguracao((estadoAtual) => ({
                          ...estadoAtual,
                          ativo: event.target.checked,
                        }))
                      }
                      className="size-4 accent-primary"
                    />
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="resultados-chamada">
                      Texto acima da logomarca
                    </Label>
                    <Input
                      id="resultados-chamada"
                      value={configuracao.chamada}
                      maxLength={80}
                      onChange={(event) =>
                        setConfiguracao((estadoAtual) => ({
                          ...estadoAtual,
                          chamada: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
                      <span>
                        <span className="block text-sm font-medium">
                          Troca automática
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          O visitante ainda pode pausar.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={configuracao.autoplay}
                        onChange={(event) =>
                          setConfiguracao((estadoAtual) => ({
                            ...estadoAtual,
                            autoplay: event.target.checked,
                          }))
                        }
                        className="size-4 accent-primary"
                      />
                    </label>
                    <div className="space-y-2">
                      <Label htmlFor="resultados-intervalo">
                        Intervalo entre fotos
                      </Label>
                      <Select
                        value={String(configuracao.intervaloSegundos)}
                        onValueChange={(valor) =>
                          setConfiguracao((estadoAtual) => ({
                            ...estadoAtual,
                            intervaloSegundos: Number(valor),
                          }))
                        }
                        disabled={!configuracao.autoplay}
                      >
                        <SelectTrigger id="resultados-intervalo" className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[4, 5, 6, 7, 8, 9, 10].map((segundos) => (
                            <SelectItem key={segundos} value={String(segundos)}>
                              {segundos} segundos
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-border/70 bg-muted/20 p-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Logomarca do salão
                  </p>
                  <div className="relative mt-4 h-24 w-full">
                    <Image
                      src={configuracao.logoUrl}
                      alt="Prévia da logomarca do studio"
                      fill
                      sizes="288px"
                      className="object-contain dark:hidden"
                    />
                    <Image
                      src={
                        configuracao.logoUrlTemaEscuro || configuracao.logoUrl
                      }
                      alt="Prévia da logomarca do studio"
                      fill
                      sizes="288px"
                      className="hidden object-contain dark:block"
                    />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    A versão correta é escolhida automaticamente no tema claro
                    ou escuro.
                  </p>
                </div>
              </div>

              <div className="border-t border-border/70 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Fotos de resultados</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Até 12 fotos. Recomendamos retratos verticais em 4:5.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={abrirNovoResultado}
                    disabled={configuracao.resultados.length >= 12}
                  >
                    <Plus className="size-4" aria-hidden />
                    Adicionar resultado
                  </Button>
                </div>

                {configuracao.resultados.length === 0 ? (
                  <button
                    type="button"
                    onClick={abrirNovoResultado}
                    className="mt-4 flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 text-center transition-colors hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
                    <span className="mt-3 text-sm font-medium">
                      Adicionar a primeira foto
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Você poderá recortar, ordenar e ocultar cada resultado.
                    </span>
                  </button>
                ) : (
                  <div className="mt-4 divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {configuracao.resultados.map((resultado, indice) => (
                      <div
                        key={resultado.id}
                        className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                      >
                        <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={resultado.imagemUrl}
                            alt=""
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {resultado.titulo || `Resultado ${indice + 1}`}
                            </p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              {resultado.ativo ? 'Publicado' : 'Oculto'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {resultado.descricao || 'Sem descrição sobreposta.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-11"
                            onClick={() => moverResultado(indice, -1)}
                            disabled={indice === 0}
                            aria-label="Mover resultado para cima"
                          >
                            <ArrowUp className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-11"
                            onClick={() => moverResultado(indice, 1)}
                            disabled={indice === configuracao.resultados.length - 1}
                            aria-label="Mover resultado para baixo"
                          >
                            <ArrowDown className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-11"
                            onClick={() => alternarResultado(resultado.id)}
                            aria-label={resultado.ativo ? 'Ocultar resultado' : 'Publicar resultado'}
                          >
                            {resultado.ativo ? (
                              <Eye className="size-4" aria-hidden />
                            ) : (
                              <EyeOff className="size-4" aria-hidden />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-11"
                            onClick={() => abrirEdicaoResultado(resultado)}
                            aria-label="Editar resultado"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-11 text-destructive hover:text-destructive"
                            onClick={() => setResultadoParaExcluir(resultado)}
                            aria-label="Excluir resultado"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl p-0" showCloseButton>
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-14 text-left">
            <DialogTitle>
              {resultadoEmEdicaoId ? 'Editar resultado' : 'Novo resultado'}
            </DialogTitle>
            <DialogDescription>
              Use uma foto real do trabalho e mantenha o texto curto.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65dvh] space-y-5 overflow-y-auto p-5">
            <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <div>
                {formulario.imagemUrl ? (
                  <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={formulario.imagemUrl}
                      alt="Prévia do resultado"
                      fill
                      sizes="192px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputImagemRef.current?.click()}
                    className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border text-center hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
                    <span className="mt-2 text-sm font-medium">Escolher foto</span>
                  </button>
                )}
                {formulario.imagemUrl ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 px-2"
                      onClick={() => abrirRecorte(formulario.imagemUrl)}
                    >
                      <Crop className="size-4" aria-hidden />
                      Recortar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 px-2"
                      onClick={() => inputImagemRef.current?.click()}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resultado-titulo">Título opcional</Label>
                  <Input
                    id="resultado-titulo"
                    value={formulario.titulo}
                    maxLength={80}
                    placeholder="Ex.: Resultado após o tratamento"
                    onChange={(event) =>
                      setFormulario((estadoAtual) => ({
                        ...estadoAtual,
                        titulo: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resultado-descricao">Descrição opcional</Label>
                  <Textarea
                    id="resultado-descricao"
                    value={formulario.descricao}
                    maxLength={180}
                    rows={4}
                    placeholder="Explique brevemente o cuidado ou resultado mostrado."
                    onChange={(event) =>
                      setFormulario((estadoAtual) => ({
                        ...estadoAtual,
                        descricao: event.target.value,
                      }))
                    }
                  />
                  <p className="text-right text-xs text-muted-foreground">
                    {formulario.descricao.length}/180
                  </p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border/70 px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium">Publicar foto</span>
                    <span className="block text-xs text-muted-foreground">
                      Fotos ocultas permanecem salvas na edição.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={formulario.ativo}
                    onChange={(event) =>
                      setFormulario((estadoAtual) => ({
                        ...estadoAtual,
                        ativo: event.target.checked,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/70 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setDialogAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="button" className="min-h-11" onClick={salvarResultado}>
              {resultadoEmEdicaoId ? 'Salvar resultado' : 'Adicionar resultado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={inputImagemRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => void selecionarImagem(event)}
        className="hidden"
        aria-hidden="true"
      />

      {recorteAberto ? (
        <ModalRecorteImagem
          aberto
          imagemUrl={imagemParaRecorte}
          onFechar={fecharRecorte}
          onConfirmar={(base64, blob) => void confirmarRecorte(base64, blob)}
          proporcaoInicial={4 / 5}
          titulo="Enquadrar foto do resultado"
          modoPreview="resultado"
        />
      ) : null}

      {enviandoImagem ? (
        <div className="fixed inset-x-4 bottom-4 z-[1100] mx-auto flex min-h-11 max-w-sm items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm shadow-lg">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Processando e enviando a foto...
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(resultadoParaExcluir)}
        onOpenChange={(aberto) => !aberto && setResultadoParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este resultado?</AlertDialogTitle>
            <AlertDialogDescription>
              A foto sairá da edição. A alteração só será publicada quando você
              salvar a seção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={excluirResultado}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover resultado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
