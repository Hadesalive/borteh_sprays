import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { CaretDown, Coins, Handbag, Heart, type IconProps, Lightbulb, Medal, Phone, PhoneCall, Sparkle, UsersThree, WhatsappLogo } from "phosphor-react-native";
import { type ComponentType, useRef, useState } from "react";
import { Animated, LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { useStorePhone, useWhatsAppSupport } from "@/lib/account";
import { useTips } from "@/lib/tips";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Help, restructured as a real support screen, not an editorial tips page:
// a two-up contact tile (WhatsApp / Call, the pair Apple's own Support surfaces
// lead with) up top, then tips collapsed into a grouped list of tappable
// questions instead of a scroll of pre-expanded paragraphs. The FAQ pattern
// Apple's own Settings/Support screens use, so the screen reads as a compact
// list to scan, not a wall of text to read start to finish.

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

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

function TipRow({ title, body, Icon, last }: { title: string; body: string; Icon: ComponentType<IconProps>; last?: boolean }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    ease();
    Animated.timing(rotate, { toValue: open ? 0 : 1, duration: 200, useNativeDriver: true }).start();
    setOpen((v) => !v);
  };

  return (
    <Pressable onPress={toggle} style={s.tipRow} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title}>
      <View style={s.tipIcon}>
        <Icon size={16} color={colors.onInk} weight="regular" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" style={s.tipTitle} numberOfLines={open ? undefined : 1}>{title}</AppText>
        {open ? <AppText variant="bodySoft" style={{ marginTop: space.xs }}>{body}</AppText> : null}
      </View>
      <Animated.View style={{ transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
        <CaretDown size={16} color={colors.ink40} weight="regular" />
      </Animated.View>
      {!last ? <View style={s.tipSeparator} /> : null}
    </Pressable>
  );
}

export default function Tips() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: tips, isLoading } = useTips();
  const { data: storePhone } = useStorePhone();
  const whatsapp = useWhatsAppSupport();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const call = () => {
    if (!storePhone) return;
    Haptics.selectionAsync();
    Linking.openURL(`tel:${storePhone}`).catch(() => {});
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Help</AppText>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          Answers, and a real person if you need one.
        </AppText>

        {whatsapp.available || storePhone ? (
          <View style={s.contactRow}>
            {whatsapp.available ? (
              <Pressable onPress={() => whatsapp.open("Hi! I need some help.")} style={s.contactTile} accessibilityRole="button" accessibilityLabel="Message us on WhatsApp">
                <View style={s.contactIcon}>
                  <WhatsappLogo size={20} color={colors.onInk} weight="fill" />
                </View>
                <AppText variant="label" style={{ marginTop: space.sm }}>WhatsApp</AppText>
              </Pressable>
            ) : null}
            {storePhone ? (
              <Pressable onPress={call} style={s.contactTile} accessibilityRole="button" accessibilityLabel="Call the shop">
                <View style={s.contactIcon}>
                  <PhoneCall size={20} color={colors.onInk} weight="fill" />
                </View>
                <AppText variant="label" style={{ marginTop: space.sm }}>Call</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <AppText variant="label" style={s.tipsLabel}>Good to know</AppText>

        {isLoading ? (
          <View style={[s.groupCard, { padding: space.lg, gap: space.lg }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
                <Skel w={28} h={28} />
                <Skel w={200} h={16} />
              </View>
            ))}
          </View>
        ) : (tips ?? []).length === 0 ? (
          <AppText variant="bodySoft" style={{ marginTop: space.md }}>
            Nothing here yet.
          </AppText>
        ) : (
          <View style={s.groupCard}>
            {(tips ?? []).map((t, i) => {
              const Icon = (t.icon && ICONS[t.icon]) || Lightbulb;
              return <TipRow key={t.id} title={t.title} body={t.body} Icon={Icon} last={i === (tips ?? []).length - 1} />;
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },

  // two-up contact tiles, the pair Apple's own Support surfaces lead with
  contactRow: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  contactTile: { flex: 1, alignItems: "center", paddingVertical: space.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  contactIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },

  tipsLabel: { color: colors.ink60, marginTop: space["2xl"], marginBottom: space.sm },

  // grouped list: one bordered box, inset separators starting after the tile,
  // the same convention profile.tsx/points.tsx use for their own menu groups
  groupCard: { borderWidth: 1, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.surface },
  tipRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 56, paddingVertical: space.md, position: "relative" },
  tipIcon: { width: 28, height: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  tipTitle: { fontFamily: font.medium },
  tipSeparator: { position: "absolute", left: space.lg + 28 + space.md, right: space.lg, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
});
