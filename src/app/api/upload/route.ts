import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import {
  deveConverter,
  larguraDeSaida,
  normalizarLargura,
  normalizarQualidade,
} from '@/lib/dimensoes-imagem.mjs'

// Tipos de arquivo permitidos
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Tamanho máximo: 5MB (já comprimido no cliente)
const TAMANHO_MAXIMO = 5 * 1024 * 1024

/**
 * As pastas processadas por Sharp recebem o arquivo ORIGINAL, sem passar pela
 * compactação do cliente — um print de celular passa dos 5MB com facilidade. O
 * servidor reduz logo em seguida, então o que trafega é temporário.
 */
const TAMANHO_MAXIMO_COM_TEXTO = 15 * 1024 * 1024

/**
 * Cria o cliente S3 para Backblaze B2 (lazy initialization)
 */
function criarClienteB2(): S3Client {
  return new S3Client({
    region: process.env.B2_REGION || 'us-east-005',
    endpoint: process.env.NEXT_PUBLIC_B2_ENDPOINT,
    maxAttempts: 3,
    credentials: {
      accessKeyId: process.env.B2_APPLICATION_KEY_ID || '',
      secretAccessKey: process.env.B2_APPLICATION_KEY || '',
    },
    forcePathStyle: true, // Necessário para B2
  })
}

/**
 * Gera um nome único para o arquivo baseado no contexto
 */
function gerarNomeArquivo(pasta: string, id: string, extensao: string): string {
  const timestamp = Date.now()
  const aleatorio = Math.random().toString(36).substring(2, 8)
  return `${pasta}/${id}_${timestamp}_${aleatorio}.${extensao}`
}

/**
 * Extrai a extensão do tipo MIME
 */
function obterExtensao(tipoMime: string): string {
  const mapa: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return mapa[tipoMime] || 'jpg'
}

const CHAVE_IMAGEM_PERMITIDA =
  /^(vitrine|geral|produtos|bebidas|combos|adicionais|depoimentos)\/[a-zA-Z0-9._/ -]+\.(jpe?g|png|webp|gif)$/i

/**
 * Pastas cujas imagens contêm TEXTO e são processadas por Sharp no servidor.
 *
 * O pipeline padrão do projeto comprime no cliente por Canvas
 * (`servicoUploadImagem.ts`): 800px no lado maior e JPEG a 70%. Isso é adequado
 * para miniatura de produto e destrutivo para print de conversa — 800px torna a
 * letra ilegível, e o subsampling de croma do JPEG borra a borda do texto.
 *
 * Aqui a imagem chega íntegra e é reprocessada com parâmetros pensados para
 * leitura, sem tocar no caminho já usado pelas outras pastas.
 */
const PASTAS_COM_TEXTO = new Set(['depoimentos'])

/** Lado maior. Cobre a largura de um print de celular moderno sem exagero. */
const DIMENSAO_MAXIMA_TEXTO = 1080

/**
 * Qualidade alta com `smartSubsample`: o subsampling de croma padrão descarta
 * informação de cor e é justamente o que transforma texto pequeno em borrão.
 * O modo esperto do WebP preserva a borda da letra, e a 90 o arquivo ainda sai
 * bem menor que o PNG que o celular gera.
 */
const QUALIDADE_TEXTO = 90

type ImagemProcessada = {
  buffer: Uint8Array
  tipoMime: string
  extensao: string
}

/**
 * Reprocessa a imagem preservando legibilidade. `rotate()` sem argumento aplica
 * a orientação do EXIF — sem isso, print tirado com o aparelho deitado chega
 * girado no site.
 */
async function processarImagemComTexto(entrada: Uint8Array): Promise<ImagemProcessada> {
  const buffer = await sharp(entrada)
    .rotate()
    .resize({
      width: DIMENSAO_MAXIMA_TEXTO,
      height: DIMENSAO_MAXIMA_TEXTO,
      fit: 'inside',
      // Não amplia imagem pequena: aumentar não cria detalhe, só peso.
      withoutEnlargement: true,
    })
    .webp({ quality: QUALIDADE_TEXTO, smartSubsample: true, effort: 5 })
    .toBuffer()

  return { buffer, tipoMime: 'image/webp', extensao: 'webp' }
}

const CACHE_IMAGEM_PUBLICA =
  'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800, immutable'

