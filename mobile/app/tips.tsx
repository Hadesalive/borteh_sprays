import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Coins, Handbag, Heart, type IconProps, Lightbulb, Medal, Phone, Sparkle, UsersThree } from "phosphor-react-native";
import { type ComponentType } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { useTips } from "@/lib/tips";
import { colors, space } from "@/lib/theme";

// "How to use Borteh" — plain-language tips read live from public.tip (owner-editable).
// The stored `icon` string maps to a known Phosphor glyph; anything unknown falls back.

const ICONS: Record<string, ComponentType<IconProps>> = {
  Coins,
  Handbag,
  Medal,
  UsersThree,
  Heart,
  Phone,
  Sparkle,
  Lightbulb,
};

export default function Tips() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: tips, isLoading } = useTips();

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>How to use Borteh</AppText>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          Little things that make the most of your account.
        </AppText>

        {isLoading ? (
          <View style={{ marginTop: space.xl, gap: space.lg }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={s.card}>
                <Skel w={24} h={24} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skel w={180} h={20} />
                  <Skel w={220} h={14} />
                </View>
              </View>
            ))}
          </View>
        ) : (tips ?? []).length === 0 ? (
          <AppText variant="bodySoft" style={{ marginTop: space["2xl"] }}>
            Nothing here yet.
          </AppText>
        ) : (
          <View style={{ marginTop: space.lg }}>
            {(tips ?? []).map((t) => {
              const Icon = (t.icon && ICONS[t.icon]) || Lightbulb;
              return (
                <View key={t.id} style={s.card}>
                  <Icon size={24} color={colors.ink} weight="regular" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="serif20">{t.title}</AppText>
                    <AppText variant="bodySoft" style={{ marginTop: space.xs }}>{t.body}</AppText>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  card: { flexDirection: "row", alignItems: "flex-start", gap: space.lg, paddingVertical: space.xl, borderBottomWidth: 1, borderBottomColor: colors.line },
});
