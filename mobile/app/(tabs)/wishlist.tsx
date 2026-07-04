import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Heart } from "phosphor-react-native";
import { useMemo } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { AppText } from "@/components/Text";
import { TAB_BAR_BODY } from "@/components/TabBar";
import { useProducts } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, font, radius, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Wishlist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slugs = useWishlist();
  const { data } = useProducts();

  const items = useMemo(
    () => slugs.map((slug) => (data ?? []).find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => p != null),
    [slugs, data],
  );

  if (!slugs.length) {
    return (
      <EmptyState
        icon={<Heart size={36} color={colors.inkMute} weight="regular" />}
        title="No saved fragrances"
        body="Tap the heart on any fragrance to keep it here for later."
      />
    );
  }

  return (
    <View style={s.fill}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.xl, paddingBottom: insets.bottom + TAB_BAR_BODY + space["3xl"] }}
      >
        <AppText style={s.title}>Saved</AppText>
        <AppText style={s.count}>
          {items.length} fragrance{items.length === 1 ? "" : "s"}
        </AppText>

        <View style={s.list}>
          {items.map((p, i) => (
            <View key={p.slug} style={[s.row, i > 0 && s.rowBorder]}>
              <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: p.slug } })} style={s.rowMain}>
                <Image source={productImage(p)} style={s.thumb} contentFit="contain" cachePolicy="memory-disk" recyclingKey={p.id} />
                <View style={s.info}>
                  <AppText style={s.brand}>{p.brand}</AppText>
                  <AppText style={s.name} numberOfLines={1}>
                    {p.name}
                  </AppText>
                  <AppText style={s.price}>{formatLe(p.fromPriceMinor)}</AppText>
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
                  toggleWish(p.slug);
                }}
                hitSlop={10}
                style={s.heart}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name} from saved`}
              >
                <Heart size={22} color={colors.badge} weight="fill" />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: -0.5 },
  count: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  list: { marginTop: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.lg },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.plinth },
  info: { flex: 1 },
  brand: { fontFamily: font.regular, fontSize: 12, color: colors.inkSoft },
  name: { fontFamily: font.bold, fontSize: 15, color: colors.ink, letterSpacing: -0.1, marginTop: 1 },
  price: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: space.sm },
  heart: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
