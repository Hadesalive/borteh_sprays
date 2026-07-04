import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Handbag, Heart, House, Storefront } from "phosphor-react-native";
import { type ComponentType } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartCount } from "@/lib/cart";
import { colors, font, radius, shadow, space } from "@/lib/theme";
import { GlassSurface } from "./Glass";
import { AppText } from "./Text";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const morph = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

// Floating liquid-glass nav pill. Screens pad their scroll content by insets.bottom + TAB_BAR_BODY + a gap.
export const TAB_BAR_BODY = 68;

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;
const ICONS: Record<string, Glyph> = { index: House, shop: Storefront, wishlist: Heart, cart: Handbag };
const LABELS: Record<string, string> = { index: "Home", shop: "Shop", wishlist: "Saved", cart: "Bag" };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  // The cart has its own full-screen checkout footer — the floating bar looks off there.
  if (state.routes[state.index]?.name === "cart") return null;
  return (
    <View style={[s.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <GlassSurface radius={radius.pill} tint="dark" tintColor="rgba(18,18,20,0.5)" intensity={48} style={s.pill}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const Icon = ICONS[route.name] ?? House;
          const showBadge = route.name === "cart" && cartCount > 0;
          const onPress = () => {
            Haptics.selectionAsync();
            const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) {
              morph();
              navigation.navigate(route.name);
            }
          };
          const glyph = (
            <View>
              <Icon size={focused ? 22 : 26} color={focused ? colors.onAccent : "rgba(255,255,255,0.6)"} weight={focused ? "fill" : "regular"} />
              {showBadge ? (
                <View style={[s.badge, focused && s.badgeOnActive]}>
                  <AppText style={s.badgeTxt}>{cartCount > 9 ? "9+" : cartCount}</AppText>
                </View>
              ) : null}
            </View>
          );
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={s.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[route.name] ?? route.name}
            >
              {focused ? (
                <View style={s.active}>
                  {glyph}
                  <AppText style={s.activeLabel}>{LABELS[route.name] ?? route.name}</AppText>
                </View>
              ) : (
                <View style={s.iconOnly}>{glyph}</View>
              )}
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,22,0.10)", // faint base carries the drop shadow
    borderRadius: radius.pill,
    height: TAB_BAR_BODY,
    paddingHorizontal: space.sm,
    ...shadow.nav,
  },
  tab: { alignItems: "center", justifyContent: "center", height: TAB_BAR_BODY, paddingHorizontal: 4 },
  iconOnly: { width: 50, alignItems: "center", justifyContent: "center" },
  active: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 46, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.accent },
  activeLabel: { fontFamily: font.bold, fontSize: 14, color: colors.onAccent, letterSpacing: 0.1 },
  badge: {
    position: "absolute",
    top: -7,
    right: -11,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOnActive: { backgroundColor: colors.onAccent },
  badgeTxt: { fontFamily: font.bold, fontSize: 11, lineHeight: 14, color: colors.onAccent },
});
