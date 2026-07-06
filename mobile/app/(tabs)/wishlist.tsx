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
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { HeaderActions } from "@/components/ui";
import { productSubline, useProducts } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { productImage } from "@/lib/productImage";
import { colors, space } from "@/lib/theme";
import { toggleWish, useWishlist } from "@/lib/wishlist";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Skeleton mirroring a saved row — thumb + name/notes/price lines. */
function RowSkeleton() {
  return (
    <View style={s.row}>
      <Skel w={96} h={112} />
      <View style={{ flex: 1 }}>
        <Skel w={150} h={20} />
        <Skel w={110} h={12} style={{ marginTop: space.sm }} />
        <Skel w={70} h={14} style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

export default function Wishlist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slugs = useWishlist();
  const { data, isLoading } = useProducts();

  const items = useMemo(
    () => slugs.map((slug) => (data ?? []).find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => p != null),
    [slugs, data],
  );

  const loading = isLoading && slugs.length > 0 && items.length === 0;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: space["3xl"] }}>
        {/* header — present in every state, like the other tabs */}
        <View style={s.headerRow}>
          <AppText variant="heading">Saved</AppText>
          <HeaderActions />
        </View>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          {loading ? " " : `${items.length} ${items.length === 1 ? "fragrance" : "fragrances"}`}
        </AppText>

        {slugs.length === 0 ? (
          // Never saved anything (or unsaved everything)
          <EmptyState
            inline
            icon={<Heart size={32} color={colors.ink40} weight="regular" />}
            title="Nothing saved yet."
            body="Tap the heart on any fragrance to keep it here for later."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        ) : loading ? (
          // Saves exist but the catalog is still loading — skeletons, not a blank list
          <View style={{ marginTop: space.md }}>
            {slugs.slice(0, 4).map((slug) => (
              <RowSkeleton key={slug} />
            ))}
          </View>
        ) : items.length === 0 ? (
          // Saves exist but none resolve (sold out & removed, or fetch failed)
          <EmptyState
            inline
            icon={<Heart size={32} color={colors.ink40} weight="regular" />}
            title="Your saved scents aren't available."
            body="They may have left the shelf, or the catalog didn't load. Pull to refresh or browse what's in."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        ) : (
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
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.lg },
  thumb: { width: 96, height: 112, backgroundColor: colors.surface, overflow: "hidden" },
  info: { flex: 1 },
});
