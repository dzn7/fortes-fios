# SPEC — Ícone da categoria: o gravado tem que valer

> Status: implementado e verificado.
> Pedido do usuário: *"mudou o icone da categoria e nao apareceu a mudanca no
> site do cliente… melhore/adicione mais icones, atualmente tem mt pouco e
> alguns que nem tem nada a ver com cabelo"*

---

## 1. O bug

O Admin gravava `categorias_cardapio.icone`, a API pública devolvia o campo, e o
**carrossel de categorias do site simplesmente não olhava para ele**:

```tsx
// src/app/page.tsx — antes
const obterIconeCategoria = (categoria: string): LucideIcon => {
  const n = normalizarCategoriaFortesFios(categoria)
  if (n.startsWith('todos')) return Grid2X2
  if (n.includes('kit')) return PackageOpen
  …
  return Tag
}
…
const Icone = obterIconeCategoria(categoria)   // ← adivinha pelo NOME
```

O mais revelador: o mesmo arquivo já tinha o memo certo, com o comentário
*"Nome → ícone, para o menu mostrar o mesmo símbolo escolhido no Admin"* — mas
ele só era passado ao `Header`. Ou seja, **trocar o ícone mudava o menu
hambúrguer e não mudava o carrossel**, que é a tela que o cliente realmente vê.

## 2. Correção

O valor gravado vence; o palpite pelo nome (`sugerirIconePorNome`, que já
existia no domínio) vira apenas a rede para categoria ainda sem escolha:

```tsx
const iconeDaCategoria = (categoria: string) =>
  iconesCategoria[categoria] ?? sugerirIconePorNome(categoria)
```

`"Todos"` é pseudo-categoria — não tem linha no banco para guardar ícone — e
continua com `Grid2X2`, tratado explicitamente.

O `obterIconeCategoria` foi removido: era a causa, e sua tabela de palavras
duplicava mal o `sugerirIconePorNome`.

### 2.1 Onde o componente passou a morar

`IconeCategoria` vivia em `src/components/admin/produtos/SeletorIconeCategoria.tsx`,
e o `Header` **do site do cliente** importava de dentro da pasta do Admin — o
sintoma de que a peça estava no lugar errado. Agora é
`src/components/icons/IconeCategoria.tsx`, usado pelas duas pontas.

## 3. O catálogo: de 12 para 24

O catálogo antigo forçava escolhas ruins, e os dados de produção provam:

| Categoria real | Ícone que tinha | Por quê |
|---|---|---|
| Hidratação | `etiqueta` | não existia ícone de hidratação |
| Finalizadores | `maquiagem` | não existia finalizador |
| Acessórios | `maquiagem` | não existia acessório |
| Cabelos oleosos, caspa, antiqueda… | `liso` | não existia couro cabeludo |
| Reconstrução | `tratamento` | genérico engolia o específico |
| Nutrição | `tratamento` | idem |

E havia escolha sem sentido nenhum: `pele` era o ícone **`Gift`** (presente).

### 3.1 O catálogo novo

Organizado por família, com o **específico antes do genérico** — a ordem importa
porque `sugerirIconePorNome` devolve o primeiro que casar:

| Família | Ícones |
|---|---|
| Lavagem | Shampoo e banho |
| Tipo de cabelo | Cachos · Liso e escova |
| Tratamento | Hidratação · Nutrição · Reconstrução · Tratamento · Couro cabeludo |
| Finalização | Finalizadores · Óleos e séruns · Proteção térmica |
| Cor | Coloração · Matizador |
| Comercial | Kit · Promoção · Linha premium |
| Público | Infantil |
| Ferramentas | Ferramentas · Escovas e pentes · Acessórios |
| Além do cabelo | Maquiagem · Pele e corpo · Perfumaria |
| Padrão | Etiqueta |

**Nenhum id antigo foi removido** — os 12 originais continuam válidos, porque há
categorias no banco apontando para eles. Sumir com um id faria `iconeValido`
devolver o padrão e a categoria perderia o ícone em silêncio. Há teste para isso.

Só `lucide-react`, que já é dependência (AGENTS §3.2 — sem lib nova). Todos os
24 componentes foram conferidos no `lucide-react` 0.312.0 instalado e
**inspecionados visualmente**, renderizados pelos componentes reais.

## 4. Aceite

| Cenário | Esperado |
|---|---|
| Trocar o ícone no Admin | muda no carrossel **e** no menu do site |
| Categoria sem ícone gravado | palpite pelo nome |
| Categoria com id antigo (`tratamento`) | continua válida |
| "Todos" | `Grid2X2` |
| "Hidratação" | sugere `hidratacao`, não `etiqueta` |
| "Finalizadores" | sugere `finalizador`, não `maquiagem` |

Cobertura: `tests/categorias.test.mjs`, incluindo um teste que percorre as **11
categorias reais da loja**.

## 5. Pendência

Seis categorias reais ainda têm gravado o ícone que o catálogo antigo forçou.
O código já as exibe corretamente pelo valor gravado — mas o valor gravado é que
está ruim. Repicá-las é decisão de conteúdo do usuário; a sugestão automática já
aponta o ícone certo para todas.
