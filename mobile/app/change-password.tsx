import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { changePassword } from "@/lib/auth";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useThemedStyles } from "@/lib/theme-context";

export default function ChangePassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = useThemedStyles(makeStyles);

  const submit = async () => {
    if (busy) return;
    if (!current || !next || !confirm) {
      setError("Fill in your current and new password.");
      return;
    }
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't change your password. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
          <BackButton onPress={() => router.back()} />

          <View style={{ marginTop: space["2xl"] }}>
            <AppText variant="display">Change password.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Confirm your current password, then set a new one.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Current password" value={current} onChangeText={setCurrent} placeholder="Your current password" secure returnKeyType="next" />
            <Field label="New password" value={next} onChangeText={setNext} placeholder="At least 6 characters" secure returnKeyType="next" />
            <Field
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Type it again"
              secure
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error ?? undefined}
            />
            <Button title={busy ? "Changing…" : "Change password"} onPress={submit} disabled={busy} style={{ marginTop: space.sm }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  form: { gap: space.lg, marginTop: space["2xl"] },
});
