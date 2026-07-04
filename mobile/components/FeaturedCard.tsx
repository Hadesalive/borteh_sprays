import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { noteLine, type Product } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { colors, font, radius, shadow, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Wide featured banner — one cohesive surface, the bottle resting on it, a clear CTA. */
export function FeaturedCard({ product, width }: { product: Product; width: number }) {
  const router = useRouter();
  const notes = noteLine(product);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/product/[slug]", params: { slug: product.slug } })}
      style={({ pressed }) => [s.card, { width }, pressed && { opacity: 0.97 }]}
    >
      <View style={s.text}>
        <AppText style={s.label}>Featured</AppText>
        <AppText style={s.name} numberOfLines={2}>
          {product.name}
        </AppText>
        {notes ? (
          <AppText variant="small" numberOfLines={1} style={s.notes}>
            {notes}
          </AppText>
        ) : null}
        <AppText variant="price" style={s.price}>
          {formatLe(product.fromPriceMinor)}
        </AppText>
        <View style={s.cta}>
          <AppText style={s.ctaTxt}>Shop now</AppText>
          <ArrowRight size={14} color={colors.onInk} weight="bold" />
        </View>
      </View>

      <Image
        source={product.imageUrl ?? undefined}
        style={s.bottle}
        contentFit="contain"
        transition={250}
        cachePolicy="memory-disk"
        recyclingKey={product.id}
        accessibilityLabel={product.name}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { height: 208, borderRadius: radius.xl, backgroundColor: "#EAECEF", flexDirection: "row", padding: space.xl, overflow: "hidden", ...shadow.soft },
  text: { flex: 1, justifyContent: "center", zIndex: 1 },
  label: { fontFamily: font.semibold, fontSize: 12, color: colors.inkSoft, marginBottom: 4 },
  name: { fontFamily: font.bold, fontSize: 23, lineHeight: 27, color: colors.ink, letterSpacing: -0.3 },
  notes: { color: colors.inkSoft, marginTop: 6 },
  price: { fontSize: 16, marginTop: space.sm },
  cta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginTop: space.md, height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.ink },
  ctaTxt: { fontFamily: font.semibold, fontSize: 13, color: colors.onInk },
  bottle: { position: "absolute", right: -6, top: 14, bottom: 14, width: "40%" },
});
