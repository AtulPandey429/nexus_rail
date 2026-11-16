import {
  BookOpen,
  Bot,
  ClipboardCheck,
  Coins,
  DollarSign,
  LayoutDashboard,
  Layers,
  ListChecks,
  ShoppingCart,
  TrendingUp,
  Vault,
  type LucideIcon,
} from 'lucide-react';

export type AdminNavItem = {
  id: string;
  label: string;
  group: AdminNavGroup;
  icon: LucideIcon;
  href?: string;
};

export type AdminNavGroup =
  | 'Overview'
  | 'Operations'
  | 'Liquidity & assets'
  | 'Intelligence & security';

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  'Overview',
  'Operations',
  'Liquidity & assets',
  'Intelligence & security',
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'Executive overview', group: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & settlements', group: 'Operations', icon: ShoppingCart },
  {
    id: 'fulfillment',
    label: 'Fulfillment queue',
    group: 'Operations',
    icon: ClipboardCheck,
    href: '/admin/orders',
  },
  { id: 'treasury', label: 'Treasury & split', group: 'Operations', icon: DollarSign },
  { id: 'ledger', label: 'AUC & master ledger', group: 'Liquidity & assets', icon: BookOpen },
  { id: 'amm', label: '$NXL protocol AMM', group: 'Liquidity & assets', icon: Coins },
  { id: 'vaults', label: 'Dual-rail vaults', group: 'Liquidity & assets', icon: Vault },
  { id: 'catalog', label: 'Baskets & catalog', group: 'Liquidity & assets', icon: Layers },
  { id: 'rates', label: 'FX & chain oracles', group: 'Intelligence & security', icon: TrendingUp },
  { id: 'agent', label: 'AI settlement desk', group: 'Intelligence & security', icon: Bot },
  { id: 'audit', label: 'Security audit trail', group: 'Intelligence & security', icon: ListChecks },
];

/** Nav variant for the standalone fulfillment route: every item is a link. */
export const FULFILLMENT_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_ITEMS.map((item) =>
  item.href
    ? item
    : { ...item, href: item.id === 'overview' ? '/admin' : `/admin?tab=${item.id}` }
);
