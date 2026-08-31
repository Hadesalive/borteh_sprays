import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Check, Copy, Gift, PaperPlaneTilt, type IconProps, UserPlus, UsersThree } from "phosphor-react-native";
import { type ComponentType, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { useLoyaltyConfig, useMyReferrals, useReferralCode } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { timeAgo } from "@/lib/notifications";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Invite friends — your code, minted server-side, shared through the system
// sheet (WhatsApp is where it'll go in Freetown). Friends enter it when they
// create their account; every signup with your code shows here immediately,
// and their first delivered order pays the configured points.

// Card text/texture at reduced weight needs to fade toward whatever
// `colors.ink` resolves to, not a hardcoded literal — `ink` flips per theme
// (dark on light-mode's light surface, light on dark-mode's dark surface),
// so deriving from it keeps the engraving legible in both.
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The same engraved guilloche the loyalty card and shop-by-note cards carry —
 *  the code is the one object on this screen worth marking as a maison object,
 *  not a plain bordered box. */
function CodeEngraving({ w, h }: { w: number; h: number }) {
  const { colors } = useTheme();
  const maxR = Math.hypot(w, h) + 40;
  const line = withAlpha(colors.ink, 0.05);
  const accentLine = withAlpha(colors.accent, 0.16);
  const rings = Array.from({ length: Math.ceil(maxR / 22) }, (_, i) => (
    <Circle
      key={i}
      cx={w}
      cy={0}
      r={20 + i * 22}
      stroke={i % 9 === 4 ? accentLine : line}
      strokeWidth={1}
      fill="none"
    />
  ));
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="invite-linen" patternUnits="userSpaceOnUse" width={4} height={4}>
          <Line x1={0} y1={4} x2={4} y2={0} stroke={withAlpha(colors.ink, 0.035)} strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#invite-linen)" />
      {rings}
    </Svg>
  );
}

// Icon-tile row — the same grounded pattern as profile.tsx/points.tsx's own
// menu rows (28px ink tile, one tone, inset separator), kept local since this
// screen only needs three static rows, not a shared list component.
function StepRow({ Icon, text, last = false }: { Icon: ComponentType<IconProps>; text: string; last?: boolean }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.stepRow}>
      <View style={s.iconTile}>
        <Icon size={16} color={colors.onInk} weight="regular" />
      </View>
      <AppText variant="body" style={{ flex: 1 }}>{text}</AppText>
      {!last ? <View style={s.rowSeparator} /> : null}
    </View>
  );
}

export default function Invite() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data: code, isLoading } = useReferralCode();
  const { data: cfg } = useLoyaltyConfig();
  const { data: referrals } = useMyReferrals();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const codeCardW = width - space.gutter * 2;

  const rewardPts = cfg?.referralPoints ?? 0;
  const rewardLe = rewardPts * (cfg?.pointValueMinor ?? 0);
  const rewardLine =
    rewardPts > 0
      ? `when their first order arrives, the maison thanks you with ${rewardPts} points${rewardLe > 0 ? `, ${formatLe(rewardLe)} at checkout` : ""}.`
      : "when their first order arrives, the maison thanks you in points.";

  const invites = referrals ?? [];

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = async () => {
    if (!code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(code);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (!code) return;
    Haptics.selectionAsync();
    await Share.share({
      message: `Borteh Sprays: proper fragrances, delivered in Freetown. Use my code ${code} when you sign up.`,
    });
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />

        {!session ? (
          <>
            <AppText variant="heading" style={{ marginTop: space.lg }}>Invite friends</AppText>
            <EmptyState
              inline
              icon={<UsersThree size={32} color={colors.ink40} weight="regular" />}
              title="Sign in to get your code."
              body="Your personal invite code lives with your account."
              action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
            />
          </>
        ) : (
          <>
            {/* one headline serves as this screen's title — no separate
                "Invite friends" nav heading stacked above it */}
            <AppText variant="display" style={{ marginTop: space.lg }}>
              Share the scent.
            </AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
              Give a friend your code: {rewardLine}
            </AppText>

            {/* the code — tap to copy, same engraved motif the loyalty card carries */}
            <Pressable
              onPress={copy}
              disabled={!code}
              style={[s.codeCard, { width: codeCardW }]}
              accessibilityRole="button"
              accessibilityLabel={code ? `Your code ${code}, tap to copy` : "Your code"}
            >
              <CodeEngraving w={codeCardW} h={96} />
              <AppText variant="label" style={{ color: colors.ink60 }}>Your code</AppText>
              {isLoading || !code ? (
                <Skel w={160} h={36} style={{ marginTop: space.sm }} />
              ) : (
                <View style={s.codeRow}>
                  <AppText style={s.code} maxFontSizeMultiplier={1.2}>
                    {code}
                  </AppText>
                  {copied ? (
                    <Check size={20} color={colors.success} weight="bold" />
                  ) : (
                    <Copy size={20} color={colors.ink40} weight="regular" />
                  )}
                </View>
              )}
            </Pressable>

            {/* how it works — icon-tile rows, the same grounded language as
                profile.tsx/points.tsx's own menu groups, not a numbered list */}
            <View style={{ marginTop: space["2xl"] }}>
              <View style={s.groupCard}>
                <StepRow Icon={PaperPlaneTilt} text="Send your code to a friend." />
                <StepRow Icon={UserPlus} text="They enter it when creating their account." />
                <StepRow Icon={Gift} text="Their first delivered order puts the points on your account." last />
              </View>
            </View>

            <Button title="Share your code" onPress={share} disabled={!code} style={{ marginTop: space["3xl"] }} />

            {/* your invites — every signup with the code, ordered or not */}
            {invites.length > 0 ? (
              <View style={s.invites}>
                <AppText variant="label" style={{ color: colors.ink60 }}>
                  Your invites · {invites.length}
                </AppText>
                <View style={{ marginTop: space.xs }}>
                  {invites.map((r, i) => (
                    <View key={`${r.firstName}-${r.joinedAt}-${i}`} style={s.inviteRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="body" numberOfLines={1}>{r.firstName}</AppText>
                        <AppText variant="caption" style={{ marginTop: 2 }}>joined {timeAgo(r.joinedAt)}</AppText>
                      </View>
                      <AppText variant="caption" style={{ color: r.rewarded ? colors.success : colors.ink40 }}>
                        {r.rewarded ? `+${rewardPts > 0 ? rewardPts + " points" : "rewarded"}` : "awaiting first delivery"}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  codeCard: { borderWidth: 1, borderColor: colors.line, padding: space.gutter, marginTop: space["2xl"], alignItems: "center", overflow: "hidden", backgroundColor: colors.surface },
  codeRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  code: { fontFamily: font.serif, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: 1 },
  // icon-tile row group — same profile.tsx/points.tsx menu-row language
  groupCard: { borderWidth: 1, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.surface },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 58, paddingVertical: space.sm, position: "relative" },
  iconTile: { width: 28, height: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  rowSeparator: { position: "absolute", left: space.lg + 28 + space.md, right: space.lg, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  invites: { marginTop: space["3xl"], paddingTop: space["2xl"], borderTopWidth: 1, borderTopColor: colors.line },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
});
