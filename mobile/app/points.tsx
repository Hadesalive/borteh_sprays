import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Coins, Handbag, Package, Trophy, UsersThree } from "phosphor-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { ListRow } from "@/components/ListRow";
import { type LedgerEntry, useLoyalty, useLoyaltyConfig, useLoyaltyLedger, useLoyaltyTiers } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { timeAgo } from "@/lib/notifications";
import { colors, font, space } from "@/lib/theme";

// Points, in full: the balance and its worth, the road to the Loyalty Card
// (real lifetime-spend progress), how points move — all numbers from the live
// config, nothing invented — and every movement in the ledger.

function describe(e: LedgerEntry): string {
  const r = e.reason ?? "";
  if (r.startsWith("referral:")) return "A friend's first order arrived";
  if (r.startsWith("redeem_refund:")) return "Points returned — order cancelled";
  if (r) return r;
  return e.type === "earn" ? "Points earned" : e.type === "redeem" ? "Points redeemed" : "Adjustment";
}

/** Engraved guilloche work for the card face — fine concentric ripples radiating
 *  from two corners, paper-ghost strokes with the occasional bronze ring. Drawn,
 *  not printed: pure line work, no fills, no gradients. */
function CardEngraving({ w, h }: { w: number; h: number }) {
  // Drawn in the card's real pixel units — no viewBox scaling, so the pattern
  // provably reaches every corner regardless of device width.
  const maxR = Math.hypot(w, h) + 48;
  const rings = (cx: number, cy: number, start: number) =>
    Array.from({ length: Math.ceil((maxR - start) / 13) }, (_, i) => (
      <Circle
        key={`${cx}:${cy}:${i}`}
        cx={cx}
        cy={cy}
        r={start + i * 13}
        stroke={i % 5 === 2 ? "rgba(138,83,39,0.32)" : "rgba(250,248,245,0.07)"}
        strokeWidth={1}
        fill="none"
      />
    ));
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* linen ground — fine diagonal hairlines, like laid paper under the engraving */}
      <Defs>
        <Pattern id="linen" patternUnits="userSpaceOnUse" width={4} height={4}>
          <Line x1={0} y1={4} x2={4} y2={0} stroke="rgba(250,248,245,0.05)" strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#linen)" />
      {/* ripples off the top-right corner — full sweep */}
      {rings(w + 16, -22, 34)}
      {/* answering set from the bottom-left, weaving through the first */}
      {rings(-28, h + 30, 30)}
    </Svg>
  );
}

/** The member card — physical-card proportions (1.586:1), ink face, bronze chip,
 *  points where the number lives, holder at the bottom, the maison as the mark. */
function MemberCard({
  name,
  phone,
  points,
  worthMinor,
  tierName,
  loading,
}: {
  name: string;
  phone: string;
  points: number;
  worthMinor: number;
  tierName: string | null;
  loading: boolean;
}) {
  const { width } = useWindowDimensions();
  const w = width - space.gutter * 2;
  const h = Math.round(w / 1.586);
  return (
    <View style={[s.card, { width: w, height: h }]}>
      <CardEngraving w={w} h={h} />
      {/* top: standing + chip */}
      <View style={s.cardTop}>
        <AppText style={s.cardTier} maxFontSizeMultiplier={1}>
          {(tierName ?? "Member").toUpperCase()}
        </AppText>
        <View style={s.chip}>
          <View style={s.chipInner} />
        </View>
      </View>

      {/* middle: the balance is the card number */}
      <View>
        {loading ? (
          <Skel w={120} h={40} />
        ) : (
          <>
            <AppText style={s.cardPoints} maxFontSizeMultiplier={1}>
              {points}
            </AppText>
            <AppText style={s.cardWorth} maxFontSizeMultiplier={1.2}>
              points{worthMinor > 0 ? ` · worth ${formatLe(worthMinor)}` : ""}
            </AppText>
          </>
        )}
      </View>

      {/* bottom: holder + the maison's mark */}
      <View style={s.cardBottom}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText style={s.cardName} numberOfLines={1} maxFontSizeMultiplier={1}>
            {name.toUpperCase()}
          </AppText>
          {phone ? (
            <AppText style={s.cardPhone} numberOfLines={1} maxFontSizeMultiplier={1}>
              {phone}
            </AppText>
          ) : null}
        </View>
        <AppText style={s.cardBrand} maxFontSizeMultiplier={1}>
          Borteh Sprays
        </AppText>
      </View>
    </View>
  );
}

