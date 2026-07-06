import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { AppText } from "@/components/Text";
import { ToggleSwitch } from "@/components/ui";
import { useNotifPrefs, useUpdateNotifPref } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { disablePush, enablePush, usePushStatus } from "@/lib/push";
import { colors, space } from "@/lib/theme";

// Notification preferences — two honest switches. Push state is the REAL state
// (permission + saved token via lib/push), not a hopeful flag; offers map to
// notification_preference.marketing_opt_in, which the promo push trigger obeys.

export default function Preferences() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data: prefs } = useNotifPrefs();
  const update = useUpdateNotifPref();
  const pushStatus = usePushStatus();

  const pushOn = pushStatus === "enabled" && (prefs?.pushEnabled ?? false);

  const togglePush = async (on: boolean) => {
    Haptics.selectionAsync();
    if (on) {
      const status = await enablePush(); // prompts if never asked
      if (status === "enabled") update.mutate({ push_enabled: true });
    } else {
      await disablePush();
      update.mutate({ push_enabled: false });
    }
  };

  const pushCaption =
    pushStatus === "unavailable"
      ? "Not available on this device yet."
      : pushStatus === "denied"
        ? "Allow notifications in your phone's Settings first."
        : "Order updates and restock alerts on your lock screen.";

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Notifications</AppText>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          Choose how the maison reaches you.
        </AppText>

        {!session ? (
          <EmptyState
            inline
            title="Sign in first."
            body="Notification preferences live with your account."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : (
          <View style={{ marginTop: space.lg }}>
            <View style={s.row}>
              <View style={s.rowText}>
                <AppText variant="body">Push notifications</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>{pushCaption}</AppText>
              </View>
              <ToggleSwitch value={pushOn} onToggle={togglePush} />
            </View>

            <View style={s.row}>
              <View style={s.rowText}>
                <AppText variant="body">Offers & promotions</AppText>
                <AppText variant="caption" style={{ marginTop: 2 }}>Occasional deals and news. Order updates always arrive.</AppText>
              </View>
              <ToggleSwitch
                value={prefs?.marketingOptIn ?? false}
                onToggle={(v) => {
                  Haptics.selectionAsync();
                  update.mutate({ marketing_opt_in: v });
                }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { flex: 1, minWidth: 0 },
});
