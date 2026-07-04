import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, font } from "@/lib/theme";

type Variant =
  | "greeting"
  | "name"
  | "title"
  | "cardTitle"
  | "cardSub"
  | "price"
  | "compare"
  | "body"
  | "label"
  | "chip"
  | "small";

export function AppText({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles[variant], style]} />;
}

const styles = StyleSheet.create({
  greeting: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  name: { fontFamily: font.bold, fontSize: 22, lineHeight: 27, color: colors.ink, letterSpacing: -0.3 },
  title: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, color: colors.ink, letterSpacing: -0.2 },
  cardTitle: { fontFamily: font.bold, fontSize: 15, lineHeight: 19, color: colors.ink, letterSpacing: -0.1 },
  cardSub: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  price: { fontFamily: font.bold, fontSize: 15, lineHeight: 19, color: colors.ink },
  compare: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.inkMute, textDecorationLine: "line-through" },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 18, color: colors.ink },
  chip: { fontFamily: font.medium, fontSize: 13, lineHeight: 17, color: colors.ink },
  small: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
});
