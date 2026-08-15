# Spec — Hero responsivo e imagens resilientes

**Status:** implementada e validada
**Data:** 2026-08-15

## Problemas reproduzidos

1. O hero salva URLs e proporções independentes para desktop e celular, mas o site monta a imagem mobile como `src` base e tenta substituir pela desktop usando o `srcSet` produzido por `getImageProps`. Como `images.unoptimized` está ativo, `getImageProps` não produz `srcSet`; a arte mobile permanece no desktop.
2. Imagens do catálogo e do Admin são carregadas diretamente de `f005.backblazeb2.com`. Em leituras repetidas da mesma imagem foi observada uma resposta transitória `503`, seguida por respostas `206 image/webp`. O navegador não repete automaticamente essa leitura e exibe o ícone de imagem quebrada até o reload.

## Comportamento esperado

- A URL desktop é sempre o `src` base do hero.
- Havendo arte mobile própria, ela é declarada em `<source media="(max-width: 639px)">`; assim, somente viewports mobile a selecionam.
- O contêiner usa `proporcaoDesktop` a partir de 640 px e `proporcaoMobile` abaixo disso.
- Ausência de arte mobile reutiliza integralmente a arte e a proporção desktop.
- URLs públicas do bucket Backblaze são convertidas para a rota same-origin `/api/upload?arquivo=...`.
- Imagens locais, `data:`, `blob:` e hosts externos não pertencentes ao bucket permanecem inalterados.
- A rota same-origin lê o objeto pelo endpoint S3 com tentativas automáticas e devolve cache público imutável, evitando que uma falha transitória chegue diretamente ao navegador.
- O comportamento mobile visual já aprovado não será alterado.

## Testes de regressão

1. URL B2 válida vira URL same-origin e preserva toda a chave do objeto codificada.
2. URL local não é modificada.
3. URL externa não pertencente ao bucket não é modificada.
4. Hero com duas artes usa desktop como base e mobile somente no media query mobile.
5. Hero sem arte mobile usa desktop nos dois tamanhos.

## Fora de escopo

- novo editor de recorte;
- alteração de banners persistidos;
- troca do provedor de armazenamento;
- redesign do hero ou do mobile.
