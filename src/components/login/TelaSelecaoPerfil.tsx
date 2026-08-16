'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, UserRound } from 'lucide-react'
import CardPerfilUsuario from './CardPerfilUsuario'
import ModalSenhaLogin from './ModalSenhaLogin'
import TransicaoLogin from './TransicaoLogin'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CHAVE_LOGIN_LEMBRADO,
  lerLoginLembrado,
  montarLoginLembrado,
} from '@/lib/preferencias-login.mjs'
import {
  listarUsuariosPorPapel,
  loginUsuarioSistema,
  type UsuarioSistema,
  type PapelUsuario,
} from '@/lib/autenticacao'

type TelaSelecaoPerfilProps = {
  papel: PapelUsuario
  aoAutenticar: (usuario: UsuarioSistema) => void
  loginHardcoded?: (usuario: string, senha: string) => boolean
  rotaLoginClassico?: string
  /**
   * Substitui a verificação de senha pelo cliente. O Admin passa a rota de
   * sessão, que confere a senha no servidor e emite o cookie assinado; sem
   * isso, nenhuma autorização server-side teria como saber quem entrou.
   * Garçom e entregador não passam nada e seguem no fluxo antigo.
   */
  autenticarNoServidor?: (
    nomeUsuario: string,
    senha: string,
  ) => Promise<{ sucesso: boolean; usuario?: UsuarioSistema; erro?: string }>
  /**
   * Funções cujos perfis aparecem na seleção. O Admin lista administradores
   * **e** atendentes: os dois entram pelo mesmo `/admin`. Omitido, lista só a
   * função da própria tela.
   */
  papeisListados?: PapelUsuario[]
}

const TITULOS_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Painel administrativo',
  // Atendente entra pela mesma tela do administrador: no `/admin`, o que muda
  // é a permissão, não a porta.
  atendente: 'Painel administrativo',
  garcom: 'Área indisponível',
  entregador: 'Painel de entregas',
}

/**
 * Login do Admin.
 *
 * **Direção:** a identidade da loja aplicada a um ambiente noturno — oliva sobre
 * fundo escuro, display em Quiche Sans, texto em Raleway. A versão anterior era
 * preto/zinc com acento **laranja**, herdado do projeto de restaurante: não
 * tinha relação nenhuma com a marca, e era isso que a fazia parecer template.
 *
 * A âncora visual é a **luz oliva atrás da marca** — o mesmo verde do catálogo,
 * agora como fonte de luz. Um efeito só, e o resto em silêncio.
 *
 * O tema escuro vem de `.fortes-fios-site` (globals.css), então cada cor aqui é
 * token: nada de `bg-black`, `zinc-*` ou `laranja-*`.
 *
 * **"Lembrar de mim" guarda o usuário e nunca a senha.** A versão antiga
 * gravava `admin_saved_password` em texto claro no `localStorage`. O que o
 * usuário quer — não redigitar, não relogar — é entregue pelo nome salvo mais o
 * cookie de sessão de 8 horas. Ver `preferencias-login.mjs`.
 */
