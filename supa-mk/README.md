# Dump estrutural — MK Soluções

Gerado em 13/08/2026 com a CLI oficial da Supabase (`supabase db dump --schema public`). O arquivo [`00_public_schema.sql`](./00_public_schema.sql) é um dump somente de estrutura: não contém `INSERT`, `COPY`, clientes, produtos, pedidos, usuários, configurações preenchidas ou outro registro operacional.

## Conteúdo verificado

- 27 tabelas no schema `public`;
- 7 funções, 1 view e 1 trigger;
- 48 índices, 69 constraints e 30 chaves estrangeiras;
- grants e default privileges que existiam no projeto de origem.

## Fora do dump

- dados de qualquer tabela;
- usuários do Supabase Auth e objetos/buckets do Storage;
- roles gerenciadas pela plataforma e definições de extensões.

## Uso no Fortes Fios

Este arquivo é a referência fiel da estrutura da MK. Antes de aplicá-lo no projeto novo, confirme que a extensão `pgcrypto` está disponível, pois algumas funções usam `extensions.digest`.

O dump preserva os `GRANT ALL` do projeto de origem. Eles não devem ser aplicados cegamente no Fortes Fios: a política de acesso/RLS do projeto novo precisa ser revisada antes da restauração, para não repetir a exposição atual da MK.
