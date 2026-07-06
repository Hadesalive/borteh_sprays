import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Editorial empty state — a quiet icon, serif line, and optional action. No spinner, no heavy badge.
 *  `inline` renders it as a block inside an existing screen (under a header) instead of full-screen. */
export function EmptyState({ icon, title, body, action, inline }: { icon?: ReactNode; title: string; body: string; action?: ReactNode; inline?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={inline ? s.inline : [s.wrap, { paddingTop: insets.top }]}>
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
  inline: { alignItems: "center", paddingVertical: space["5xl"], paddingHorizontal: space.gutter },
  body: { marginTop: space.sm, textAlign: "center", maxWidth: 300 },
  action: { alignSelf: "stretch", marginTop: space["2xl"], paddingHorizontal: space["2xl"] },
});
