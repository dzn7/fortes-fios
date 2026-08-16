-- Ícone por categoria.
--
-- Categoria é o que organiza a navegação da loja, e o filtro do cliente só tinha
-- texto. O ícone é o que se reconhece de relance, antes de ler.
--
-- Coluna com default em vez de nullable: `iconeValido` no cliente já cai no
-- padrão, e uma coluna que nunca é nula poupa a checagem em todo consumidor.

set search_path = pg_catalog, public, extensions;

alter table public.categorias_cardapio
  add column if not exists icone text not null default 'etiqueta';

comment on column public.categorias_cardapio.icone is
  'Id do ícone. Catálogo em src/lib/categorias.mjs; valor desconhecido cai em etiqueta.';

-- Retroativo: as categorias existentes ganham o palpite que a tela daria.
update public.categorias_cardapio set icone = 'kit'
 where icone = 'etiqueta' and lower(nome) like '%kit%';
update public.categorias_cardapio set icone = 'tratamento'
 where icone = 'etiqueta' and (lower(nome) like '%quimica%' or lower(nome) like '%química%' or lower(nome) like '%ressecad%');
update public.categorias_cardapio set icone = 'cachos'
 where icone = 'etiqueta' and (lower(nome) like '%cachead%' or lower(nome) like '%cacho%');
update public.categorias_cardapio set icone = 'infantil'
 where icone = 'etiqueta' and lower(nome) like '%infantil%';
update public.categorias_cardapio set icone = 'maquiagem'
 where icone = 'etiqueta' and lower(nome) like '%mary kay%';
