// Design tokens — modern monochrome e-commerce (adapted from the "Nam Design" kit).
// Black + white + grey; the product bottles carry the only real color. Encode Sans throughout.

export const colors = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  // Warm-neutral greys (a hair of the brand's amber hue) so fills/beds/lines sit in the same
  // family as the accent and the product stage — not the old cool greys.
  field: "#F2F0EC", // search input / inactive chip / subtle fills
  plinth: "#F6F5F3", // neutral bed behind product photos (matches the detail-page stage)

  ink: "#1A1A1A", // near-black: text, dark buttons, active pill, nav
  inkSoft: "#6B6B6B", // secondary text (~4.9:1 on white — AA)
  inkMute: "#9A9A9A", // icons / decorative only (not text)
  placeholder: "#767676", // ~4.5:1 on white — AA placeholders
  line: "#EBE8E3", // hairlines, dividers, card outlines
  onInk: "#FFFFFF", // text/icons on dark

  rating: "#F5A623", // star
  badge: "#E5484D", // cart notification dot
  link: "#2F6BFF", // review count link (used sparingly)

  // Warm signature — amber/bronze drawn from the oud + gold imagery. Used on primary CTAs,
  // active filters, "see all" links, and the lit product beds. Restrained, never a loud slab.
  accent: "#9A5B2D", // amber-bronze fill — white text passes AA (5.4:1)
  accentSoft: "#F4E8D8", // warm tint for subtle fills
  accentInk: "#7E3F1E", // deep accent for text on light/tinted surfaces (≥7:1 on accentSoft)
  onAccent: "#FFFFFF",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  regular: "EncodeSans_400Regular",
  medium: "EncodeSans_500Medium",
  semibold: "EncodeSans_600SemiBold",
  bold: "EncodeSans_700Bold",
} as const;

export const duration = { fast: 160, base: 240 } as const;

export const shadow = {
  // floating dark pill nav + circular buttons
  nav: { shadowColor: "#1A1A1A", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  soft: { shadowColor: "#1A1A1A", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
} as const;
