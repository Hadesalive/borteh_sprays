import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Trash } from "phosphor-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { AppText } from "@/components/Text";
import { deleteAccount, updateProfile, useSession } from "@/lib/auth";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const phone = (session?.user.user_metadata?.phone as string) || "";

  const [name, setName] = useState((session?.user.user_metadata?.display_name as string) || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const confirmDelete = () => {
    Haptics.selectionAsync();
    // Two-tap destructive confirm (Apple 5.1.1(v)). RN Alert is the platform-native pattern.
    Alert.alert(
      "Delete account?",
      "This permanently deletes your Borteh account and personal details. Order records may be kept, without your name, for our records. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await deleteAccount();
              router.replace("/(tabs)");
            } catch {
              setDeleting(false);
              Alert.alert("Couldn't delete account", "Something went wrong. Please try again, or contact us on WhatsApp.");
            }
          },
        },
      ],
    );
  };

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
      <ThemedStatusBar />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
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

          <View style={{ flex: 1, minHeight: space["3xl"] }} />

          <View style={s.danger}>
            <AppText variant="label" style={{ color: colors.ink40, marginBottom: space.sm }}>Danger zone</AppText>
            <Pressable
              onPress={deleting ? undefined : confirmDelete}
              style={s.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Trash size={18} color={colors.error} weight="regular" />
              <AppText variant="label" style={{ color: colors.error }}>{deleting ? "Deleting…" : "Delete account"}</AppText>
            </Pressable>
            <AppText variant="caption" style={s.dangerNote}>
              Deleting is permanent — it removes your account and personal details.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  form: { gap: space.lg, marginTop: space["2xl"] },
  readonly: { height: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: "center", paddingHorizontal: space.lg },
  danger: { paddingTop: space.xl, borderTopWidth: 1, borderColor: colors.line },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 52, borderWidth: 1, borderColor: colors.error, borderRadius: 14, backgroundColor: colors.surface },
  dangerNote: { textAlign: "center", color: colors.ink40, marginTop: space.xs },
});
