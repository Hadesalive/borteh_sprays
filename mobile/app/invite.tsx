import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { UsersThree } from "phosphor-react-native";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { useLoyaltyConfig, useMyReferrals, useReferralCode } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { timeAgo } from "@/lib/notifications";
import { colors, font, space } from "@/lib/theme";

// Invite friends — your code, minted server-side, shared through the system
// sheet (WhatsApp is where it'll go in Freetown). Friends enter it when they
// create their account; every signup with your code shows here immediately,
// and their first delivered order pays the configured points.

export default function Invite() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data: code, isLoading } = useReferralCode();
  const { data: cfg } = useLoyaltyConfig();
  const { data: referrals } = useMyReferrals();

  const rewardPts = cfg?.referralPoints ?? 0;
  const rewardLe = rewardPts * (cfg?.pointValueMinor ?? 0);
  const rewardLine =
    rewardPts > 0
      ? `when their first order arrives, the maison thanks you with ${rewardPts} points${rewardLe > 0 ? ` — ${formatLe(rewardLe)} at checkout` : ""}.`
      : "when their first order arrives, the maison thanks you in points.";

  const invites = referrals ?? [];

  const share = async () => {
    if (!code) return;
    Haptics.selectionAsync();
    await Share.share({
      message: `Borteh Sprays — proper fragrances, delivered in Freetown. Use my code ${code} when you sign up.`,
    });
  };

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Invite friends</AppText>

        {!session ? (
          <EmptyState
            inline
            icon={<UsersThree size={32} color={colors.ink40} weight="regular" />}
            title="Sign in to get your code."
            body="Your personal invite code lives with your account."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : (
          <>
            <AppText variant="display" style={{ marginTop: space["2xl"] }}>
              Share the scent.
            </AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
              Give a friend your code — {rewardLine}
            </AppText>

            {/* the code */}
            <View style={s.codeCard}>
              <AppText variant="label" style={{ color: colors.ink60 }}>Your code</AppText>
              {isLoading || !code ? (
                <Skel w={160} h={36} style={{ marginTop: space.sm }} />
              ) : (
                <AppText style={s.code} maxFontSizeMultiplier={1.2}>
                  {code}
                </AppText>
              )}
            </View>

            {/* how it works — three quiet lines, no chrome */}
            <View style={{ marginTop: space["2xl"] }}>
              <View style={s.step}>
                <AppText variant="caption" style={s.stepNum}>1</AppText>
                <AppText variant="bodySoft" style={{ flex: 1 }}>Send your code to a friend.</AppText>
              </View>
              <View style={s.step}>
                <AppText variant="caption" style={s.stepNum}>2</AppText>
                <AppText variant="bodySoft" style={{ flex: 1 }}>They enter it when creating their account.</AppText>
              </View>
              <View style={s.step}>
                <AppText variant="caption" style={s.stepNum}>3</AppText>
                <AppText variant="bodySoft" style={{ flex: 1 }}>Their first delivered order puts the points on your account.</AppText>
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  codeCard: { borderWidth: 1, borderColor: colors.line, padding: space.gutter, marginTop: space["2xl"], alignItems: "center" },
  code: { fontFamily: font.serif, fontSize: 34, lineHeight: 40, color: colors.ink, marginTop: space.sm, letterSpacing: 1 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: space.sm },
  stepNum: { width: 16, color: colors.accent },
  invites: { marginTop: space["3xl"], paddingTop: space["2xl"], borderTopWidth: 1, borderTopColor: colors.line },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
});
