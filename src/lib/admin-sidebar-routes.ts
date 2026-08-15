import { ComponentType } from 'react'
import {
  Archive,
  BarChart3,
  BadgePercent,
  Contact,
  CreditCard,
  CalendarRange,
  Landmark,
  LayoutDashboard,
  Layers,
  ImageIcon,
  PlusCircle,
  MapPin,
  Receipt,
  Truck,
  UserCog,
} from 'lucide-react'

export type IconeSidebar = ComponentType<{ className?: string; strokeWidth?: number | string }>

export type ItemSidebarRota = {
  id: string
  texto: string
  path: string
  icone: IconeSidebar
  categoria: string
}

export type GrupoSidebarRota = {
  titulo: string
  itens: ItemSidebarRota[]
}

export type SidebarConfigItem = {
  id: string
  visible: boolean
  category?: string
}

export const GRUPOS_MENU_ADMIN: GrupoSidebarRota[] = [
  {
    titulo: 'Pedidos',
    itens: [
      { id: '/admin/dashboard', texto: 'Visão geral', icone: LayoutDashboard, path: '/admin/dashboard', categoria: 'Pedidos' },
      { id: '/admin/pedidos', texto: 'Pedidos', icone: Receipt, path: '/admin/pedidos', categoria: 'Pedidos' },
      { id: '/admin/pedidos/novo', texto: 'Novo pedido', icone: PlusCircle, path: '/admin/pedidos/novo', categoria: 'Pedidos' },
    ],
  },
  {
    titulo: 'Loja',
    itens: [
      { id: '/admin/formas-pagamento', texto: 'Pagamentos', icone: CreditCard, path: '/admin/formas-pagamento', categoria: 'Loja' },
      { id: '/admin/entregas', texto: 'Entregas', icone: Truck, path: '/admin/entregas', categoria: 'Loja' },
      { id: '/admin/funcionarios', texto: 'Equipe', icone: Contact, path: '/admin/funcionarios', categoria: 'Loja' },
      { id: '/admin/usuarios', texto: 'Clientes e acessos', icone: UserCog, path: '/admin/usuarios', categoria: 'Loja' },
      { id: '/admin/bairros', texto: 'Cidades de entrega', icone: MapPin, path: '/admin/bairros', categoria: 'Loja' },
    ],
  },
  {
    titulo: 'Catálogo',
    itens: [
      { id: '/admin/produtos', texto: 'Produtos e categorias', icone: Layers, path: '/admin/produtos', categoria: 'Catálogo' },
      { id: '/admin/estoque', texto: 'Estoque', icone: Archive, path: '/admin/estoque', categoria: 'Catálogo' },
      { id: '/admin/vitrine', texto: 'Vitrine', icone: ImageIcon, path: '/admin/vitrine', categoria: 'Catálogo' },
      { id: '/admin/cupons', texto: 'Cupons', icone: BadgePercent, path: '/admin/cupons', categoria: 'Catálogo' },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { id: '/admin/financas', texto: 'Finanças', icone: Landmark, path: '/admin/financas', categoria: 'Gestão' },
      { id: '/admin/analise-diaria', texto: 'Análise diária', icone: CalendarRange, path: '/admin/analise-diaria', categoria: 'Gestão' },
      { id: '/admin/relatorios', texto: 'Relatórios', icone: BarChart3, path: '/admin/relatorios', categoria: 'Gestão' },
    ],
  },
]

export const ITENS_MENU_ADMIN: ItemSidebarRota[] = GRUPOS_MENU_ADMIN.flatMap((grupo) => grupo.itens)

export const mapaItensMenuAdmin = () =>
  new Map(ITENS_MENU_ADMIN.map((item) => [item.id, item]))

export const configPadraoSidebar = (): SidebarConfigItem[] =>
  ITENS_MENU_ADMIN.map((item) => ({
    id: item.id,
    visible: true,
    category: item.categoria,
  }))

export const mesclarConfigSidebar = (
  salva: SidebarConfigItem[] | null | undefined,
): { visiveis: GrupoSidebarRota[]; ocultos: ItemSidebarRota[] } => {
  const mapa = mapaItensMenuAdmin()
  const ordenados: { item: ItemSidebarRota; visible: boolean; category: string }[] = []

  if (salva && salva.length > 0) {
    for (const cfg of salva) {
      const matched = mapa.get(cfg.id)
      if (!matched) continue
      ordenados.push({
        item: matched,
        visible: cfg.visible !== false,
        category: (cfg.category?.trim() || matched.categoria),
      })
      mapa.delete(cfg.id)
    }
  }

  Array.from(mapa.values()).forEach((matched) => {
    ordenados.push({
      item: matched,
      visible: true,
      category: matched.categoria,
    })
  })

  const categorias = Array.from(new Set(ordenados.map((entry) => entry.category)))
  const visiveis: GrupoSidebarRota[] = categorias
    .map((titulo) => ({
      titulo,
      itens: ordenados
        .filter((entry) => entry.category === titulo && entry.visible)
        .map((entry) => ({ ...entry.item, categoria: titulo })),
    }))
    .filter((grupo) => grupo.itens.length > 0)

  const ocultos = ordenados
    .filter((entry) => !entry.visible)
    .map((entry) => entry.item)

  return { visiveis, ocultos }
}

export const isRotaAtivaSidebar = (path: string, pathname: string | null | undefined) => {
  if (!pathname) return false
  if (pathname === path) return true
  if (!pathname.startsWith(`${path}/`)) return false
  const temFilhoMaisEspecifico = ITENS_MENU_ADMIN.some(
    (outro) =>
      outro.path !== path &&
      outro.path.startsWith(`${path}/`) &&
      (pathname === outro.path || pathname.startsWith(`${outro.path}/`)),
  )
  return !temFilhoMaisEspecifico
}
