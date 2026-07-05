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
import { signIn } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!phone.trim() || !password) {
      setError("Enter your phone and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn({ phone, password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = /invalid login credentials/i.test(e?.message ?? "") ? "Phone or password is incorrect." : e?.message ?? "Couldn't sign in. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: space["3xl"], paddingHorizontal: space.gutter }}>
          <BackButton onPress={() => router.back()} />

          <View style={{ marginTop: space["2xl"] }}>
            <AppText variant="display">Welcome back.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Sign in to track orders and keep your delivery details.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" returnKeyType="next" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secure returnKeyType="go" onSubmitEditing={submit} error={error ?? undefined} />
            <LinkLabel label="Forgot password" color={colors.accent} onPress={() => router.replace("/forgot-password")} />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy} />
          <View style={s.altRow}>
            <AppText variant="bodySoft">New to Borteh?</AppText>
            <LinkLabel label="Create an account" onPress={() => router.replace("/signup")} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  form: { gap: space.lg, marginTop: space["3xl"] },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, gap: space.md, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  altRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
});