export default function Points() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data: loyalty, isLoading } = useLoyalty();
  const { data: cfg } = useLoyaltyConfig();
  const { data: tiers } = useLoyaltyTiers();
  const { data: ledger } = useLoyaltyLedger();

  const points = loyalty?.points ?? 0;
  const value = points * (cfg?.pointValueMinor ?? 0);
  const entries = ledger ?? [];
  const spend = loyalty?.lifetimeSpendMinor ?? 0;

  // Tier standing: admin-assigned tier wins; otherwise the highest threshold reached.
  const { currentTier, nextTier, progress } = useMemo(() => {
    const list = tiers ?? [];
    const assigned = list.find((t) => t.id === loyalty?.currentTierId) ?? null;
    const reached = [...list].reverse().find((t) => t.thresholdMinor > 0 && spend >= t.thresholdMinor) ?? null;
    const current = assigned ?? reached;
    const next = list.find((t) => t.thresholdMinor > (current?.thresholdMinor ?? 0) && t.thresholdMinor > spend) ?? null;
    const pct = next ? Math.max(0.02, Math.min(1, spend / next.thresholdMinor)) : 0;
    return { currentTier: current, nextTier: next, progress: pct };
  }, [tiers, loyalty?.currentTierId, spend]);

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Points</AppText>

        {!session ? (
          <EmptyState
            inline
            icon={<Coins size={32} color={colors.ink40} weight="regular" />}
            title="Sign in to see your points."
            body="Points collect with every delivered order."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : (
          <>
            {/* the member card — current standing lives on its face */}
            <View style={{ marginTop: space["2xl"] }}>
              <MemberCard
                name={(session.user.user_metadata?.display_name as string) || "Borteh member"}
                phone={(session.user.user_metadata?.phone as string) || ""}
                points={points}
                worthMinor={value}
                tierName={currentTier ? `${currentTier.name} · ${currentTier.discountPercent}% off` : null}
                loading={isLoading}
              />
            </View>

            {/* the road to the next tier */}
            {nextTier ? (
              <View style={s.tierBlock}>
                <View style={s.tierRow}>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {currentTier ? `Next: ${nextTier.name}` : nextTier.name}
                  </AppText>
                  <AppText variant="caption">{nextTier.discountPercent}% off every order</AppText>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <AppText variant="caption" style={{ marginTop: space.sm }}>
                  {formatLe(spend)} of {formatLe(nextTier.thresholdMinor)} spent — {formatLe(Math.max(0, nextTier.thresholdMinor - spend))} to go.
                </AppText>
              </View>
            ) : currentTier ? (
              <AppText variant="caption" style={{ marginTop: space.md }}>
                The house's highest standing — thank you.
              </AppText>
            ) : null}

            {/* where you stand against everyone else */}
            <View style={{ marginTop: space["2xl"] }}>
              <ListRow
                icon={<Trophy size={20} color={colors.ink} weight="regular" />}
                title="Leaderboard"
                value="Top buyers"
                onPress={() => router.push("/leaderboard")}
                borderTop
              />
            </View>

            {/* how points move — live numbers, tappable where it leads somewhere */}
            <AppText variant="label" style={s.eyebrow}>How points work</AppText>
            <View style={{ marginTop: space.xs }}>
              <ListRow
                icon={<Package size={20} color={colors.ink} weight="regular" />}
                title="Every delivered order"
                value={cfg?.earnRate ? `+${Math.round(cfg.earnRate)} per Le 1` : "earns points"}
                arrow={false}
                borderTop
              />
              <ListRow
                icon={<Handbag size={20} color={colors.ink} weight="regular" />}
                title="Spend at checkout"
                value={cfg?.pointValueMinor ? `1 point = ${formatLe(cfg.pointValueMinor)}` : "toggle at checkout"}
                arrow={false}
              />
              <ListRow
                icon={<UsersThree size={20} color={colors.ink} weight="regular" />}
                title="A friend's first delivery"
                value={cfg?.referralPoints ? `+${cfg.referralPoints}` : undefined}
                onPress={() => router.push("/invite")}
              />
            </View>
            {cfg?.expiryDays ? (
              <AppText variant="caption" style={{ marginTop: space.sm }}>
                Points rest for {cfg.expiryDays} days, then expire.
              </AppText>
            ) : null}

            {/* history */}
            <AppText variant="label" style={s.eyebrow}>History</AppText>
            {entries.length === 0 ? (
              <AppText variant="bodySoft" style={{ marginTop: space.md }}>
                Nothing yet — your first delivered order starts the count.
              </AppText>
            ) : (
              <View style={{ marginTop: space.xs }}>
                {entries.map((e) => (
                  <View key={e.id} style={s.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="body" numberOfLines={1}>{describe(e)}</AppText>
                      <AppText variant="caption" style={{ marginTop: 2 }}>{timeAgo(e.createdAt)}</AppText>
                    </View>
                    <AppText variant="body" style={{ color: e.delta > 0 ? colors.success : colors.ink60 }}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </AppText>
                  </View>
                ))}
              </View>
            )}

            {/* spend them */}
            {points > 0 && value > 0 ? (
              <Button title="Spend them" trailing={formatLe(value)} variant="secondary" onPress={() => router.push("/shop")} style={{ marginTop: space["2xl"] }} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const PAPER60 = "rgba(250,248,245,0.65)";
const PAPER40 = "rgba(250,248,245,0.45)";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  // the member card — rounded like the physical object it mimics
  card: { backgroundColor: colors.ink, borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(250,248,245,0.2)", padding: space.xl, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  cardTier: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: PAPER40 },
  chip: { width: 38, height: 28, borderRadius: 6, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  chipInner: { width: 26, height: 16, borderRadius: 3, borderWidth: 1, borderColor: "rgba(34,30,25,0.4)" },
  cardPoints: { fontFamily: font.serif, fontSize: 44, lineHeight: 50, color: colors.paper },
  cardWorth: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: PAPER60, marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.lg },
  cardName: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: colors.paper },
  cardPhone: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: PAPER60, marginTop: 2 },
  cardBrand: { fontFamily: font.serif, fontSize: 18, lineHeight: 22, color: colors.paper },
  tierBlock: { marginTop: space["2xl"], borderWidth: 1, borderColor: colors.line, padding: space.lg },
  tierRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  track: { height: 2, backgroundColor: colors.line, marginTop: space.md },
  fill: { height: 2, backgroundColor: colors.ink },
  eyebrow: { color: colors.ink60, marginTop: space["3xl"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
});
