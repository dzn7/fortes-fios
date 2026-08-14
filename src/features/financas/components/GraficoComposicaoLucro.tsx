'use client'

import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { cn } from '@/lib/utils'
import { ensureChartJsRegistered } from '../lib/setup-chartjs'
import { CORES_GRAFICOS, formatarMoeda } from '../lib/formatadores'
import type { ResumoPeriodo } from '../types'

ensureChartJsRegistered()

interface GraficoComposicaoLucroProps {
  resumo: ResumoPeriodo
  carregando?: boolean
  valoresOcultos: boolean
}

export function GraficoComposicaoLucro({
  resumo,
  carregando,
  valoresOcultos,
}: GraficoComposicaoLucroProps) {
  const receitaAnalisada = resumo.receitaProdutosComCusto
  const lucroPositivo = Math.max(resumo.lucroBrutoProdutos, 0)
  const custoLimitado = Math.min(resumo.custoMercadorias, receitaAnalisada)
  const temDados = receitaAnalisada > 0
  const mostrar = (valor: number) =>
    valoresOcultos ? '••••••' : formatarMoeda(valor)

  const chartData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: ['Custo das mercadorias', 'Lucro bruto'],
      datasets: [
        {
          data: temDados ? [custoLimitado, lucroPositivo] : [1, 0],
          backgroundColor: ['hsl(215, 22%, 72%)', CORES_GRAFICOS.lucro],
          borderWidth: 0,
          hoverOffset: 3,
        },
      ],
    }),
    [custoLimitado, lucroPositivo, temDados],
  )

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: temDados && !valoresOcultos,
          callbacks: {
            label: (ctx) =>
              `${ctx.label}: ${formatarMoeda(Number(ctx.parsed) || 0)}`,
          },
        },
      },
    }),
    [temDados, valoresOcultos],
  )

  return (
    <section
      className="overflow-hidden rounded-xl border border-border/70 bg-card"
      aria-labelledby="composicao-lucro-titulo"
    >
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-4">
            <h3
              id="composicao-lucro-titulo"
              className="text-lg font-semibold text-foreground"
            >
              Composição do lucro
            </h3>
            <p className="text-sm text-muted-foreground">
              Quanto das vendas analisadas ficou em custo e resultado bruto.
            </p>
          </div>

          {carregando ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-[58px] animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Vendas analisadas
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {mostrar(receitaAnalisada)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-slate-400"
                      aria-hidden
                    />
                    Custo das mercadorias
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {mostrar(resumo.custoMercadorias)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        resumo.lucroBrutoProdutos >= 0
                          ? 'bg-emerald-500'
                          : 'bg-rose-500',
                      )}
                      aria-hidden
                    />
                    {resumo.lucroBrutoProdutos >= 0
                      ? 'Lucro bruto'
                      : 'Prejuízo bruto'}
                  </span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      resumo.lucroBrutoProdutos >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {mostrar(resumo.lucroBrutoProdutos)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex h-52 w-full shrink-0 items-center justify-center xl:w-60">
          {carregando ? (
            <div className="h-40 w-40 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <div className="h-40 w-40">
                <Doughnut data={chartData} options={options} />
              </div>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    resumo.lucroBrutoProdutos >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {valoresOcultos
                    ? '••••'
                    : resumo.margemBrutaProdutos === null
                      ? '—'
                      : `${resumo.margemBrutaProdutos.toFixed(1)}%`}
                </p>
                <p className="text-xs text-muted-foreground">Margem bruta</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
