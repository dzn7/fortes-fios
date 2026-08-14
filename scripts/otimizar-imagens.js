/**
 * Script para otimizar imagens do cardápio
 * Converte imagens JPEG/PNG para WebP otimizado
 * Redimensiona para tamanhos adequados para web
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Configurações de otimização
const CONFIG = {
  qualidade: 80,
  larguraMaxima: 800,
  alturaMaxima: 800,
  formato: 'webp'
}

// Diretórios a processar
const DIRETORIOS = [
  'public/assets/hotdog',
  'public/assets/REFRI'
]

/**
 * Otimiza uma única imagem
 * @param {string} caminhoOrigem - Caminho da imagem original
 * @param {string} caminhoDestino - Caminho de destino
 */
async function otimizarImagem(caminhoOrigem, caminhoDestino) {
  try {
    const infoOriginal = fs.statSync(caminhoOrigem)
    const tamanhoOriginal = infoOriginal.size

    await sharp(caminhoOrigem)
      .resize(CONFIG.larguraMaxima, CONFIG.alturaMaxima, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: CONFIG.qualidade })
      .toFile(caminhoDestino)

    const infoOtimizada = fs.statSync(caminhoDestino)
    const tamanhoOtimizado = infoOtimizada.size
    const reducao = ((1 - tamanhoOtimizado / tamanhoOriginal) * 100).toFixed(1)

    console.log(`✅ ${path.basename(caminhoOrigem)}`)
    console.log(`   Original: ${(tamanhoOriginal / 1024).toFixed(1)} KB`)
    console.log(`   Otimizado: ${(tamanhoOtimizado / 1024).toFixed(1)} KB`)
    console.log(`   Redução: ${reducao}%`)
    console.log('')

    return {
      arquivo: path.basename(caminhoOrigem),
      tamanhoOriginal,
      tamanhoOtimizado,
      reducao: parseFloat(reducao)
    }
  } catch (erro) {
    console.error(`❌ Erro ao otimizar ${caminhoOrigem}:`, erro.message)
    return null
  }
}

/**
 * Processa todas as imagens de um diretório
 * @param {string} diretorio - Caminho do diretório
 */
async function processarDiretorio(diretorio) {
  const caminhoCompleto = path.join(process.cwd(), diretorio)
  
  if (!fs.existsSync(caminhoCompleto)) {
    console.log(`⚠️  Diretório não encontrado: ${diretorio}`)
    return []
  }

  console.log(`\n📁 Processando: ${diretorio}`)
  console.log('─'.repeat(50))

  const arquivos = fs.readdirSync(caminhoCompleto)
  const extensoesValidas = ['.jpg', '.jpeg', '.png']
  const resultados = []

  for (const arquivo of arquivos) {
    const extensao = path.extname(arquivo).toLowerCase()
    
    if (!extensoesValidas.includes(extensao)) {
      continue
    }

    const caminhoOrigem = path.join(caminhoCompleto, arquivo)
    const nomeBase = path.basename(arquivo, extensao)
    const nomeOtimizado = `${nomeBase}.webp`
    const caminhoDestino = path.join(caminhoCompleto, nomeOtimizado)

    // Verifica se já existe versão otimizada
    if (fs.existsSync(caminhoDestino)) {
      console.log(`⏭️  Já existe: ${nomeOtimizado}`)
      continue
    }

    const resultado = await otimizarImagem(caminhoOrigem, caminhoDestino)
    if (resultado) {
      resultados.push(resultado)
    }
  }

  return resultados
}

/**
 * Função principal
 */
async function main() {
  console.log('\n🖼️  OTIMIZADOR DE IMAGENS - Divina Pastelaria')
  console.log('═'.repeat(50))
  console.log(`Configurações:`)
  console.log(`  - Qualidade: ${CONFIG.qualidade}%`)
  console.log(`  - Dimensão máxima: ${CONFIG.larguraMaxima}x${CONFIG.alturaMaxima}px`)
  console.log(`  - Formato: ${CONFIG.formato.toUpperCase()}`)

  const todosResultados = []

  for (const diretorio of DIRETORIOS) {
    const resultados = await processarDiretorio(diretorio)
    todosResultados.push(...resultados)
  }

  // Resumo final
  console.log('\n' + '═'.repeat(50))
  console.log('📊 RESUMO')
  console.log('═'.repeat(50))

  if (todosResultados.length === 0) {
    console.log('Nenhuma imagem foi processada.')
  } else {
    const totalOriginal = todosResultados.reduce((acc, r) => acc + r.tamanhoOriginal, 0)
    const totalOtimizado = todosResultados.reduce((acc, r) => acc + r.tamanhoOtimizado, 0)
    const reducaoTotal = ((1 - totalOtimizado / totalOriginal) * 100).toFixed(1)

    console.log(`Imagens processadas: ${todosResultados.length}`)
    console.log(`Tamanho original total: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Tamanho otimizado total: ${(totalOtimizado / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Redução total: ${reducaoTotal}%`)
    console.log(`Economia: ${((totalOriginal - totalOtimizado) / 1024 / 1024).toFixed(2)} MB`)
  }

  console.log('\n✨ Processo concluído!')
}

main().catch(console.error)
