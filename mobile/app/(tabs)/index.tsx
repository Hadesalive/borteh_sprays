import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, GenderFemale, GenderIntersex, GenderMale, SquaresFour } from "phosphor-react-native";
import { type ComponentType, useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandBand } from "@/components/BrandBand";
import { CollectionBand } from "@/components/CollectionBand";
import { DiscountBanner } from "@/components/DiscountBanner";
import { HomeHero } from "@/components/HomeHero";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { ScentBand } from "@/components/ScentBand";
import { HomeSkeleton } from "@/components/Skeleton";
import { TAB_BAR_BODY } from "@/components/TabBar";
import { AppText } from "@/components/Text";
import { Avatar, CategoryChip, SearchButton, SectionHeader } from "@/components/ui";
import { discountPct, type Gender, type Product, useProducts } from "@/lib/api";
import { useRecentlyViewed } from "@/lib/recentlyViewed";
import { colors, font, radius, space } from "@/lib/theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;
const GENDERS: { label: string; gender?: Gender; Icon: Glyph }[] = [
  { label: "All", Icon: SquaresFour },
  { label: "Women", gender: "female", Icon: GenderFemale },
  { label: "Men", gender: "male", Icon: GenderMale },
  { label: "Unisex", gender: "unisex", Icon: GenderIntersex },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, isLoading, refetch, isRefetching } = useProducts();
  const recentSlugs = useRecentlyViewed();

  const products = data ?? [];
  const best = useMemo(() => products.slice(0, 8), [products]); // query already sorts by popularity
  const topRated = useMemo(() => [...products].sort((a, b) => b.rating - a.rating).slice(0, 8), [products]);
  const newArrivals = useMemo(
    () => [...products].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.releaseYear ?? 0) - (a.releaseYear ?? 0)).slice(0, 8),
    [products],
  );
  const recent = useMemo(
    () => recentSlugs.map((sl) => products.find((p) => p.slug === sl)).filter((p): p is Product => !!p).slice(0, 8),
    [recentSlugs, products],
  );
  const maxOff = useMemo(() => products.reduce((m, p) => Math.max(m, discountPct(p)), 0), [products]);

  const heroW = width - space.xl * 2;
  const railW = Math.round(width * 0.46);
  const railH = Math.round(railW * 1.2);

  const toShop = () => router.push("/shop");

  // First cold load — show a skeleton instead of an empty feed
  if (isLoading && products.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <HomeSkeleton topInset={insets.top} heroW={heroW} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + TAB_BAR_BODY + space["3xl"] }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.inkMute} colors={[colors.accent]} />}
      >
        {/* header */}
        <View style={s.header}>
          <View>
            <AppText variant="name">Borteh Sprays</AppText>
            <AppText variant="greeting" style={{ marginTop: 3 }}>
              Perfume house · Freetown
            </AppText>
          </View>
          <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Account">
            <Avatar />
          </Pressable>
        </View>

        <Reveal delay={0} style={s.block}>
          <SearchButton onPress={() => router.push("/search")} />
        </Reveal>

        <Reveal delay={70} style={{ marginTop: space.lg }}>
          <HomeHero width={heroW} />
        </Reveal>

        {/* ORIENT — quick entry by who it's for */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chips}>
          {GENDERS.map((g) => (
            <CategoryChip
              key={g.label}
              label={g.label}
              icon={<g.Icon size={15} color={colors.ink} weight="regular" />}
              onPress={() => router.push(g.gender ? { pathname: "/shop", params: { gender: g.gender } } : "/shop")}
            />
          ))}
        </ScrollView>

        {/* CONVERT — deals first, then lead with social proof, then freshness */}
        {maxOff > 0 ? <DiscountBanner percent={maxOff} /> : null}

        {best.length > 0 ? (
          <Reveal delay={140}>
            <SectionHeader title="Best sellers" trailing="See all" onPressTrailing={toShop} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {best.map((p) => (
                <ProductCard key={p.id} product={p} width={railW} imageHeight={railH} />
              ))}
            </ScrollView>
          </Reveal>
        ) : null}

        {newArrivals.length > 0 ? (
          <>
            <SectionHeader title="New arrivals" trailing="See all" onPressTrailing={toShop} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} width={railW} imageHeight={railH} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* EXPLORE — the ways to shop, grouped */}
        <SectionHeader title="Shop by scent" />
        <ScentBand />

        <SectionHeader title="Collections" />
        <CollectionBand />

        <SectionHeader title="Shop by brand" />
        <BrandBand />

        {/* CONTINUE — personalization, then secondary proof */}
        {recent.length > 0 ? (
          <>
            <SectionHeader title="Recently viewed" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {recent.map((p) => (
                <ProductCard key={p.id} product={p} width={railW} imageHeight={railH} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {topRated.length > 0 ? (
          <>
            <SectionHeader title="Top rated" trailing="See all" onPressTrailing={toShop} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
              {topRated.map((p) => (
                <ProductCard key={p.id} product={p} width={railW} imageHeight={railH} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* end of feed — quiet catch-all into Shop */}
        <Pressable style={s.browse} onPress={toShop} accessibilityRole="button" accessibilityLabel="Browse all fragrances">
          <AppText style={s.browseTxt}>Browse all fragrances</AppText>
          <ArrowRight size={17} color={colors.inkSoft} weight="bold" />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, marginBottom: space.lg },
  block: { paddingHorizontal: space.xl },
  chips: { paddingHorizontal: space.xl, gap: space.sm, paddingVertical: space.lg },
  rail: { paddingHorizontal: space.xl, gap: space.md },
  browse: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: space.xl, marginTop: space["2xl"], height: 54, borderRadius: radius.md, backgroundColor: colors.field },
  browseTxt: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
});