export default function TelaSelecaoPerfil({
  papel,
  aoAutenticar,
  loginHardcoded,
  rotaLoginClassico,
  autenticarNoServidor,
  papeisListados,
}: TelaSelecaoPerfilProps) {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioSistema | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [loginEmAndamento, setLoginEmAndamento] = useState(false)
  const [modoClassico, setModoClassico] = useState(false)
  const [usuarioClassico, setUsuarioClassico] = useState('')
  const [senhaClassica, setSenhaClassica] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrarUsuario, setLembrarUsuario] = useState(false)
  const [transicaoAtiva, setTransicaoAtiva] = useState(false)
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<UsuarioSistema | null>(null)

  const chavePapeis = (papeisListados ?? [papel]).join(',')

  useEffect(() => {
    const carregarUsuarios = async () => {
      setCarregando(true)
      const lista = await listarUsuariosPorPapel(chavePapeis.split(',') as PapelUsuario[])
      setUsuarios(lista)
      setCarregando(false)
    }
    void carregarUsuarios()
  }, [chavePapeis])

  useEffect(() => {
    try {
      const lembrado = lerLoginLembrado(window.localStorage.getItem(CHAVE_LOGIN_LEMBRADO))
      if (!lembrado.lembrar) return

      setUsuarioClassico(lembrado.nomeUsuario)
      setLembrarUsuario(true)
      // Quem já entrou por credencial volta direto no formulário: o campo vem
      // preenchido, e a lista de perfis seria um desvio.
      setModoClassico(true)
    } catch {
      // Storage bloqueado (navegação privada): segue sem preferência.
    }
  }, [])

  const guardarPreferencia = useCallback((nomeUsuario: string, lembrar: boolean) => {
    try {
      window.localStorage.setItem(
        CHAVE_LOGIN_LEMBRADO,
        JSON.stringify(montarLoginLembrado({ nomeUsuario, lembrar })),
      )
      // Resíduo do modelo antigo, que guardava a senha em texto claro.
      window.localStorage.removeItem('admin_saved_username')
      window.localStorage.removeItem('admin_saved_password')
      window.localStorage.removeItem('admin_remember_me')
    } catch {
      // Sem storage a preferência não persiste, e tudo bem.
    }
  }, [])

  const handleSelecionarPerfil = (usuario: UsuarioSistema) => {
    setUsuarioSelecionado(usuario)
    setErroLogin('')
    setModalAberto(true)
  }

  const iniciarTransicao = useCallback((usuario: UsuarioSistema) => {
    setUsuarioAutenticado(usuario)
    setModalAberto(false)
    setTransicaoAtiva(true)
  }, [])

  const finalizarTransicao = useCallback(() => {
    if (usuarioAutenticado) aoAutenticar(usuarioAutenticado)
  }, [usuarioAutenticado, aoAutenticar])

  const handleLoginPerfil = async (senha: string) => {
    if (!usuarioSelecionado) return
    setLoginEmAndamento(true)
    setErroLogin('')

    const entrar = autenticarNoServidor ?? loginUsuarioSistema
    const resultado = await entrar(usuarioSelecionado.nome_usuario, senha)

    if (resultado.sucesso && resultado.usuario) {
      iniciarTransicao(resultado.usuario)
    } else {
      setErroLogin(resultado.erro || 'Senha incorreta')
    }
    setLoginEmAndamento(false)
  }

  const handleLoginClassico = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!usuarioClassico.trim() || !senhaClassica.trim()) return

    setLoginEmAndamento(true)
    setErroLogin('')

    if (loginHardcoded && loginHardcoded(usuarioClassico, senhaClassica)) {
      guardarPreferencia(usuarioClassico, lembrarUsuario)
      setLoginEmAndamento(false)
      return
    }

    const entrar = autenticarNoServidor ?? loginUsuarioSistema
    const resultado = await entrar(usuarioClassico, senhaClassica)

    if (resultado.sucesso && resultado.usuario) {
      guardarPreferencia(usuarioClassico, lembrarUsuario)
      iniciarTransicao(resultado.usuario)
    } else {
      setErroLogin(resultado.erro || 'Usuário ou senha incorretos')
    }
    setLoginEmAndamento(false)
  }

  return (
    // `fortes-fios-site` traz a paleta oliva da loja; `dark` fixa o ambiente
    // noturno independentemente do tema do sistema — a tela de entrada é a
    // mesma para todo mundo.
    <div className="fortes-fios-site dark relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      {/*
        A âncora: uma única luz oliva atrás da marca. É o verde do catálogo
        virando fonte de luz — e é o que faz a tela ser reconhecível como Fortes
        Fios mesmo sem a logo.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] size-[min(46rem,120vw)] -translate-x-1/2 rounded-full bg-primary/[0.14] blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[8%] size-[min(26rem,70vw)] rounded-full bg-primary/[0.06] blur-[100px]" />
      </div>

      <header className="relative z-10 px-5 pb-8 pt-14 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative size-[68px] overflow-hidden rounded-2xl border border-border/60 shadow-2xl shadow-background/60">
            <Image
              src="/logo.webp"
              alt="Fortes Fios"
              fill
              sizes="68px"
              className="object-cover"
              priority
            />
          </div>

          <div className="space-y-1.5 text-center">
            <h1 className="fortes-display text-[28px] leading-tight text-foreground sm:text-[34px]">
              {TITULOS_PAPEL[papel]}
            </h1>
            <p className="text-sm text-muted-foreground">
              {modoClassico ? 'Entre com suas credenciais' : 'Quem está acessando?'}
            </p>
          </div>
        </motion.div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-12">
        <AnimatePresence mode="wait">
          {carregando ? (
            <motion.div
              key="carregando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-16"
            >
              <Loader2 className="size-6 animate-spin text-primary" strokeWidth={1.8} />
              <p className="text-sm text-muted-foreground">Carregando perfis…</p>
            </motion.div>
          ) : !modoClassico && usuarios.length > 0 ? (
            <motion.div
              key="perfis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-2xl"
            >
              <div className="flex flex-wrap justify-center gap-2 sm:gap-5">
                {usuarios.map((usuario, indice) => (
                  <CardPerfilUsuario
                    key={usuario.id}
                    nome={usuario.nome}
                    papel={usuario.papel}
                    corAvatar={usuario.cor_avatar}
                    avatarUrl={usuario.avatar_url}
                    indice={indice}
                    aoClicar={() => handleSelecionarPerfil(usuario)}
                  />
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex justify-center"
              >
                <button
                  type="button"
                  onClick={() => setModoClassico(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 px-5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Lock className="size-3.5" strokeWidth={1.8} />
                  Entrar com usuário e senha
                </button>
              </motion.div>
            </motion.div>
          ) : !modoClassico ? (
            <motion.div
              key="vazio"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-sm py-10 text-center"
            >
              <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-card">
                <UserRound className="size-7 text-muted-foreground" strokeWidth={1.6} />
              </span>
              <h2 className="fortes-display text-xl text-foreground">Nenhum perfil cadastrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Cadastre acessos no painel, ou entre com usuário e senha.
              </p>
              <Button
                type="button"
                className="mt-7 h-11 w-full"
                onClick={() => setModoClassico(true)}
              >
                Entrar com usuário e senha
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="credenciais"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm"
            >
              <form onSubmit={handleLoginClassico} className="space-y-4">
                <div className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-sm">
                  <AnimatePresence>
                    {erroLogin ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p
                          role="alert"
                          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
                        >
                          {erroLogin}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="login-usuario">Usuário</Label>
                    <Input
                      id="login-usuario"
                      value={usuarioClassico}
                      onChange={(evento) => setUsuarioClassico(evento.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="seu.usuario"
                      className="h-12 border-border/60 bg-background/60 shadow-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-senha">Senha</Label>
                    <div className="relative">
                      <Input
                        id="login-senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senhaClassica}
                        onChange={(evento) => setSenhaClassica(evento.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-12 border-border/60 bg-background/60 pr-12 shadow-none"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((atual) => !atual)}
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        {mostrarSenha ? (
                          <EyeOff className="size-4" strokeWidth={1.8} />
                        ) : (
                          <Eye className="size-4" strokeWidth={1.8} />
                        )}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 pt-0.5">
                    <Checkbox
                      checked={lembrarUsuario}
                      onCheckedChange={(valor) => setLembrarUsuario(valor === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">Lembrar meu usuário</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        Guarda só o nome de acesso neste aparelho. A senha nunca é salva.
                      </span>
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={
                      loginEmAndamento || !usuarioClassico.trim() || !senhaClassica.trim()
                    }
                    className="h-12 w-full text-[15px]"
                  >
                    {loginEmAndamento ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Entrando…
                      </span>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </div>

                {usuarios.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setModoClassico(false)
                      setErroLogin('')
                    }}
                    className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    Escolher um perfil
                  </button>
                ) : null}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 pb-8 text-center">
        <p className="text-xs text-muted-foreground/60">Fortes Fios © 2026</p>
      </footer>

      {usuarioSelecionado ? (
        <ModalSenhaLogin
          usuario={usuarioSelecionado}
          aberto={modalAberto}
          carregando={loginEmAndamento}
          erro={erroLogin}
          aoFechar={() => {
            setModalAberto(false)
            setErroLogin('')
          }}
          aoSubmeter={handleLoginPerfil}
        />
      ) : null}

      {usuarioAutenticado ? (
        <TransicaoLogin
          ativo={transicaoAtiva}
          nome={usuarioAutenticado.nome}
          corAvatar={usuarioAutenticado.cor_avatar}
          avatarUrl={usuarioAutenticado.avatar_url}
          aoFinalizar={finalizarTransicao}
        />
      ) : null}
    </div>
  )
}
