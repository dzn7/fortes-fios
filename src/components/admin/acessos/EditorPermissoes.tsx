'use client'

import { useMemo } from 'react'
import { Lock, ShieldCheck, Wand2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MODULOS_ADMIN,
  PAPEIS,
  PRESET_ATENDENTE,
  SENSIBILIDADES,
  chave,
  permissoesTotais,
  type PermissoesAdmin,
} from '@/lib/rbac.mjs'

type EditorPermissoesProps = {
  papel: string
  permissoes: PermissoesAdmin
  onChange: (proximas: PermissoesAdmin) => void
}

/**
 * Editor de permissões por módulo.
 *
 * Agrupado por módulo com "marcar tudo" por grupo, em vez de uma lista corrida
 * de 40 caixas — que é onde esse tipo de tela costuma virar inútil. Cada ação
 * que alcança número estratégico ou mexe em acesso vem marcada, para o
 * administrador enxergar o que está concedendo sem precisar decorar a matriz.
 *
 * Só edita `atendente`. Administrador tem tudo por definição — não é linha em
 * tabela que se possa esvaziar, então aqui aparece como aviso, não como
 * formulário desabilitado que dá a impressão de ser configurável.
 *
 * Spec: specs/rbac-admin.md §5
 */
export function EditorPermissoes({ papel, permissoes, onChange }: EditorPermissoesProps) {
  const totalConcedido = useMemo(
    () => Object.values(permissoes).filter(Boolean).length,
    [permissoes],
  )

  if (papel === PAPEIS.ADMIN) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Acesso total</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Administrador alcança todas as áreas e todos os valores. Não há o que configurar —
            e nenhuma alteração aqui pode tirar isso, para que a loja nunca fique sem quem
            gerencie.
          </p>
        </div>
      </div>
    )
  }

  if (papel !== PAPEIS.ATENDENTE) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Sem acesso ao Admin</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Esta função pertence a um fluxo que não existe nesta loja. O cadastro continua
            válido, mas não abre nenhuma tela administrativa.
          </p>
        </div>
      </div>
    )
  }

  const alternar = (item: string, valor: boolean) => {
    onChange({ ...permissoes, [item]: valor })
  }

  const alternarModulo = (moduloId: string, ligar: boolean) => {
    const modulo = MODULOS_ADMIN.find((m) => m.id === moduloId)
    if (!modulo) return

    const proximas = { ...permissoes }
    for (const acao of modulo.acoes) {
      proximas[chave(modulo.id, acao.id)] = ligar
    }
    onChange(proximas)
  }

  const aplicarPreset = () => {
    // Parte de tudo desligado para o preset ser o retrato completo, não uma
    // camada por cima do que já estava marcado.
    const zerado = Object.fromEntries(Object.keys(permissoesTotais()).map((k) => [k, false]))
    onChange({ ...zerado, ...PRESET_ATENDENTE })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Label>Permissões</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalConcedido === 0
              ? 'Nenhuma permissão concedida'
              : `${totalConcedido} ${totalConcedido === 1 ? 'permissão concedida' : 'permissões concedidas'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={aplicarPreset}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <Wand2 className="h-3.5 w-3.5" />
          Padrão do atendente
        </button>
      </div>

      <div className="space-y-2">
        {MODULOS_ADMIN.map((modulo) => {
          const chaves = modulo.acoes.map((acao) => chave(modulo.id, acao.id))
          const marcadas = chaves.filter((item) => permissoes[item] === true).length
          const todas = marcadas === chaves.length

          return (
            <div key={modulo.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{modulo.nome}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {marcadas} de {chaves.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alternarModulo(modulo.id, !todas)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                    todas
                      ? 'border-primary/25 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {todas ? 'Desmarcar tudo' : 'Marcar tudo'}
                </button>
              </div>

              <div className="mt-2.5 space-y-1.5 border-t border-border/50 pt-2.5">
                {modulo.acoes.map((acao) => {
                  const item = chave(modulo.id, acao.id)
                  const id = `perm-${item}`
                  const sensivel = acao.sensibilidade !== SENSIBILIDADES.OPERACIONAL

                  return (
                    <label
                      key={item}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-muted/40"
                    >
                      <Checkbox
                        id={id}
                        checked={permissoes[item] === true}
                        onCheckedChange={(valor) => alternar(item, valor === true)}
                      />
                      <span className="min-w-0 flex-1 text-[13px] text-foreground">
                        {acao.rotulo}
                      </span>
                      {sensivel ? (
                        <span
                          className={cn(
                            'shrink-0 rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide',
                            acao.sensibilidade === SENSIBILIDADES.CRITICA
                              ? 'border-destructive/30 bg-destructive/10 text-destructive'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-500',
                          )}
                        >
                          {acao.sensibilidade === SENSIBILIDADES.CRITICA ? 'Acesso' : 'Financeiro'}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
