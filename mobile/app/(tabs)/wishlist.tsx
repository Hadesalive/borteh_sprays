import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Heart } from "phosphor-react-native";
import { useMemo } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AppText } from "@/components/Text";
import { Avatar, BellButton } from "@/components/ui";
import { productSubline, useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Wishlist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slugs = useWishlist();
  const { data } = useProducts();
  const session = useSession();

  const items = useMemo(
    () => slugs.map((slug) => (data ?? []).find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => p != null),
    [slugs, data],
  );

  if (!slugs.length) {
    return (
      <>
        <StatusBar style="dark" />
        <EmptyState
          icon={<Heart size={32} color={colors.ink40} weight="regular" />}
          title="Nothing saved yet."
          body="Tap the heart on any fragrance to keep it here for later."
          action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
        />
      </>
    );
  }

  const displayName = (session?.user?.user_metadata?.display_name as string | undefined)?.trim() || undefined;
  const initials = displayName?.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || undefined;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: space["3xl"] }}>
        <View style={s.headerRow}>
          <AppText variant="heading">Saved</AppText>
          <View style={s.actions}>
            <BellButton onPress={() => router.push("/orders")} />
            <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Account">
              <Avatar initials={initials} />
            </Pressable>
          </View>
        </View>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          {items.length} {items.length === 1 ? "fragrance" : "fragrances"}
        </AppText>

        <View style={{ marginTop: space.md }}>
          {items.map((p) => (
            <View key={p.slug} style={s.row}>
              <Pressable onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: p.slug } })} style={s.rowMain}>
                <View style={s.thumb}>
                  <Image source={productImage(p)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p.id} />
                </View>
                <View style={s.info}>
                  <AppText variant="serif20" numberOfLines={1}>{p.name}</AppText>
                  <AppText variant="caption" numberOfLines={1} style={{ marginTop: space.xs }}>{productSubline(p)}</AppText>
                  <AppText variant="price" style={{ marginTop: space.sm }}>{formatLe(p.fromPriceMinor)}</AppText>
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
                  toggleWish(p.slug);
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name} from saved`}
              >
                <Heart size={24} color={colors.ink} weight="fill" />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.lg },
  thumb: { width: 96, height: 112, backgroundColor: colors.surface, overflow: "hidden" },
  info: { flex: 1 },
});
