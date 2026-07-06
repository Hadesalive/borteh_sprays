import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { applyReferral, checkReferral } from "@/lib/account";
import { signUp } from "@/lib/auth";
import { colors, space } from "@/lib/theme";

export default function SignUp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [refErr, setRefErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passOk = password.length >= 6;

  const submit = async () => {
    if (busy) return;
    if (!name.trim() || !phone.trim() || !password) {
      setError("Fill in your name, phone and password.");
      return;
    }
    if (!passOk) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setRefErr(null);
    try {
      // Validate the referral BEFORE creating the account — a bad code should
      // never fail silently after the fact.
      if (refCode.trim()) {
        try {
          await checkReferral(refCode);
        } catch (e: any) {
          setRefErr(e?.message ?? "That referral code isn't valid.");
          setBusy(false);
          return;
        }
      }
      await signUp({ name, phone, password });
      if (refCode.trim()) {
        // Account exists either way — but if the apply fails now, SAY so.
        await applyReferral(refCode).catch((e: any) =>
          Alert.alert("Referral not applied", e?.message ?? "The code couldn't be applied."),
        );
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = /already registered|already exists/i.test(e?.message ?? "") ? "An account with this phone already exists." : e?.message ?? "Couldn't create your account. Try again.";
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
            <AppText variant="display">Create your account.</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>Faster checkout, order tracking, and restock alerts.</AppText>
          </View>

          <View style={s.form}>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Aminata Kamara" autoCapitalize="words" returnKeyType="next" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="077 123 456" keyboardType="phone-pad" returnKeyType="next" />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secure
              returnKeyType="next"
              helper={password.length > 0 && passOk ? "6+ characters ✓" : undefined}
              error={error ?? undefined}
            />
            <Field
              label="Referral code · optional"
              value={refCode}
              onChangeText={(t) => {
                setRefCode(t);
                if (refErr) setRefErr(null);
              }}
              placeholder="BOR-XXXXX"
              autoCapitalize="characters"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={refErr ?? undefined}
            />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title={busy ? "Creating account…" : "Create account"} onPress={submit} disabled={busy} />
          <View style={s.altRow}>
            <AppText variant="bodySoft">Already have an account?</AppText>
            <LinkLabel label="Sign in" onPress={() => router.replace("/login")} />
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
