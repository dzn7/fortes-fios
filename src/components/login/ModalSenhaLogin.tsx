'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, X, Loader2, Eye, EyeOff } from 'lucide-react'
import type { UsuarioSistema } from '@/lib/autenticacao'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'

type ModalSenhaLoginProps = {
  usuario: UsuarioSistema
  aberto: boolean
  carregando: boolean
  erro: string
  aoFechar: () => void
  aoSubmeter: (senha: string) => void
}

export default function ModalSenhaLogin({
  usuario,
  aberto,
  carregando,
  erro,
  aoFechar,
  aoSubmeter,
}: ModalSenhaLoginProps) {
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setSenha('')
      setMostrarSenha(false)
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [aberto])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!senha.trim() || carregando) return
    aoSubmeter(senha)
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={(e) => e.target === e.currentTarget && aoFechar()}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl shadow-background/60 backdrop-blur-sm"
          >
            <div className="relative p-7">
              <button
                onClick={aoFechar}
                className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center gap-4 mb-7">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 250 }}
                  className="relative"
                >
                  <AvatarUsuario
                    nome={usuario.nome}
                    src={usuario.avatar_url}
                    cor={usuario.cor_avatar || '#f97316'}
                    className="h-24 w-24 text-3xl shadow-2xl ring-2 ring-white/10"
                  />
                  <div
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-6 rounded-full blur-xl opacity-30"
                    style={{ backgroundColor: usuario.cor_avatar || '#f97316' }}
                  />
                </motion.div>

                <div className="text-center">
                  <h2 className="fortes-display text-xl text-foreground">{usuario.nome}</h2>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {erro && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                        <p role="alert" className="text-[13px] text-destructive">{erro}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-border/60 bg-background/60 pl-10 pr-12 text-sm text-foreground
                             placeholder:text-muted-foreground
                             focus:outline-none focus:ring-2 focus:ring-ring/60
                             transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={carregando || !senha.trim()}
                  className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground
                           transition-colors hover:bg-primary/90
                           disabled:opacity-40 disabled:cursor-not-allowed
                           disabled:opacity-50"
                >
                  {carregando ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