/**
 * Redimensiona e converte para WebP.
 *
 * Devolve `null` — e não lança — quando o `sharp` não dá conta do arquivo. Esta
 * rota nasceu para absorver o 503 transitório do Backblaze; ela não pode passar
 * a quebrar por causa da otimização. Falhou, serve o original.
 */
async function otimizarImagem(
  original: Buffer,
  tipoOrigem: string,
  largura: number,
  qualidade: number,
): Promise<{ buffer: Buffer; tipoMime: string } | null> {
  if (!deveConverter(tipoOrigem)) return null

  try {
    const fonte = sharp(original)
    const { width } = await fonte.metadata()
    const buffer = await fonte
      .rotate()
      .resize({
        width: larguraDeSaida(largura, width),
        // Ampliar não cria detalhe, só peso.
        withoutEnlargement: true,
      })
      .webp({ quality: qualidade })
      .toBuffer()

    return { buffer, tipoMime: 'image/webp' }
  } catch {
    return null
  }
}

/**
 * GET - Serve imagens públicas do B2 pela mesma origem.
 *
 * Aceita `w` e `q`. Antes os dois eram ignorados: o loader do Next montava um
 * `srcset` de 15 larguras por imagem e as 15 devolviam o mesmo arquivo em
 * tamanho cheio, cada uma ocupando uma chave de cache diferente. Em produção
 * isso significava dois banners de 1,9 MB e 1,15 MB chegando inteiros num
 * aparelho de 390 px, e foto de produto lenta justamente na largura que ainda
 * não estava quente no CDN.
 *
 * `w` só é aceito dentro da lista fechada de `dimensoes-imagem.mjs`; fora dela
 * o original é servido, para largura arbitrária não abrir chave de cache nova.
 *
 * Spec: specs/desempenho-catalogo-mobile.md
 */
export async function GET(requisicao: NextRequest) {
  try {
    const parametros = new URL(requisicao.url).searchParams
    const nomeArquivo = parametros.get('arquivo') || ''
    if (!CHAVE_IMAGEM_PERMITIDA.test(nomeArquivo) || nomeArquivo.includes('..')) {
      return NextResponse.json({ erro: 'Arquivo inválido' }, { status: 400 })
    }

    const resposta = await criarClienteB2().send(new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_B2_BUCKET_NAME || 'derick-mackenzie',
      Key: nomeArquivo,
    }))

    if (!resposta.Body || (resposta.ContentLength || 0) > TAMANHO_MAXIMO) {
      return NextResponse.json({ erro: 'Imagem indisponível para edição' }, { status: 422 })
    }

    const original = Buffer.from(await resposta.Body.transformToByteArray())
    const tipoOrigem = resposta.ContentType || 'application/octet-stream'
    const largura = normalizarLargura(parametros.get('w'))

    /*
      O tipo declarado pelo bucket não é confiável: dois banners estão gravados
      com `Content-Type: image/webp` e bytes que começam em `\x89PNG`, porque o
      upload afirmava WebP sem conferir o que o canvas devolveu. Quem decide o
      formato de saída aqui é o `sharp`, lendo os bytes.
    */
    const otimizada = largura
      ? await otimizarImagem(
          original,
          tipoOrigem,
          largura,
          normalizarQualidade(parametros.get('q')),
        )
      : null

    // `Uint8Array` explícito: `BodyInit` não aceita o `Buffer<ArrayBufferLike>`
    // que o `sharp` devolve.
    const corpo = new Uint8Array(otimizada ? otimizada.buffer : original)

    return new NextResponse(corpo, {
      headers: {
        'Content-Type': otimizada ? otimizada.tipoMime : tipoOrigem,
        'Cache-Control': CACHE_IMAGEM_PUBLICA,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ erro: 'Não foi possível carregar a imagem' }, { status: 404 })
  }
}

/**
 * POST - Faz upload de uma imagem para o Backblaze B2
 */
