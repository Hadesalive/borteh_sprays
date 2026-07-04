import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Star, X } from "phosphor-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field } from "@/components/Field";
import { Button } from "@/components/Button";
import { GlassCircle } from "@/components/Glass";
import { AppText } from "@/components/Text";
import { useSession } from "@/lib/auth";
import { submitReview } from "@/lib/reviews";
import { colors, font, radius, space } from "@/lib/theme";

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
    <View style={s.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
          <View style={s.topRow}>
            <Pressable onPress={() => router.back()} style={s.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <GlassCircle size={40}>
                <X size={20} color={colors.ink} weight="bold" />
              </GlassCircle>
            </Pressable>
          </View>

          <AppText style={s.title}>Write a review</AppText>
          {productName ? (
            <AppText style={s.sub} numberOfLines={1}>
              {productName}
            </AppText>
          ) : null}

          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  Haptics.selectionAsync();
                  setRating(n);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
              >
                <Star size={38} color={n <= rating ? colors.rating : "#E2E2E2"} weight="fill" />
              </Pressable>
            ))}
          </View>

          <View style={s.form}>
            <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="Sum it up" autoCapitalize="sentences" />
            <View style={{ gap: space.sm }}>
              <AppText style={s.label}>Your review (optional)</AppText>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="How does it smell? How long does it last?"
                placeholderTextColor={colors.placeholder}
                multiline
                style={s.textarea}
                textAlignVertical="top"
              />
            </View>
            {error ? <AppText style={s.error}>{error}</AppText> : null}
          </View>

          <Button title={busy ? "Submitting…" : "Submit review"} onPress={submit} disabled={busy} style={{ marginTop: space["2xl"] }} />
          <AppText style={s.note}>Your review will appear on the fragrance right away.</AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: "row", justifyContent: "flex-end" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
  title: { fontFamily: font.bold, fontSize: 26, color: colors.ink, letterSpacing: -0.5, marginTop: space.sm },
  sub: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  stars: { flexDirection: "row", justifyContent: "center", gap: space.md, marginTop: space["2xl"] },
  form: { gap: space.lg, marginTop: space["2xl"] },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, letterSpacing: 0.1 },
  textarea: { minHeight: 120, borderRadius: radius.md, backgroundColor: colors.field, padding: space.lg, fontFamily: font.regular, fontSize: 15, color: colors.ink },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.badge },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: space["2xl"] },
  ctaTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.inkMute, textAlign: "center", marginTop: space.md },
});
