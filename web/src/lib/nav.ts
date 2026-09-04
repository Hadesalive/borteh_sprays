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
  /** Optional static count shown as a sidebar badge. Prefer badgeCountFor
   *  for anything that should reflect live data — see that function. */
  badge?: number;
};

// Daily-driver destinations — the things the owner touches every shift.
export const primaryNav: NavItem[] = [
  { title: "Overview", href: "/", icon: SquaresFour },
  { title: "Orders", href: "/orders", icon: ShoppingBag },
  { title: "Dispatch", href: "/dispatch", icon: Truck },
  { title: "Point of sale", href: "/pos", icon: Barcode },
];

// Catalog & merchandising — what the shop sells and how the app shows it.
export const catalogNav: NavItem[] = [
  { title: "Products", href: "/products", icon: Drop },
  { title: "Inventory", href: "/inventory", icon: Package },
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

export type BadgeCounts = {
  pending_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  out_for_delivery_count: number;
};

/**
 * Live sidebar badge counts, replacing the hardcoded literals this file
 * used to carry. Returns undefined (not 0) for both "no badge defined for
 * this route" and "the count is zero" — a badge that can read "0" is worse
 * than no badge, since it invites a glance that finds nothing wrong.
 */
export function badgeCountFor(href: string, counts: BadgeCounts): number | undefined {
  const n = (() => {
    switch (href) {
      case "/orders":
        return counts.pending_count;
      case "/inventory":
        return counts.low_stock_count + counts.out_of_stock_count;
      case "/dispatch":
        return counts.out_for_delivery_count;
      default:
        return undefined;
    }
  })();
  return n && n > 0 ? n : undefined;
}
