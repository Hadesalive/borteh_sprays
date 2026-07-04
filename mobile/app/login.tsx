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
import { signIn } from "@/lib/auth";
import { colors, font, radius, space } from "@/lib/theme";

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
    <View style={s.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
          <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />

          <View style={s.head}>
            <AppText style={s.title}>Welcome back</AppText>
            <AppText style={s.sub}>Sign in to track orders and save your delivery details.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123456" keyboardType="phone-pad" returnKeyType="next" />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secure returnKeyType="go" onSubmitEditing={submit} />
            {error ? <AppText style={s.error}>{error}</AppText> : null}

            <Pressable onPress={() => router.replace("/forgot-password")} style={s.forgotRow} hitSlop={8} accessibilityRole="button">
              <AppText style={s.forgotLink}>Forgot password?</AppText>
            </Pressable>

            <Button title={busy ? "Signing in…" : "Sign in"} onPress={submit} disabled={busy} style={{ marginTop: space.lg }} />
          </View>

          <Pressable onPress={() => router.replace("/signup")} style={s.altRow} hitSlop={8} accessibilityRole="button">
            <AppText style={s.altTxt}>New to Borteh? </AppText>
            <AppText style={s.altLink}>Create an account</AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -10 },
  head: { marginTop: space["3xl"] },
  title: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, color: colors.ink, letterSpacing: -0.6 },
  sub: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginTop: space.sm },
  form: { gap: space.lg, marginTop: space["3xl"] },
  error: { fontFamily: font.medium, fontSize: 13, color: colors.badge, marginTop: 2 },
  forgotRow: { alignSelf: "flex-end", marginTop: space.xs },
  forgotLink: { fontFamily: font.semibold, fontSize: 14, color: colors.accentInk },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  ctaTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
  altRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: space["4xl"] },
  altTxt: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  altLink: { fontFamily: font.bold, fontSize: 14, color: colors.accentInk },
});
