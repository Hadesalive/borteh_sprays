import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { BellRinging, CaretRight, CircleHalf, Coins, CreditCard, type IconProps, Lightbulb, MegaphoneSimple, Moon, PencilSimple, Receipt, ShieldCheck, SignOut, Sparkle, Sun, Ticket, Trophy, User, UsersThree, WhatsappLogo } from "phosphor-react-native";
import { type ComponentType } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useLoyalty, useMyCoupons, useWhatsAppSupport } from "@/lib/account";
import { signOut, useAuthReady, useSession } from "@/lib/auth";
import { useOrders } from "@/lib/orders";
import { MOMO_LABEL } from "@/lib/payments";
import { useDefaultPayment } from "@/lib/paymentPrefs";
import { PRIVACY_POLICY_URL } from "@/lib/urls";
import { useWishlist } from "@/lib/wishlist";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, ThemeScheme, useTheme, useThemedStyles } from "@/lib/theme-context";

// Grounded menu row: an icon on its own tile · medium title · optional value · chevron.
// The tile is the one genuinely useful thing to borrow from Apple's own Settings rows —
// it's what actually reads as "a settings screen" at a glance. One tone only (ink-filled,
// same treatment the avatar above already uses), not Apple's per-row rainbow coding —
// that would mean seven different accent colors on one screen, which breaks the
// "one accent" rule harder than anything else here would.
function Row({ Icon, title, value, onPress, last }: { Icon: ComponentType<IconProps>; title: string; value?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <Pressable style={s.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View style={s.iconTile}>
        <Icon size={16} color={colors.onInk} weight="regular" />
      </View>
      <AppText variant="bodyLg" numberOfLines={1} style={s.rowTitle}>{title}</AppText>
      {value ? <AppText variant="body" numberOfLines={1} style={s.rowValue}>{value}</AppText> : null}
      <CaretRight size={18} color={colors.ink40} weight="regular" />
      {/* Inset separator: starts where the title starts (after the tile), not
          full-bleed edge to edge — the real iOS list convention. */}
      {!last ? <View style={s.rowSeparator} /> : null}
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const ready = useAuthReady();
  const { data: orders } = useOrders();
  const saved = useWishlist();
  const { data: loyalty } = useLoyalty();
  const { data: coupons } = useMyCoupons();
  const whatsapp = useWhatsAppSupport();
  const defaultPayment = useDefaultPayment();
  const { colors, scheme, setScheme } = useTheme();
  const s = useThemedStyles(makeStyles);

  const defaultPaymentLabel = !defaultPayment
    ? undefined
    : defaultPayment.method === "monime" && defaultPayment.momoProvider
      ? MOMO_LABEL[defaultPayment.momoProvider]
      : "Cash on delivery";

  const name = (session?.user.user_metadata?.display_name as string) || "Your account";
  const phone = (session?.user.user_metadata?.phone as string) || "";
  const orderCount = orders?.length ?? 0;
  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => router.back()} />

        {!ready ? null : session ? (
          <>
            {/* member card — identity only */}
            <View style={s.memberCard}>
              <View style={s.avatar}>
                <AppText style={s.avatarTxt} maxFontSizeMultiplier={1}>
                  {name.trim().charAt(0).toUpperCase() || "B"}
                </AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="serif20" numberOfLines={1}>{name}</AppText>
                <AppText variant="bodySoft" numberOfLines={2} style={{ marginTop: 2 }}>
                  {[phone, memberSince ? `member since ${memberSince}` : null].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              <Pressable onPress={() => router.push("/edit-profile")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit profile">
                <PencilSimple size={20} color={colors.ink40} weight="regular" />
              </Pressable>
            </View>

            <AppText variant="label" style={s.groupLabel}>Activity</AppText>
            <View style={s.card}>
              <Row Icon={Receipt} title="Orders" value={orderCount ? String(orderCount) : undefined} onPress={() => router.push("/orders")} />
              <Row Icon={Coins} title="Points" value={String(loyalty?.points ?? 0)} onPress={() => router.push("/points")} last />
            </View>

            <AppText variant="label" style={s.groupLabel}>Rewards</AppText>
            <View style={s.card}>
              <Row Icon={Ticket} title="Coupons" value={coupons?.length ? String(coupons.length) : undefined} onPress={() => router.push("/coupons")} />
              <Row Icon={UsersThree} title="Invite friends" onPress={() => router.push("/invite")} />
              <Row Icon={Trophy} title="Leaderboard" onPress={() => router.push("/leaderboard")} last />
            </View>

            <AppText variant="label" style={s.groupLabel}>Settings</AppText>
            <View style={s.card}>
              <Row Icon={Sparkle} title="Scent profile" onPress={() => router.push("/scent-preferences")} />
              <Row Icon={CreditCard} title="Default payment" value={defaultPaymentLabel} onPress={() => router.push("/default-payment")} />
              <Row Icon={MegaphoneSimple} title="Notices" onPress={() => router.push("/notices")} />
              <Row Icon={BellRinging} title="Notification settings" onPress={() => router.push("/preferences")} last />
            </View>

            <AppText variant="label" style={s.groupLabel}>Appearance</AppText>
            <View style={s.segment}>
              {THEME_OPTIONS.map((opt, i) => {
                const active = scheme === opt.value;
                const Icon = opt.Icon;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { Haptics.selectionAsync(); setScheme(opt.value); }}
                    style={[s.segmentCell, i > 0 && s.segmentDivider, active && s.segmentCellActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label} theme`}
                  >
                    <Icon size={16} color={active ? colors.onInk : colors.ink60} weight="regular" />
                    <AppText variant="label" style={active ? s.segmentTxtActive : s.segmentTxt}>{opt.label}</AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText variant="label" style={s.groupLabel}>Help</AppText>
            <View style={s.card}>
              <Row Icon={Lightbulb} title="Help" onPress={() => router.push("/tips")} />
              {whatsapp.available ? <Row Icon={WhatsappLogo} title="Message us on WhatsApp" onPress={() => whatsapp.open()} /> : null}
              <Row Icon={ShieldCheck} title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} last />
            </View>

            <View style={s.account}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); signOut(); }}
                style={s.acctBtn}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <SignOut size={18} color={colors.ink} weight="regular" />
                <AppText variant="label" style={{ color: colors.ink }}>Sign out</AppText>
              </Pressable>
            </View>

            <AppText style={s.brandmark} maxFontSizeMultiplier={1.1}>Borteh Sprays</AppText>
          </>
        ) : (
          <View style={s.guest}>
            <User size={32} color={colors.ink40} weight="regular" />
            <AppText variant="display" style={{ textAlign: "center", marginTop: space.lg }}>Your account.</AppText>
            <AppText variant="bodySoft" style={s.guestBody}>Sign in to track orders and keep your delivery details.</AppText>
            <View style={{ alignSelf: "stretch", marginTop: space["2xl"] }}>
              <Button title="Sign in" onPress={() => router.push("/login")} />
            </View>
            <View style={s.altRow}>
              <AppText variant="bodySoft">New to Borteh?</AppText>
              <LinkLabel label="Create an account" onPress={() => router.push("/signup")} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const THEME_OPTIONS: { value: ThemeScheme; label: string; Icon: ComponentType<IconProps> }[] = [
  { value: "system", label: "System", Icon: CircleHalf },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },

  // member card — surface fill separates from the clean paper screen. Square
  // (radius 0, was 14) — matches the Maison language used everywhere else now.
  memberCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, backgroundColor: colors.surface },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontFamily: font.serif, fontSize: 24, lineHeight: 30, color: colors.paper },

  // grouped cards — square, hairline border, no elevation
  groupLabel: { color: colors.ink40, marginTop: space["2xl"], marginBottom: space.sm, marginLeft: space.xs },
  card: { borderWidth: 1, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 58, position: "relative" },
  iconTile: { width: 28, height: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  // Inset to start after the tile (28) + its gap (space.md) — not edge to edge.
  rowSeparator: { position: "absolute", left: space.lg + 28 + space.md, right: space.lg, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  rowTitle: { flex: 1, fontFamily: font.medium },
  rowValue: { color: colors.ink60, marginRight: space.sm },

  // appearance segmented control — square, matching the cards above
  segment: { flexDirection: "row", borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  segmentCell: { flex: 1, height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs },
  segmentDivider: { borderLeftWidth: 1, borderColor: colors.line },
  segmentCellActive: { backgroundColor: colors.ink },
  segmentTxt: { color: colors.ink60 },
  segmentTxtActive: { color: colors.onInk },

  // account
  account: { marginTop: space["2xl"], gap: space.md },
  acctBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  brandmark: { fontFamily: font.serifItalic, fontSize: 18, lineHeight: 24, textAlign: "center", color: colors.ink40, marginTop: space["4xl"] },

  // guest
  guest: { alignItems: "center", paddingTop: space["4xl"] },
  guestBody: { textAlign: "center", marginTop: space.sm, maxWidth: 300 },
  altRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl },
});
