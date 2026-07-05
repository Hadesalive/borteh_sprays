import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, font } from "@/lib/theme";

// Maison type scale. Serif (Instrument) carries the display; Archivo carries the rest.
// Nothing outside this set — screens pick a variant, not a size.
type Variant =
  // ── serif (Instrument) ──
  | "display" // 32/38 — hero titles
  | "heading" // 24/30 — screen titles, section heads
  | "serif20" // 20/26 — product names, totals, line prices
  // ── Archivo ──
  | "bodyLg" // 16/24 — input text, primary row text
  | "body" // 14/20 — primary body
  | "bodySoft" // 14/20 — secondary copy, descriptions
  | "caption" // 12/16 — metadata
  | "price" // 14/500 — card price
  | "label" // 12 caps 0.08em — buttons, eyebrows, tabs, tags
  // ── back-compat aliases (previous theme → Maison) ──
  | "greeting"
  | "name"
  | "title"
  | "cardTitle"
  | "cardSub"
  | "compare"
  | "chip"
  | "small";

export function AppText({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}

const styles = StyleSheet.create({
  // serif
  display: { fontFamily: font.serif, fontSize: 32, lineHeight: 38, color: colors.ink },
  heading: { fontFamily: font.serif, fontSize: 24, lineHeight: 30, color: colors.ink },
  serif20: { fontFamily: font.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  // Archivo
  bodyLg: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  bodySoft: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.ink60 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.ink60 },
  price: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  label: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", color: colors.ink },
  // aliases → nearest Maison style
  greeting: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: colors.ink60 },
  name: { fontFamily: font.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  title: { fontFamily: font.serif, fontSize: 24, lineHeight: 30, color: colors.ink },
  cardTitle: { fontFamily: font.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  cardSub: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.ink60 },
  compare: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.ink40, textDecorationLine: "line-through" },
  chip: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", color: colors.ink },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.ink60 },
});
