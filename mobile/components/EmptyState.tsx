import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.badge}>{icon}</View>
      <AppText variant="title" style={{ marginTop: space.xl }}>
        {title}
      </AppText>
      <AppText variant="body" style={s.body}>
        {body}
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.xl },
  badge: { width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.plinth, alignItems: "center", justifyContent: "center" },
  body: { marginTop: 8, textAlign: "center", maxWidth: 280 },
});
