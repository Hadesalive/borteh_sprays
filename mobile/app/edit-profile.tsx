import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field } from "@/components/Field";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { updateProfile, useSession } from "@/lib/auth";
import { colors, font, radius, space } from "@/lib/theme";

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const phone = (session?.user.user_metadata?.phone as string) || "";

  const [name, setName] = useState((session?.user.user_metadata?.display_name as string) || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't save your changes. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
          <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />
          <AppText style={s.title}>Edit profile</AppText>

          <View style={s.form}>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" returnKeyType="done" onSubmitEditing={submit} />

            <View style={{ gap: space.sm }}>
              <AppText style={s.label}>Phone number</AppText>
              <View style={s.readonly}>
                <AppText style={s.readonlyTxt}>{phone || "—"}</AppText>
              </View>
              <AppText style={s.hint}>Your phone is your login — contact us if you need to change it.</AppText>
            </View>

            {error ? <AppText style={s.error}>{error}</AppText> : null}

            <Button title={busy ? "Saving…" : "Save changes"} onPress={submit} disabled={busy} style={{ marginTop: space.lg }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -10, marginBottom: space.sm },
  title: { fontFamily: font.bold, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
  form: { gap: space.lg, marginTop: space["2xl"] },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, letterSpacing: 0.1 },
  readonly: { height: 54, borderRadius: radius.md, backgroundColor: colors.field, justifyContent: "center", paddingHorizontal: space.lg, opacity: 0.7 },
  readonlyTxt: { fontFamily: font.medium, fontSize: 15, color: colors.ink },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.inkMute },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.badge },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  ctaTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
});
