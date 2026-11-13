import {
  BarChart3,
  Barcode,
  BookUser,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '../i18n/translations';

export type ViewKey =
  | 'pos'
  | 'inventory'
  | 'barcode'
  | 'khata'
  | 'invoices'
  | 'reports'
  | 'settings';

export interface NavItem {
  key: ViewKey;
  labelKey: TranslationKey;
  icon: LucideIcon;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'pos', labelKey: 'nav.pos', icon: ShoppingCart, shortcut: 'Alt+1' },
  {
    key: 'inventory',
    labelKey: 'nav.inventory',
    icon: Package,
    shortcut: 'Alt+2',
  },
  {
    key: 'barcode',
    labelKey: 'nav.barcode',
    icon: Barcode,
    shortcut: 'Alt+3',
  },
  { key: 'khata', labelKey: 'nav.khata', icon: BookUser, shortcut: 'Alt+4' },
  {
    key: 'invoices',
    labelKey: 'nav.invoices',
    icon: ReceiptText,
    shortcut: 'Alt+5',
  },
  {
    key: 'reports',
    labelKey: 'nav.reports',
    icon: BarChart3,
    shortcut: 'Alt+6',
  },
  {
    key: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    shortcut: 'Alt+7',
  },
];
