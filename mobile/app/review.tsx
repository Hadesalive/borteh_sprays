import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Star, X } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { useSession } from "@/lib/auth";
import { submitReview } from "@/lib/reviews";
import { colors, font, space } from "@/lib/theme";

export default function WriteReview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const session = useSession();
  const { productId, productName } = useLocalSearchParams<{ productId: string; productName: string }>();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (rating < 1) {
      setError("Tap a star to rate it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const name = (session?.user.user_metadata?.display_name as string) || "Customer";
      await submitReview({ productId: productId!, rating, title, body, reviewerName: name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't submit your review. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
          <View style={s.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={24} color={colors.ink} weight="regular" />
            </Pressable>
          </View>

          <AppText variant="display" style={{ marginTop: space.lg }}>Write a review.</AppText>
          {productName ? <AppText variant="bodySoft" numberOfLines={1} style={{ marginTop: space.xs }}>{productName}</AppText> : null}

          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => { Haptics.selectionAsync(); setRating(n); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}>
                <Star size={32} color={n <= rating ? colors.ink : colors.ink40} weight={n <= rating ? "fill" : "regular"} />
              </Pressable>
            ))}
          </View>

          <View style={s.form}>
            <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Sum it up" autoCapitalize="sentences" />
            <View style={{ gap: space.xs }}>
              <AppText variant="label" style={{ color: colors.ink60 }}>Your review (optional)</AppText>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="How does it smell? How long does it last?"
                placeholderTextColor={colors.ink40}
                multiline
                style={s.textarea}
                textAlignVertical="top"
              />
            </View>
            {error ? <AppText variant="caption" style={{ color: colors.error }}>{error}</AppText> : null}
          </View>

          <Button title={busy ? "Submitting…" : "Submit review"} onPress={submit} disabled={busy} style={{ marginTop: space["2xl"] }} />
          <AppText variant="caption" style={{ textAlign: "center", marginTop: space.md }}>Your review will appear on the fragrance right away.</AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: "row", justifyContent: "flex-end" },
  stars: { flexDirection: "row", gap: space.md, marginTop: space["2xl"] },
  form: { gap: space.lg, marginTop: space["2xl"] },
  textarea: { minHeight: 120, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: space.lg, fontFamily: font.regular, fontSize: 16, color: colors.ink },
});
