import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { ScentPicker } from "@/components/ScentPicker";
import { AppText } from "@/components/Text";
import { useSession } from "@/lib/auth";
import { fetchScentPrefs, saveScentPrefs, type ScentPrefs } from "@/lib/scentPrefs";
import { colors, space } from "@/lib/theme";

export default function ScentPreferences() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const qc = useQueryClient();
  const [loaded, setLoaded] = useState(false);
  const [initial, setInitial] = useState<ScentPrefs>({ values: [], gender: null });
  const sel = useRef<ScentPrefs>({ values: [], gender: null });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchScentPrefs().then((p) => {
      setInitial(p);
      sel.current = p;
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveScentPrefs(sel.current.values, sel.current.gender);
      await qc.invalidateQueries({ queryKey: ["picked_for_you"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 120, paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="display" style={{ marginTop: space.lg }}>Scent preferences</AppText>
        <AppText variant="bodySoft" style={{ marginTop: space.xs }}>
          Tune what shows up on your home. Add anything you love — even notes we don't stock yet.
        </AppText>

        {!session ? (
          <View style={{ marginTop: space["3xl"], alignItems: "center" }}>
            <AppText variant="bodySoft" style={{ textAlign: "center" }}>Sign in to save your preferences to your account.</AppText>
            <View style={{ alignSelf: "stretch", marginTop: space.lg }}>
              <Button title="Sign in" onPress={() => router.push("/login")} />
            </View>
          </View>
        ) : loaded ? (
          <View style={{ marginTop: space["2xl"] }}>
            <ScentPicker initialValues={initial.values} initialGender={initial.gender} onChange={(v, g) => { sel.current = { values: v, gender: g }; }} />
          </View>
        ) : null}
      </ScrollView>

      {session && loaded ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title={busy ? "Saving…" : saved ? "Saved" : "Save preferences"} onPress={save} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter, paddingTop: space.lg, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
