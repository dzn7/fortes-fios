'use client'

import { motion } from 'framer-motion'
import type { PapelUsuario } from '@/lib/autenticacao'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'

/** Só o fundo do avatar sem foto; o resto da tela é token. */
const CORA_AVATAR_PADRAO = '#0296F9'

type CardPerfilUsuarioProps = {
  nome: string
  papel: PapelUsuario
  corAvatar: string
  avatarUrl?: string | null
  indice: number
  aoClicar: () => void
}

export default function CardPerfilUsuario({
  nome,
  corAvatar,
  avatarUrl,
  indice,
  aoClicar,
}: CardPerfilUsuarioProps) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: 0.15 + indice * 0.1,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      onClick={aoClicar}
      className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative">
        <AvatarUsuario
          nome={nome}
          src={avatarUrl}
          cor={corAvatar || CORA_AVATAR_PADRAO}
          className="h-[104px] w-[104px] text-4xl shadow-xl ring-2 ring-transparent transition-all duration-500 group-hover:shadow-2xl group-hover:ring-primary/60 sm:h-[120px] sm:w-[120px] sm:text-5xl"
        />
        <div
          className="absolute -bottom-2 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-40"
          style={{ backgroundColor: corAvatar || CORA_AVATAR_PADRAO }}
        />
      </div>

      <div className="text-center">
        <p className="max-w-[128px] truncate text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground sm:text-[15px]">
          {nome}
        </p>
      </div>
    </motion.button>
  )
}