export async function POST(requisicao: NextRequest) {
  try {
    const urlPublicaB2 = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || ''
    const nomeBucket = process.env.NEXT_PUBLIC_B2_BUCKET_NAME || 'derick-mackenzie'

    // Verifica se as credenciais estão configuradas
    if (!process.env.NEXT_PUBLIC_B2_ENDPOINT || !process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
      console.error('Credenciais do B2 não configuradas:', {
        endpoint: !!process.env.NEXT_PUBLIC_B2_ENDPOINT,
        keyId: !!process.env.B2_APPLICATION_KEY_ID,
        key: !!process.env.B2_APPLICATION_KEY,
      })
      return NextResponse.json(
        { erro: 'Serviço de armazenamento não configurado corretamente' },
        { status: 500 }
      )
    }

    if (!urlPublicaB2) {
      console.error('URL pública do B2 não configurada')
      return NextResponse.json(
        { erro: 'URL pública do B2 não configurada' },
        { status: 500 }
      )
    }

    const formData = await requisicao.formData()
    const arquivo = formData.get('arquivo') as File | null
    const pasta = (formData.get('pasta') as string) || 'geral'
    const id = (formData.get('id') as string) || 'arquivo'

    if (!arquivo) {
      return NextResponse.json(
        { erro: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Validação do tipo de arquivo
    if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
      return NextResponse.json(
        { erro: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.' },
        { status: 400 }
      )
    }

    // Validação do tamanho
    const limiteTamanho = PASTAS_COM_TEXTO.has(pasta) ? TAMANHO_MAXIMO_COM_TEXTO : TAMANHO_MAXIMO
    if (arquivo.size > limiteTamanho) {
      const limiteMb = Math.round(limiteTamanho / (1024 * 1024))
      return NextResponse.json(
        { erro: `Arquivo muito grande. O tamanho máximo é ${limiteMb}MB.` },
        { status: 400 }
      )
    }

    // Converte o arquivo para buffer
    const arrayBuffer = await arquivo.arrayBuffer()
    let buffer: Uint8Array = Buffer.from(arrayBuffer)
    let tipoConteudo = arquivo.type
    let extensao = obterExtensao(arquivo.type)

    if (PASTAS_COM_TEXTO.has(pasta) && arquivo.type !== 'image/gif') {
      try {
        const processada = await processarImagemComTexto(buffer)
        buffer = processada.buffer
        tipoConteudo = processada.tipoMime
        extensao = processada.extensao
      } catch (erroProcessamento) {
        // Falhar o processamento não pode custar o upload: segue com o original,
        // que é maior porém correto.
        console.error('[Upload] Sharp falhou, seguindo com o arquivo original:', erroProcessamento)
      }
    }

    // Gera o nome do arquivo
    const nomeArquivo = gerarNomeArquivo(pasta, id, extensao)

    // Cria cliente B2 (lazy initialization)
    const clienteB2 = criarClienteB2()

    // Faz o upload para o B2
    const comandoUpload = new PutObjectCommand({
      Bucket: nomeBucket,
      Key: nomeArquivo,
      Body: buffer,
      ContentType: tipoConteudo,
      // Cache de 1 ano para imagens (são imutáveis pelo nome único)
      CacheControl: 'public, max-age=31536000, immutable',
    })

    await clienteB2.send(comandoUpload)

    // Monta a URL pública da imagem
    const urlPublica = `${urlPublicaB2}/${nomeArquivo}`

    return NextResponse.json({
      sucesso: true,
      url: urlPublica,
      nomeArquivo,
    })
  } catch (erro) {
    console.error('Erro ao fazer upload para B2:', erro)
    return NextResponse.json(
      { erro: 'Falha ao fazer upload da imagem. Tente novamente.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove uma imagem do Backblaze B2
 */
export async function DELETE(requisicao: NextRequest) {
  try {
    const nomeBucket = process.env.NEXT_PUBLIC_B2_BUCKET_NAME || 'derick-mackenzie'

    // Verifica se as credenciais estão configuradas
    if (!process.env.NEXT_PUBLIC_B2_ENDPOINT || !process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
      return NextResponse.json(
        { erro: 'Serviço de armazenamento não configurado' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(requisicao.url)
    const nomeArquivo = searchParams.get('arquivo')

    if (!nomeArquivo) {
      return NextResponse.json(
        { erro: 'Nome do arquivo não informado' },
        { status: 400 }
      )
    }

    // Cria cliente B2 (lazy initialization)
    const clienteB2 = criarClienteB2()

    // Remove o arquivo do B2
    const comandoDelete = new DeleteObjectCommand({
      Bucket: nomeBucket,
      Key: nomeArquivo,
    })

    await clienteB2.send(comandoDelete)

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Arquivo removido com sucesso',
    })
  } catch (erro) {
    console.error('Erro ao remover arquivo do B2:', erro)
    return NextResponse.json(
      { erro: 'Falha ao remover o arquivo' },
      { status: 500 }
    )
  }
}
