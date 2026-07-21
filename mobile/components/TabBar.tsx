import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Handbag, Heart, House, Storefront } from "phosphor-react-native";
import { type ComponentType, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartCount } from "@/lib/cart";
import { colors, label as labelToken, space } from "@/lib/theme";
import { AppText } from "./Text";

// Back-compat: the previous floating bar was absolute, so screens padded scroll
// content by this. The Maison bar sits in flow (nav reserves its height), so
// migrated screens don't need it — kept 0 so un-migrated screens don't double-pad.
export const TAB_BAR_BODY = 0;

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;
const ICONS: Record<string, Glyph> = { index: House, shop: Storefront, wishlist: Heart, cart: Handbag };
const LABELS: Record<string, string> = { index: "Home", shop: "Shop", wishlist: "Saved", cart: "Bag" };

const WRAP_W = 44;
const WRAP_H = 30;

// One tab. The glyph itself carries the active state — a solid ink fill crossfading up from the
// idle grey line with a spring pop. No background chip: the icon is the moment.
function TabItem({
  focused,
  Icon,
  label,
  onPress,
  badgeCount,
}: {
  focused: boolean;
  Icon: Glyph;
  label: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [a, focused]);

  const activeScale = a.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const idleOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      onPress={onPress}
      style={s.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <View style={s.iconWrap}>
        <Animated.View style={[s.glyph, { opacity: idleOpacity }]}>
          <Icon size={25} color={colors.ink40} weight="regular" />
        </Animated.View>
        <Animated.View style={[s.glyph, { opacity: a, transform: [{ scale: activeScale }] }]}>
          <Icon size={25} color={colors.ink} weight="fill" />
        </Animated.View>
        {badgeCount && badgeCount > 0 ? (
          <View style={s.badge}>
            <AppText style={s.badgeText} maxFontSizeMultiplier={1}>
              {badgeCount > 9 ? "9+" : String(badgeCount)}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText style={[s.label, { color: focused ? colors.ink : colors.ink40 }]} maxFontSizeMultiplier={1.2}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  // Bag has its own full-height checkout footer — no tab bar there (matches the design).
  if (state.routes[state.index]?.name === "cart") return null;
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const onPress = () => {
          Haptics.selectionAsync();
          const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TabItem
            key={route.key}
            focused={focused}
            Icon={ICONS[route.name] ?? House}
            label={LABELS[route.name] ?? route.name}
            onPress={onPress}
            badgeCount={route.name === "cart" ? cartCount : 0}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md, paddingHorizontal: space.lg },
  tab: { flex: 1, alignItems: "center", gap: space.xs },
  iconWrap: { width: WRAP_W, height: WRAP_H, alignItems: "center", justifyContent: "center" },
  glyph: { position: "absolute", alignItems: "center", justifyContent: "center" },
  label: { ...labelToken },
  badge: {
    position: "absolute",
    top: -3,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onAccent, fontFamily: labelToken.fontFamily, fontSize: 10, lineHeight: 14 },
});
