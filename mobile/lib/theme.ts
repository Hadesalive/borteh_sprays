// Design tokens — "Maison" theme (premium perfume retail, editorial restraint).
// Aesop / Le Labo / SSENSE register: paper + ink + one bronze accent, radius 0,
// no shadows, 1px line borders separate layers. Two faces only: Instrument Serif
// (display) + Archivo (UI/body). Full spec in DESIGN.md.
//
// NOTE ON ALIASES: the app is mid-migration from the previous warm-boutique theme.
// The canonical Maison tokens are at the top; the block marked "back-compat" keeps
// the old names alive (remapped to Maison values) so un-migrated screens keep
// compiling and drift toward the new palette. Migrate a screen → use canonical names.

// ── Light palette — Maison canonical (default) ──────────────────────
export const lightColors = {
  // ── Maison canonical — "cleaner warm" (brighter near-white base, warmth
  //    kept in ink + bronze; surface is a hair deeper so cards separate) ──
  paper: "#FCFBF9", // app background — clean warm-white
  surface: "#EDECE9", // image beds, fills, cards, skeletons — warm greige (separates from paper)
  ink: "#221E19", // text, primary buttons, active nav
  ink60: "#6F675C", // secondary text
  ink40: "#A39A8D", // tertiary, inactive icons, placeholders
  line: "#E6E3DD", // 1px borders, separators (used instead of shadows)
  accent: "#8A5327", // bronze — links, active selection, ONE moment per screen
  success: "#33714D", // functional only (in stock, order placed)
  error: "#A63A2B", // functional only (errors, destructive)
  warning: "#94620D", // functional only (low stock)
  onInk: "#FCFBF9", // text/icons on ink fills

  // ── Back-compat aliases (previous theme → Maison values) ──────────
  // Kept so the 32 files still on old names compile; do not use in new code.
  bg: "#FCFBF9", // → paper
  field: "#EDECE9", // → surface
  plinth: "#EDECE9", // → surface
  inkSoft: "#6F675C", // → ink60
  inkMute: "#A39A8D", // → ink40
  placeholder: "#A39A8D", // → ink40
  rating: "#8A5327", // → accent (bronze; new design shows rating as plain text)
  badge: "#8A5327", // → accent (notification dot)
  link: "#8A5327", // → accent
  accentSoft: "#F3EADD", // soft bronze tint on paper
  accentInk: "#8A5327", // → accent
  onAccent: "#FCFBF9", // → paper (text on accent)
} as const;

// A theme's color set: same keys as the light palette, string values.
export type Colors = { [K in keyof typeof lightColors]: string };

// ── Dark palette — "Inverted Maison" (warm near-black, brightened bronze) ──
// Same keys as lightColors. Functional colors are brightened for legibility on
// dark. `onInk`/`onAccent` flip: ink & accent fills read light/bronze in dark,
// so text on them is the dark paper.
export const darkColors: Colors = {
  // ── Maison canonical ──────────────────────────────────────────────
  paper: "#16130F", // warm near-black app background
  surface: "#211C16", // image beds, fills, skeletons
  ink: "#F2EDE4", // warm off-white text, primary fills
  ink60: "#A8A093", // secondary text
  ink40: "#6E665A", // tertiary, inactive icons, placeholders
  line: "#322B22", // 1px borders, separators
  accent: "#C08A4E", // brightened bronze for contrast on dark
  success: "#5B9E77",
  error: "#E0715F",
  warning: "#C79A3E",
  onInk: "#16130F", // text/icons on (now-light) ink fills

  // ── Back-compat aliases ──────────
  bg: "#16130F", // → paper
  field: "#211C16", // → surface
  plinth: "#211C16", // → surface
  inkSoft: "#A8A093", // → ink60
  inkMute: "#6E665A", // → ink40
  placeholder: "#6E665A", // → ink40
  rating: "#C08A4E", // → accent
  badge: "#C08A4E", // → accent
  link: "#C08A4E", // → accent
  accentSoft: "#2A2019", // soft bronze tint on dark paper
  accentInk: "#C08A4E", // → accent
  onAccent: "#16130F", // dark text on brightened bronze
};

// Back-compat: the static `colors` import resolves to the light palette, so any
// screen not yet migrated to `useTheme()` keeps compiling and rendering (light).
export const colors = lightColors;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // (back-compat; not on the Maison 4-grid)
  "2xl": 24,
  "3xl": 32,
  "4xl": 40, // (back-compat)
  "5xl": 48,
  gutter: 24, // screen edge gutter
} as const;

// Maison is squared — radius 0 everywhere. `pill`/`circle` remain only for
// genuinely round things (avatars, dots, toggle knobs) and back-compat.
export const radius = {
  none: 0,
  sm: 0,
  md: 0,
  lg: 0,
  xl: 0,
  pill: 999,
  circle: 999,
} as const;

export const font = {
  // Archivo — UI / body
  regular: "Archivo_400Regular",
  medium: "Archivo_500Medium",
  semibold: "Archivo_600SemiBold",
  bold: "Archivo_700Bold",
  // Instrument Serif — display
  serif: "InstrumentSerif_400Regular",
  serifItalic: "InstrumentSerif_400Regular_Italic",
} as const;

// The one label treatment: 12px, uppercase, 0.08em tracking (Archivo 600).
export const label = {
  fontFamily: font.semibold,
  fontSize: 12,
  letterSpacing: 0.96, // 0.08em × 12px (RN letterSpacing is in px)
  textTransform: "uppercase",
} as const;

export const duration = { fast: 160, base: 240 } as const;

// Maison has no elevation — layers are separated by 1px `line` borders.
// These remain as empty objects so any lingering `...shadow.x` spread is a no-op
// on un-migrated screens without reintroducing shadows.
export const shadow = {
  nav: {},
  soft: {},
} as const;
