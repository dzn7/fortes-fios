# Spec — Edição das categorias do catálogo

**Status:** implementada e validada
**Data:** 2026-08-15

## Estado atual

- Categorias reais já podem ser renomeadas, mas a ação aparece apenas como um ícone de lápis sem texto no cabeçalho de cada grupo.
- O renomeio existente atualiza `produtos`, `bebidas`, `categorias_cardapio` e a ordem manual.
- O filtro geral do site é uma constante fixa com o texto `Todos` e não corresponde a uma categoria real.

## Comportamento esperado

1. Cada categoria real exibe uma ação textual inequívoca `Editar categoria` no desktop e mantém alvo acessível no mobile.
2. A tela apresenta separadamente o `Filtro geral do catálogo`, explicando que ele reúne todos os produtos.
3. Na ausência de configuração, esse filtro usa `Todos os tipos de cabelo`.
4. O administrador pode editar o rótulo geral pelo mesmo modal visual de edição, sem alterar produtos ou criar uma linha artificial em `categorias_cardapio`.
5. O rótulo é normalizado, obrigatório, limitado a 60 caracteres e não pode duplicar o nome de uma categoria real.
6. O site público recebe categorias e rótulo geral na mesma requisição, sem query adicional.
7. Alterações em categorias ou no rótulo atualizam o catálogo aberto por Realtime.
8. O filtro geral continua mostrando todos os produtos independentemente do texto escolhido.

## Persistência

- Categorias reais continuam na tabela `categorias_cardapio` e nos campos `categoria` já existentes.
- O rótulo geral usa a tabela chave/valor existente `configuracoes_loja`, na chave `rotulo_categoria_todos`.
- Nenhuma migration ou coluna nova é necessária.

## Testes de regressão

1. Configuração ausente usa `Todos os tipos de cabelo`.
2. Espaços externos e repetidos são normalizados.
3. Valor vazio volta ao padrão.
4. Rótulo configurado válido é preservado.
5. O identificador persistido da configuração permanece estável e separado das categorias reais.

## Fora de escopo

- editar ícones das categorias;
- excluir ou mesclar categorias além do fluxo já existente;
- alterar a modelagem de `categorias_cardapio`;
- redesenhar a tela de Produtos.
