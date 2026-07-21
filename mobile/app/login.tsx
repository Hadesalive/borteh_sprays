import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EngravedCrest } from "@/components/EngravedCrest";
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.gutter }}
        >
          <BackButton onPress={() => router.back()} />

          <View style={s.crestWrap}>
            <EngravedCrest />
          </View>
          <View style={{ marginTop: space["2xl"] }}>
            <AppText variant="display">Welcome back.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Sign in to track orders and keep your delivery details.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" returnKeyType="next" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secure returnKeyType="go" onSubmitEditing={submit} error={error ?? undefined} />
            <LinkLabel label="Forgot password" color={colors.accent} onPress={() => router.replace("/forgot-password")} />
          </View>

          {/* Flexible spacer: keeps the button at the bottom when there's room, and collapses so
              the keyboard lifts it right under the form instead of stranding a gap. */}
          <View style={s.spacer} />

          <View style={s.footer}>
            <Button title={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy} />
            <View style={s.altRow}>
              <AppText variant="bodySoft">New to Borteh?</AppText>
              <LinkLabel label="Create an account" onPress={() => router.replace("/signup")} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  crestWrap: { alignItems: "center", marginTop: space["2xl"] },
  form: { gap: space.lg, marginTop: space["3xl"] },
  spacer: { flexGrow: 1, minHeight: space["2xl"] },
  footer: { gap: space.md, paddingTop: space.xl },
  altRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
});
