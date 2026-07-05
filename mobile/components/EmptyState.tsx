import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Editorial empty state — a quiet icon, serif line, and optional action. No spinner, no heavy badge. */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      {icon ? <View style={{ marginBottom: space.lg }}>{icon}</View> : null}
      <AppText variant="heading" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText variant="bodySoft" style={s.body}>
        {body}
      </AppText>
      {action ? <View style={s.action}>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: space.gutter },
  body: { marginTop: space.sm, textAlign: "center", maxWidth: 300 },
  action: { alignSelf: "stretch", marginTop: space["2xl"], paddingHorizontal: space["2xl"] },
});
