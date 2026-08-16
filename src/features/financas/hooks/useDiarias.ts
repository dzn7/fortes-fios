'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { EntradaDiaria, FinancasDiaria } from '../types'

type UseDiariasArgs = {
  inicio: string
  fim: string
}

const normalizarDataReferencia = (valor: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useDiarias({ inicio, fim }: UseDiariasArgs) {
  const [diarias, setDiarias] = useState<FinancasDiaria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const inicioDia = useMemo(() => normalizarDataReferencia(inicio), [inicio])
  const fimDia = useMemo(() => normalizarDataReferencia(fim), [fim])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const parametros = new URLSearchParams({ inicio: inicioDia, fim: fimDia })
      const resposta = await fetch(`/api/admin/financas/diarias?${parametros}`, {
        credentials: 'same-origin',
      })
      const json = (await resposta.json()) as {
        sucesso?: boolean
        erro?: string
        diarias?: FinancasDiaria[]
      }

      if (!resposta.ok || !json.sucesso) {
        throw new Error(
          resposta.status === 403
            ? 'Seu acesso não inclui os dados financeiros.'
            : json.erro || 'Falha ao carregar diárias',
        )
      }

      setDiarias(
        (json.diarias ?? []).map((row) => ({
          ...row,
          valor: Number(row.valor ?? 0),
          data_referencia: normalizarDataReferencia(String(row.data_referencia)),
        })),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao carregar diárias'
      setErro(message)
      setDiarias([])
    } finally {
      setCarregando(false)
    }
  }, [inicioDia, fimDia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const totalPeriodo = useMemo(
    () => diarias.reduce((acc, d) => acc + Number(d.valor ?? 0), 0),
    [diarias],
  )

  const criarDiaria = useCallback(
    async (entrada: EntradaDiaria) => {
      const nome = entrada.nome_pessoa.trim()
      if (!nome) throw new Error('Informe o nome da pessoa.')
      if (!Number.isFinite(entrada.valor) || entrada.valor <= 0) {
        throw new Error('Informe um valor válido maior que zero.')
      }

      const dataRef = normalizarDataReferencia(entrada.data_referencia)

      const resposta = await fetch('/api/admin/financas/diarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          nome_pessoa: nome,
          valor: entrada.valor,
          data_referencia: dataRef,
          funcionario_id: entrada.funcionario_id || null,
          forma_pagamento: entrada.forma_pagamento ?? null,
          observacoes: entrada.observacoes ?? null,
        }),
      })
      const json = (await resposta.json()) as {
        sucesso?: boolean
        erro?: string
        diaria?: FinancasDiaria
      }

      if (!resposta.ok || !json.sucesso || !json.diaria) {
        const msg =
          resposta.status === 403
            ? 'Seu acesso não inclui esta operação.'
            : json.erro || 'Não foi possível salvar a diária.'
        toast.error(msg)
        throw new Error(msg)
      }

      const diaria = json.diaria

      toast.success('Diária lançada como despesa')
      await carregar()
      return {
        ...diaria,
        valor: Number(diaria.valor ?? 0),
        data_referencia: normalizarDataReferencia(String(diaria.data_referencia)),
      } as FinancasDiaria
    },
    [carregar],
  )

  const removerDiaria = useCallback(
    async (diaria: FinancasDiaria) => {
      const resposta = await fetch(
        `/api/admin/financas/diarias?movimentacaoId=${encodeURIComponent(diaria.movimentacao_id)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      const json = (await resposta.json()) as { sucesso?: boolean; erro?: string }

      if (!resposta.ok || !json.sucesso) {
        const msg =
          resposta.status === 403
            ? 'Seu acesso não inclui esta operação.'
            : json.erro || 'Falha ao excluir'
        toast.error('Não foi possível excluir a diária. ' + msg)
        throw new Error(msg)
      }

      toast.success('Diária e despesa removidas')
      await carregar()
    },
    [carregar],
  )

  return {
    diarias,
    carregando,
    erro,
    totalPeriodo,
    refetch: carregar,
    criarDiaria,
    removerDiaria,
  }
}
