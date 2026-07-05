import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Handbag, Heart, House, Storefront } from "phosphor-react-native";
import { type ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, label as labelToken, space } from "@/lib/theme";
import { AppText } from "./Text";

// Back-compat: the previous floating bar was absolute, so screens padded scroll
// content by this. The Maison bar sits in flow (nav reserves its height), so
// migrated screens don't need it — kept 0 so un-migrated screens don't double-pad.
export const TAB_BAR_BODY = 0;

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;
const ICONS: Record<string, Glyph> = { index: House, shop: Storefront, wishlist: Heart, cart: Handbag };
const LABELS: Record<string, string> = { index: "Home", shop: "Shop", wishlist: "Saved", cart: "Bag" };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Bag has its own full-height checkout footer — no tab bar there (matches the design).
  if (state.routes[state.index]?.name === "cart") return null;
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const Icon = ICONS[route.name] ?? House;
        const tint = focused ? colors.ink : colors.ink40;
        const onPress = () => {
          Haptics.selectionAsync();
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={s.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABELS[route.name] ?? route.name}
          >
            <Icon size={24} color={tint} weight={focused ? "fill" : "regular"} />
            <AppText style={[s.label, { color: tint }]} maxFontSizeMultiplier={1.2}>
              {LABELS[route.name] ?? route.name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md, paddingHorizontal: space.lg },
  tab: { flex: 1, alignItems: "center", gap: space.xs },
  label: { ...labelToken },
});
