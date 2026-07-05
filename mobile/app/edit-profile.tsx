import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { updateProfile, useSession } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

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
    <View style={s.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
          <BackButton onPress={() => router.back()} />
          <AppText variant="heading" style={{ marginTop: space.lg }}>Edit profile</AppText>

          <View style={s.form}>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" returnKeyType="done" onSubmitEditing={submit} error={error ?? undefined} />

            <View style={{ gap: space.xs }}>
              <AppText variant="label" style={{ color: colors.ink60 }}>Phone number</AppText>
              <View style={s.readonly}>
                <AppText variant="bodyLg" style={{ color: colors.ink40 }}>{phone || "—"}</AppText>
              </View>
              <AppText variant="caption">Your phone is your login — contact us if you need to change it.</AppText>
            </View>

            <Button title={busy ? "Saving…" : "Save changes"} onPress={submit} disabled={busy} style={{ marginTop: space.sm }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  form: { gap: space.lg, marginTop: space["2xl"] },
  readonly: { height: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: "center", paddingHorizontal: space.lg },
});
