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
import { LinkLabel } from "@/components/ui";
import { resetPassword } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!phone.trim() || !name.trim() || !password) {
      setError("Fill in your phone, name and a new password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword({ phone, name, newPassword: password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Couldn't reset your password. Try again.");
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

          <View style={{ marginTop: space["2xl"] }}>
            <AppText variant="display">Reset password.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Confirm your phone and the name on your account, then set a new password.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" returnKeyType="next" />
            <Field label="Name on account" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" returnKeyType="next" />
            <Field label="New password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secure returnKeyType="go" onSubmitEditing={submit} error={error ?? undefined} />
            <Button title={busy ? "Resetting…" : "Reset password"} onPress={submit} disabled={busy} style={{ marginTop: space.sm }} />
          </View>

          <View style={s.altRow}>
            <AppText variant="bodySoft">Remembered it?</AppText>
            <LinkLabel label="Sign in" onPress={() => router.replace("/login")} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  form: { gap: space.lg, marginTop: space["2xl"] },
  altRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, marginTop: space["3xl"] },
});
