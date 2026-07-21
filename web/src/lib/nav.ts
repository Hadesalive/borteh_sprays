import {
  SquaresFour,
  ShoppingBag,
  Truck,
  Barcode,
  Package,
  Drop,
  Stack,
  Cards,
  Sparkle,
  DeviceMobile,
  ChartLineUp,
  UsersThree,
  GearSix,
  Presentation,
  TextAa,
  type Icon,
} from "@phosphor-icons/react";

export type NavItem = {
  title: string;
  href: string;
  icon: Icon;
  /** Optional count shown as a sidebar badge (e.g. orders needing action). */
  badge?: number;
};

// Daily-driver destinations — the things the owner touches every shift.
export const primaryNav: NavItem[] = [
  { title: "Overview", href: "/", icon: SquaresFour },
  { title: "Orders", href: "/orders", icon: ShoppingBag, badge: 6 },
  { title: "Dispatch", href: "/dispatch", icon: Truck, badge: 3 },
  { title: "Point of sale", href: "/pos", icon: Barcode },
];

// Catalog & merchandising — what the shop sells and how the app shows it.
export const catalogNav: NavItem[] = [
  { title: "Products", href: "/products", icon: Drop },
  { title: "Inventory", href: "/inventory", icon: Package, badge: 4 },
  { title: "Collections", href: "/collections", icon: Stack },
  { title: "Combos", href: "/combos", icon: Cards },
  { title: "Brands", href: "/brands", icon: Sparkle },
  { title: "Storefront", href: "/storefront", icon: DeviceMobile },
];

// App Studio — the mobile app's content: what it says and shows (the CMS).
export const contentNav: NavItem[] = [
  { title: "Onboarding", href: "/content/onboarding", icon: Presentation },
  { title: "App copy", href: "/content/copy", icon: TextAa },
];

// Insight — visited, not lived in.
export const insightNav: NavItem[] = [
  { title: "Analytics", href: "/analytics", icon: ChartLineUp },
  { title: "Customers", href: "/customers", icon: UsersThree },
];

export const settingsItem: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: GearSix,
};

export const allNavItems: NavItem[] = [
  ...primaryNav,
  ...catalogNav,
  ...contentNav,
  ...insightNav,
  settingsItem,
];
