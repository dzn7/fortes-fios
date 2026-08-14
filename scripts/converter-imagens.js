/**
 * Script para converter imagens JPEG para WebP otimizado
 * Utiliza a biblioteca Sharp para processamento de imagens
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Diretório das imagens
const diretorioOrigem = path.join(__dirname, '../public/assets');
const diretorioDestino = path.join(__dirname, '../public/assets');

// Configurações de otimização WebP
const configWebP = {
  quality: 80,        // Qualidade da imagem (0-100)
  effort: 6,          // Esforço de compressão (0-6, maior = menor arquivo)
  lossless: false,    // Compressão com perda para arquivos menores
};

// Configurações de redimensionamento
const larguraMaxima = 800;  // Largura máxima em pixels
const alturaMaxima = 800;   // Altura máxima em pixels

/**
 * Converte uma imagem JPEG para WebP otimizado
 * @param {string} caminhoArquivo - Caminho completo do arquivo de origem
 */
async function converterImagem(caminhoArquivo) {
  const nomeArquivo = path.basename(caminhoArquivo, path.extname(caminhoArquivo));
  const caminhoDestino = path.join(diretorioDestino, `${nomeArquivo}.webp`);
  
  try {
    // Obtém informações da imagem original
    const metadados = await sharp(caminhoArquivo).metadata();
    const tamanhoOriginal = fs.statSync(caminhoArquivo).size;
    
    // Processa e converte a imagem
    await sharp(caminhoArquivo)
      .resize(larguraMaxima, alturaMaxima, {
        fit: 'inside',           // Mantém proporção, não excede dimensões
        withoutEnlargement: true // Não aumenta imagens menores
      })
      .webp(configWebP)
      .toFile(caminhoDestino);
    
    // Obtém tamanho do arquivo convertido
    const tamanhoNovo = fs.statSync(caminhoDestino).size;
    const reducao = ((1 - tamanhoNovo / tamanhoOriginal) * 100).toFixed(1);
    
    console.log(`✅ ${nomeArquivo}`);
    console.log(`   Original: ${(tamanhoOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   WebP: ${(tamanhoNovo / 1024).toFixed(0)} KB`);
    console.log(`   Redução: ${reducao}%`);
    console.log('');
    
    return {
      nome: nomeArquivo,
      tamanhoOriginal,
      tamanhoNovo,
      reducao: parseFloat(reducao)
    };
  } catch (erro) {
    console.error(`❌ Erro ao converter ${nomeArquivo}:`, erro.message);
    return null;
  }
}

/**
 * Processa todas as imagens JPEG no diretório
 */
async function processarTodasImagens() {
  console.log('🖼️  Iniciando conversão de imagens para WebP...\n');
  console.log(`📁 Diretório: ${diretorioOrigem}\n`);
  
  // Lista arquivos JPEG no diretório
  const arquivos = fs.readdirSync(diretorioOrigem)
    .filter(arquivo => /\.(jpg|jpeg|png)$/i.test(arquivo));
  
  if (arquivos.length === 0) {
    console.log('⚠️  Nenhuma imagem JPEG/PNG encontrada.');
    return;
  }
  
  console.log(`📷 ${arquivos.length} imagens encontradas\n`);
  console.log('─'.repeat(50) + '\n');
  
  const resultados = [];
  let tamanhoTotalOriginal = 0;
  let tamanhoTotalNovo = 0;
  
  // Processa cada imagem
  for (const arquivo of arquivos) {
    const caminhoCompleto = path.join(diretorioOrigem, arquivo);
    const resultado = await converterImagem(caminhoCompleto);
    
    if (resultado) {
      resultados.push(resultado);
      tamanhoTotalOriginal += resultado.tamanhoOriginal;
      tamanhoTotalNovo += resultado.tamanhoNovo;
    }
  }
  
  // Exibe resumo
  console.log('─'.repeat(50));
  console.log('\n📊 RESUMO DA CONVERSÃO\n');
  console.log(`   Imagens processadas: ${resultados.length}/${arquivos.length}`);
  console.log(`   Tamanho total original: ${(tamanhoTotalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Tamanho total WebP: ${(tamanhoTotalNovo / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Redução total: ${((1 - tamanhoTotalNovo / tamanhoTotalOriginal) * 100).toFixed(1)}%`);
  console.log('\n✅ Conversão concluída!');
}

// Executa o script
processarTodasImagens().catch(console.error);
