import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircle, DotsThree } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { ReviewActionsSheet } from "@/components/ReviewActionsSheet";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { RatingBars } from "@/components/RatingBars";
import { StarRow } from "@/components/StarRow";
import { AppText } from "@/components/Text";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { blockUser, bucketRatings, reportReview, Review, ReportReason, useReviews } from "@/lib/reviews";
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

  const qc = useQueryClient();

  const { data: products } = useProducts();
  const product = useMemo(() => (products ?? []).find((p) => p.id === productId), [products, productId]);
  const { data: reviews } = useReviews(productId);

  const ratingCounts = useMemo(() => bucketRatings(reviews), [reviews]);
  const ratedCount = ratingCounts.reduce((a, b) => a + b, 0);
  const list = reviews ?? [];

  const writeReview = () => router.push(session ? { pathname: "/review", params: { productId: productId!, productName: productName ?? "" } } : "/login");

  const refetchReviews = () => qc.invalidateQueries({ queryKey: ["reviews", productId] });

  // Which review's menu is open, and whether we've drilled into the reasons.
  // A sheet rather than Alert.alert: Android caps an alert at three buttons and
  // drops the rest, which would hide two of the four reasons.
  const [menuFor, setMenuFor] = useState<Review | null>(null);
  const [reportingFor, setReportingFor] = useState<Review | null>(null);

  const onMenuChoice = (choice: "report" | "block") => {
    const rv = menuFor;
    setMenuFor(null);
    if (!rv) return;
    if (choice === "report") {
      setReportingFor(rv);
      return;
    }
    Alert.alert("Block this customer?", "You'll stop seeing their reviews. They aren't told.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(rv.userId);
            await refetchReviews();
          } catch (e) {
            Alert.alert("Couldn't block this customer", e instanceof Error ? e.message : "Please try again.");
          }
        },
      },
    ]);
  };

  const onReasonChosen = async (reason: ReportReason) => {
    const rv = reportingFor;
    setReportingFor(null);
    if (!rv) return;
    try {
      await reportReview(rv.id, reason);
      await refetchReviews();
      Alert.alert("Thanks — we'll take a look", "This review is hidden while our staff check it.");
    } catch (e) {
      Alert.alert("Couldn't report this review", e instanceof Error ? e.message : "Please try again.");
    }
  };

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
              <View style={s.reviewHeader}>
                <StarRow rating={rv.rating} size={13} />
                {!rv.mine && session ? (
                  <Pressable
                    onPress={() => setMenuFor(rv)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${rv.reviewerName ?? "this customer"}'s review`}
                  >
                    <DotsThree size={20} color={colors.ink60} weight="bold" />
                  </Pressable>
                ) : null}
              </View>
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

      <ReviewActionsSheet
        visible={!!menuFor}
        title="Review options"
        options={[
          { key: "report", label: "Report review" },
          { key: "block", label: "Block this customer", destructive: true },
        ]}
        onSelect={onMenuChoice}
        onClose={() => setMenuFor(null)}
      />

      <ReviewActionsSheet
        visible={!!reportingFor}
        title="Report review"
        description="Why are you reporting it? It's hidden while our staff check."
        options={[
          { key: "offensive", label: "Offensive or abusive" },
          { key: "spam", label: "Spam or an advert" },
          { key: "irrelevant", label: "Not about this fragrance" },
          { key: "other", label: "Something else" },
        ]}
        onSelect={onReasonChosen}
        onClose={() => setReportingFor(null)}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  summary: { flexDirection: "row", alignItems: "center", gap: space["2xl"], marginTop: space["2xl"], paddingBottom: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryNoBars: { flexDirection: "column", alignItems: "flex-start" },
  reviewItem: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
