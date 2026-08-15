import { ITENS_MENU_ADMIN } from '@/lib/admin-sidebar-routes'
import { ROTAS_ADMIN_REAIS } from './catalogo.mjs'

const rotasDoMenu = ITENS_MENU_ADMIN.map((item) => item.path)

export const rotasMenuSemArtigo = rotasDoMenu.filter(
  (path) => !ROTAS_ADMIN_REAIS.includes(path),
)

export const artigosSemItemDeMenu = ROTAS_ADMIN_REAIS.filter(
  (path) => !rotasDoMenu.includes(path),
)

if (process.env.NODE_ENV !== 'production') {
  if (rotasMenuSemArtigo.length > 0 || artigosSemItemDeMenu.length > 0) {
    console.error('Ajuda desalinhada do menu do Admin', {
      rotasMenuSemArtigo,
      artigosSemItemDeMenu,
    })
  }
}
