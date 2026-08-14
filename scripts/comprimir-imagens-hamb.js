/**
 * Script para comprimir e converter imagens de hambúrgueres para WebP
 * Usa Sharp para otimização de alta qualidade
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Configurações
const PASTA_ORIGEM = path.join(__dirname, '../public/assets/favicon/hamb')
const PASTA_DESTINO = path.join(__dirname, '../public/assets/favicon/hamb/webp')
const QUALIDADE_WEBP = 85 // 85% de qualidade (ótimo balanço)
const LARGURA_MAXIMA = 800 // Largura máxima para hambúrgueres

// Cores para console
const cores = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  amarelo: '\x1b[33m',
  azul: '\x1b[36m',
  vermelho: '\x1b[31m',
}

/**
 * Formata bytes para formato legível
 */
function formatarBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const tamanhos = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + tamanhos[i]
}

/**
 * Comprime e converte uma imagem para WebP
 */
async function comprimirImagem(caminhoOrigem, caminhoDestino) {
  try {
    const nomeArquivo = path.basename(caminhoOrigem)
    const nomeWebP = nomeArquivo.replace(/\.(jpg|jpeg|png)$/i, '.webp')
    const caminhoSaida = path.join(caminhoDestino, nomeWebP)

    // Obtém informações da imagem original
    const statsOriginal = fs.statSync(caminhoOrigem)
    const tamanhoOriginal = statsOriginal.size

    console.log(`${cores.azul}📸 Processando: ${nomeArquivo}${cores.reset}`)
    console.log(`   Tamanho original: ${formatarBytes(tamanhoOriginal)}`)

    // Processa a imagem
    const info = await sharp(caminhoOrigem)
      .resize({
        width: LARGURA_MAXIMA,
        height: LARGURA_MAXIMA,
        fit: 'inside',
        withoutEnlargement: true, // Não aumenta imagens menores
      })
      .webp({
        quality: QUALIDADE_WEBP,
        effort: 6, // Máximo esforço de compressão (0-6)
      })
      .toFile(caminhoSaida)

    // Obtém tamanho do arquivo comprimido
    const statsComprimido = fs.statSync(caminhoSaida)
    const tamanhoComprimido = statsComprimido.size
    const economia = ((1 - tamanhoComprimido / tamanhoOriginal) * 100).toFixed(1)

    console.log(`   ${cores.verde}✓ Comprimido: ${formatarBytes(tamanhoComprimido)}${cores.reset}`)
    console.log(`   ${cores.verde}💾 Economia: ${economia}%${cores.reset}`)
    console.log(`   Dimensões: ${info.width}x${info.height}px\n`)

    return {
      original: nomeArquivo,
      webp: nomeWebP,
      tamanhoOriginal,
      tamanhoComprimido,
      economia: parseFloat(economia),
    }
  } catch (erro) {
    console.error(`${cores.vermelho}✗ Erro ao processar ${caminhoOrigem}:${cores.reset}`, erro.message)
    return null
  }
}

/**
 * Função principal
 */
async function main() {
  console.log(`${cores.azul}${'='.repeat(60)}${cores.reset}`)
  console.log(`${cores.azul}🍔 COMPRESSOR DE IMAGENS - MAX BURGUER${cores.reset}`)
  console.log(`${cores.azul}${'='.repeat(60)}${cores.reset}\n`)

  // Cria pasta de destino se não existir
  if (!fs.existsSync(PASTA_DESTINO)) {
    fs.mkdirSync(PASTA_DESTINO, { recursive: true })
    console.log(`${cores.verde}✓ Pasta criada: ${PASTA_DESTINO}${cores.reset}\n`)
  }

  // Lista todos os arquivos de imagem
  const arquivos = fs
    .readdirSync(PASTA_ORIGEM)
    .filter((arquivo) => /\.(jpg|jpeg|png)$/i.test(arquivo))
    .map((arquivo) => path.join(PASTA_ORIGEM, arquivo))

  if (arquivos.length === 0) {
    console.log(`${cores.amarelo}⚠ Nenhuma imagem encontrada em ${PASTA_ORIGEM}${cores.reset}`)
    return
  }

  console.log(`${cores.azul}📁 Encontradas ${arquivos.length} imagens para processar${cores.reset}\n`)

  // Processa todas as imagens
  const resultados = []
  for (const arquivo of arquivos) {
    const resultado = await comprimirImagem(arquivo, PASTA_DESTINO)
    if (resultado) {
      resultados.push(resultado)
    }
  }

  // Exibe resumo
  console.log(`${cores.azul}${'='.repeat(60)}${cores.reset}`)
  console.log(`${cores.verde}✓ PROCESSAMENTO CONCLUÍDO${cores.reset}\n`)

  const totalOriginal = resultados.reduce((acc, r) => acc + r.tamanhoOriginal, 0)
  const totalComprimido = resultados.reduce((acc, r) => acc + r.tamanhoComprimido, 0)
  const economiaTotal = ((1 - totalComprimido / totalOriginal) * 100).toFixed(1)

  console.log(`📊 Resumo:`)
  console.log(`   Imagens processadas: ${resultados.length}`)
  console.log(`   Tamanho original: ${formatarBytes(totalOriginal)}`)
  console.log(`   Tamanho comprimido: ${formatarBytes(totalComprimido)}`)
  console.log(`   ${cores.verde}💾 Economia total: ${economiaTotal}%${cores.reset}`)
  console.log(`   ${cores.verde}🎯 Espaço economizado: ${formatarBytes(totalOriginal - totalComprimido)}${cores.reset}\n`)

  console.log(`${cores.azul}📂 Arquivos salvos em: ${PASTA_DESTINO}${cores.reset}`)
  console.log(`${cores.azul}${'='.repeat(60)}${cores.reset}\n`)
}

// Executa o script
main().catch((erro) => {
  console.error(`${cores.vermelho}✗ Erro fatal:${cores.reset}`, erro)
  process.exit(1)
})
