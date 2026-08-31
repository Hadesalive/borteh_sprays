import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircle } from "phosphor-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { RatingBars } from "@/components/RatingBars";
import { StarRow } from "@/components/StarRow";
import { AppText } from "@/components/Text";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { bucketRatings, useReviews } from "@/lib/reviews";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// The full ratings & reviews screen — App Store/Play Store's own split: the
// product page shows a compact average + distribution, this screen (opened
// only when the user asks to "see all") is where the actual written reviews
// live, in full, not clipped to 3.
export default function Reviews() {
  const { productId, productName } = useLocalSearchParams<{ productId: string; productName: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const { data: products } = useProducts();
  const product = useMemo(() => (products ?? []).find((p) => p.id === productId), [products, productId]);
  const { data: reviews } = useReviews(productId);

  const ratingCounts = useMemo(() => bucketRatings(reviews), [reviews]);
  const ratedCount = ratingCounts.reduce((a, b) => a + b, 0);
  const list = reviews ?? [];

  const writeReview = () => router.push(session ? { pathname: "/review", params: { productId: productId!, productName: productName ?? "" } } : "/login");

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + (list.length > 0 ? 96 : space["3xl"]) }}
      >
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Reviews</AppText>
        {productName ? <AppText variant="bodySoft" numberOfLines={1} style={{ marginTop: space.xs }}>{productName}</AppText> : null}

        {product && product.reviews > 0 ? (
          <View style={[s.summary, ratedCount === 0 && s.summaryNoBars]}>
            <View>
              <StarRow rating={product.rating} size={24} />
              <AppText variant="caption" style={{ marginTop: space.xs }}>
                {product.rating.toFixed(1)} · {product.reviews.toLocaleString()} reviews
              </AppText>
            </View>
            {ratedCount > 0 ? (
              <View style={{ flex: 1 }}>
                <RatingBars counts={ratingCounts} />
              </View>
            ) : null}
          </View>
        ) : null}

        {list.length === 0 ? (
          <EmptyState
            inline
            icon={<ChatCircle size={32} color={colors.ink40} weight="regular" />}
            title="No reviews yet."
            body="Be the first to share your thoughts."
            action={<Button title="Write a review" variant="secondary" onPress={writeReview} />}
          />
        ) : (
          list.map((rv) => (
            <View key={rv.id} style={s.reviewItem}>
              <StarRow rating={rv.rating} size={13} />
              <AppText variant="body" style={{ marginTop: space.sm }}>“{rv.body || rv.title || "Lovely scent."}”</AppText>
              <AppText variant="caption" style={{ marginTop: space.sm }}>
                {rv.reviewerName || "Customer"}
                {rv.mine && rv.status !== "published" ? " · pending" : ""}
              </AppText>
            </View>
          ))
        )}
      </ScrollView>

      {/* floating footer — matching the product page's own fixed-CTA pattern,
          so "Write a review" is always reachable, not buried past a long list */}
      {list.length > 0 ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Write a review" variant="secondary" onPress={writeReview} />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  summary: { flexDirection: "row", alignItems: "center", gap: space["2xl"], marginTop: space["2xl"], paddingBottom: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryNoBars: { flexDirection: "column", alignItems: "flex-start" },
  reviewItem: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
