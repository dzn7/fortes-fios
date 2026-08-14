'use client'

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatarMoeda } from '../lib/formatadores'
import type { LucroProduto, ResumoMensal, ResumoPeriodo } from '../types'
import { GraficoComposicaoLucro } from './GraficoComposicaoLucro'
import { GraficoLucroMensal } from './GraficoLucroMensal'

interface PainelLucroProps {
  resumo: ResumoPeriodo
  resumoMensal: ResumoMensal[]
  lucroProdutos: LucroProduto[]
  carregando: boolean
  valoresOcultos: boolean
}

const CARDS = [
  { chave: 'receita', rotulo: 'Vendas analisadas', icone: CircleDollarSign },
  { chave: 'custo', rotulo: 'Custo dos produtos', icone: Boxes },
  { chave: 'lucro', rotulo: 'Lucro bruto', icone: TrendingUp },
  { chave: 'margem', rotulo: 'Margem bruta', icone: PackageCheck },
] as const

export function PainelLucro({
  resumo,
  resumoMensal,
  lucroProdutos,
  carregando,
  valoresOcultos,
}: PainelLucroProps) {
  const mostrarMoeda = (valor: number) =>
    valoresOcultos ? '••••••' : formatarMoeda(valor)
  const valores = {
    receita: mostrarMoeda(resumo.receitaProdutosComCusto),
    custo: mostrarMoeda(resumo.custoMercadorias),
    lucro: mostrarMoeda(resumo.lucroBrutoProdutos),
    margem: valoresOcultos
      ? '••••'
      : resumo.margemBrutaProdutos === null
        ? '—'
        : `${resumo.margemBrutaProdutos.toFixed(1)}%`,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {CARDS.map(({ chave, rotulo, icone: Icone }) => (
          <div
            key={chave}
            className="min-w-0 rounded-xl border border-border/70 bg-card p-3.5 sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                {rotulo}
              </p>
              <Icone
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.7}
                aria-hidden
              />
            </div>
            {carregando ? (
              <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
            ) : (
              <p
                className={cn(
                  'truncate text-lg font-semibold tabular-nums text-foreground sm:text-xl',
                  chave === 'lucro' &&
                    resumo.lucroBrutoProdutos >= 0 &&
                    'text-emerald-600 dark:text-emerald-400',
                  chave === 'lucro' &&
                    resumo.lucroBrutoProdutos < 0 &&
                    'text-rose-600 dark:text-rose-400',
                )}
              >
                {valores[chave]}
              </p>
            )}
          </div>
        ))}
      </div>

      {resumo.itensSemCusto > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              O lucro deste período é parcial
            </p>
            <p className="mt-0.5 text-xs leading-5">
              {resumo.itensSemCusto}{' '}
              {resumo.itensSemCusto === 1
                ? 'unidade vendida não tem'
                : 'unidades vendidas não têm'}{' '}
              custo registrado.{' '}
              {valoresOcultos
                ? 'O valor dessas vendas está oculto.'
                : `${formatarMoeda(resumo.receitaSemCusto)} em vendas não entram no cálculo.`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GraficoComposicaoLucro
          resumo={resumo}
          carregando={carregando}
          valoresOcultos={valoresOcultos}
        />
        <section
          className="overflow-hidden rounded-xl border border-border/70 bg-card"
          aria-labelledby="cobertura-lucro-titulo"
        >
          <div className="border-b border-border/60 px-4 py-4">
            <h3
              id="cobertura-lucro-titulo"
              className="text-lg font-semibold text-foreground"
            >
              Cobertura do cálculo
            </h3>
            <p className="text-sm text-muted-foreground">
              Confirme quanto das vendas possui custo de compra registrado.
            </p>
          </div>
          <div className="p-4">
            {carregando ? (
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width]"
                    style={{
                      width: `${Math.min(
                        resumo.receitaProdutosComCusto +
                          resumo.receitaSemCusto >
                          0
                          ? (resumo.receitaProdutosComCusto /
                              (resumo.receitaProdutosComCusto +
                                resumo.receitaSemCusto)) *
                              100
                          : 0,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                      Vendas com custo
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {mostrarMoeda(resumo.receitaProdutosComCusto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35"
                        aria-hidden
                      />
                      Vendas sem custo
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {mostrarMoeda(resumo.receitaSemCusto)}
                    </span>
                  </div>
                </div>
                <p className="mt-5 border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
                  O custo usado é o valor histórico salvo no item no momento da
                  venda; alterações posteriores no produto não mudam este
                  resultado.
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <GraficoLucroMensal
        dados={resumoMensal}
        carregando={carregando}
        valoresOcultos={valoresOcultos}
      />

      <section
        className="overflow-hidden rounded-xl border border-border/70 bg-card"
        aria-labelledby="lucro-produto-lista-titulo"
      >
        <div className="flex flex-col gap-1 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3
              id="lucro-produto-lista-titulo"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Lucro por produto
            </h3>
            <p className="text-sm text-muted-foreground">
              Produtos que mais contribuíram para o resultado no período
              selecionado.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {lucroProdutos.length}{' '}
            {lucroProdutos.length === 1 ? 'produto' : 'produtos'}
          </span>
        </div>
        {carregando ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-12 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : lucroProdutos.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              Ainda não há lucro calculável
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre o custo de compra; as próximas vendas serão
              contabilizadas aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {lucroProdutos.map((produto) => (
              <div
                key={`${produto.produtoId || produto.nome}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_auto_auto_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {produto.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {produto.quantidade}{' '}
                    {produto.quantidade === 1 ? 'unidade' : 'unidades'} · venda{' '}
                    {mostrarMoeda(produto.receitaComCusto)}
                  </p>
                </div>
                <p className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                  Custo {mostrarMoeda(produto.custoMercadorias)}
                </p>
                <p className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">
                  {valoresOcultos
                    ? '••••'
                    : produto.margemBruta === null
                      ? '—'
                      : `${produto.margemBruta.toFixed(1)}% margem`}
                </p>
                <p
                  className={cn(
                    'text-right text-sm font-semibold tabular-nums',
                    produto.lucroBruto >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {mostrarMoeda(produto.lucroBruto)}
                </p>
                {produto.itensSemCusto > 0 ? (
                  <p className="col-span-2 text-xs text-amber-700 dark:text-amber-300 sm:col-span-5">
                    {produto.itensSemCusto}{' '}
                    {produto.itensSemCusto === 1
                      ? 'unidade sem custo registrado'
                      : 'unidades sem custo registrado'}{' '}
                    não entram no lucro.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
