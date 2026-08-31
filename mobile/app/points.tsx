import { useRouter } from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Coins,
  DotsThree,
  CaretRight,
  Handbag,
  type IconProps,
  Package,
  Trophy,
  UsersThree,
} from "phosphor-react-native";
import { type ComponentType, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { type LedgerEntry, useLoyalty, useLoyaltyConfig, useLoyaltyLedger, useLoyaltyTiers } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { timeAgo } from "@/lib/notifications";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Points, in full: the balance and its worth, the road to the Loyalty Card
// (real lifetime-spend progress), how points move — all numbers from the live
// config, nothing invented — and every movement in the ledger.

function describe(e: LedgerEntry): string {
  const r = e.reason ?? "";
  if (r.startsWith("referral:")) return "A friend's first order arrived";
  if (r.startsWith("redeem_refund:")) return "Points returned: order cancelled";
  if (r) return r;
  return e.type === "earn" ? "Points earned" : e.type === "redeem" ? "Points redeemed" : "Adjustment";
}

// Ledger icon per movement type — earn/redeem read directionally (the same
// up/down language as the delta's own color), expire and adjustment get their
// own quieter marks since neither is really "up" or "down."
function ledgerIcon(type: LedgerEntry["type"]): ComponentType<IconProps> {
  if (type === "earn") return ArrowUp;
  if (type === "redeem") return ArrowDown;
  if (type === "expire") return Clock;
  return DotsThree;
}

/** Engraved guilloche work for the card face — fine concentric ripples radiating
 *  from two corners, paper-ghost strokes with the occasional bronze ring. Drawn,
 *  not printed: pure line work, no fills, no gradients. */
function CardEngraving({ w, h }: { w: number; h: number }) {
  // Drawn in the card's real pixel units — no viewBox scaling, so the pattern
  // provably reaches every corner regardless of device width.
  const maxR = Math.hypot(w, h) + 48;
  // Two independent ring systems (from opposite corners) at a tight 13px gap
  // created a dense moiré crisscross once both overlapped across the whole
  // card — it read as one loud busy pattern instead of a fine engraving.
  // Wider spacing + a rarer, softer bronze accent brings it back to "texture
  // you notice if you look," not the dominant thing on the card.
  const rings = (cx: number, cy: number, start: number) =>
    Array.from({ length: Math.ceil((maxR - start) / 22) }, (_, i) => (
      <Circle
        key={`${cx}:${cy}:${i}`}
        cx={cx}
        cy={cy}
        r={start + i * 22}
        stroke={i % 9 === 4 ? "rgba(138,83,39,0.16)" : "rgba(250,248,245,0.06)"}
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
  w,
  h,
  name,
  phone,
  points,
  worthMinor,
  tierName,
  loading,
}: {
  w: number;
  h: number;
  name: string;
  phone: string;
  points: number;
  worthMinor: number;
  tierName: string | null;
  loading: boolean;
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.card, { width: w, height: h }]}>
      <CardEngraving w={w} h={h} />
      {/* the fold: a dog-eared paper corner, not another rounded-rectangle
          card — two layered triangles (a shadowed under-fold, a lighter catch
          of light on top) so it reads as a physical fold, not a flat wedge. */}
      <View style={s.foldShadow} pointerEvents="none" />
      <View style={s.foldFace} pointerEvents="none" />
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

/** The next tier, peeking from behind the member card — Apple Wallet's own
 *  stacked-card convention: only the top sliver of the card behind shows,
 *  everything else tucked out of sight until it becomes the front card. */
function NextTierPeek({ h, name, discountPercent }: { h: number; name: string; discountPercent: number }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.peekCard, { height: h }]}>
      <View style={s.peekRow}>
        <AppText style={s.peekLabel} numberOfLines={1} maxFontSizeMultiplier={1}>
          NEXT · {name.toUpperCase()}
        </AppText>
        <AppText style={s.peekPct} numberOfLines={1} maxFontSizeMultiplier={1}>
          {discountPercent}% OFF
        </AppText>
      </View>
    </View>
  );
}

// Grounded menu row: an icon on its own tile, medium title, optional value, chevron.
// Exactly profile.tsx's own Row pattern (28px ink-filled tile, colors.onInk icon,
// inset separator starting after the tile) — kept local to this screen rather than
// changed in the shared ListRow, so the upgrade doesn't ripple into every other
// screen that still uses ListRow's plainer look.
function PointsRow({
  Icon,
  title,
  value,
  trailing,
  onPress,
  arrow = true,
  last = false,
}: {
  Icon: ComponentType<IconProps>;
  title: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  arrow?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const content = (
    <>
      <View style={s.iconTile}>
        <Icon size={16} color={colors.onInk} weight="regular" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" numberOfLines={1} style={s.rowTitle}>{title}</AppText>
      </View>
      {trailing ?? (value ? (
        <AppText variant="body" style={s.rowValue} numberOfLines={1}>{value}</AppText>
      ) : null)}
      {onPress && arrow ? <CaretRight size={18} color={colors.ink40} weight="regular" /> : null}
      {!last ? <View style={s.rowSeparator} /> : null}
    </>
  );
  if (!onPress) return <View style={s.row}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={title}>
      {content}
    </Pressable>
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
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();

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

  const cardW = width - space.gutter * 2;
  const cardH = Math.round(cardW / 1.586);
  const PEEK_OFFSET = 32;
  const PEEK_INSET = 16;

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
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
            {/* the member card, standing on the next tier peeking from beneath —
                Apple Wallet's own stacked-card convention */}
            <View style={{ marginTop: space["2xl"] }}>
              <View style={{ height: cardH + (nextTier ? PEEK_OFFSET : 0) }}>
                {nextTier ? (
                  <View style={{ position: "absolute", top: PEEK_OFFSET, left: PEEK_INSET, right: PEEK_INSET }}>
                    <NextTierPeek h={cardH} name={nextTier.name} discountPercent={nextTier.discountPercent} />
                  </View>
                ) : null}
                <View style={{ position: "absolute", top: 0, left: 0 }}>
                  <MemberCard
                    w={cardW}
                    h={cardH}
                    name={(session.user.user_metadata?.display_name as string) || "Borteh member"}
                    phone={(session.user.user_metadata?.phone as string) || ""}
                    points={points}
                    worthMinor={value}
                    tierName={currentTier ? `${currentTier.name} · ${currentTier.discountPercent}% off` : null}
                    loading={isLoading}
                  />
                </View>
              </View>
            </View>

            {/* the road to the next tier — the stack itself already carries the
                destination and its reward; this is just the numbers */}
            {nextTier ? (
              <View style={{ marginTop: space.lg }}>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <AppText variant="caption" style={{ marginTop: space.sm }}>
                  {formatLe(spend)} of {formatLe(nextTier.thresholdMinor)} spent. {formatLe(Math.max(0, nextTier.thresholdMinor - spend))} to go.
                </AppText>
              </View>
            ) : currentTier ? (
              <AppText variant="caption" style={{ marginTop: space.lg }}>
                The house's highest standing. Thank you.
              </AppText>
            ) : null}

            {/* where you stand against everyone else */}
            <View style={{ marginTop: space["2xl"] }}>
              <View style={s.groupCard}>
                <PointsRow
                  Icon={Trophy}
                  title="Leaderboard"
                  value="Top buyers"
                  onPress={() => router.push("/leaderboard")}
                  last
                />
              </View>
            </View>

            {/* how points move — live numbers, tappable where it leads somewhere */}
            <AppText variant="label" style={s.eyebrow}>How points work</AppText>
            <View style={{ marginTop: space.sm }}>
              <View style={s.groupCard}>
                <PointsRow
                  Icon={Package}
                  title="Every delivered order"
                  value={cfg?.earnRate ? `+${Math.round(cfg.earnRate)} per Le 1` : "earns points"}
                  arrow={false}
                />
                <PointsRow
                  Icon={Handbag}
                  title="Spend at checkout"
                  value={cfg?.pointValueMinor ? `1 point = ${formatLe(cfg.pointValueMinor)}` : "toggle at checkout"}
                  arrow={false}
                />
                <PointsRow
                  Icon={UsersThree}
                  title="A friend's first delivery"
                  value={cfg?.referralPoints ? `+${cfg.referralPoints}` : undefined}
                  onPress={() => router.push("/invite")}
                  last
                />
              </View>
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
                Nothing yet. Your first delivered order starts the count.
              </AppText>
            ) : (
              <View style={{ marginTop: space.sm }}>
                <View style={s.groupCard}>
                  {entries.map((e, i) => (
                    <PointsRow
                      key={e.id}
                      Icon={ledgerIcon(e.type)}
                      title={describe(e)}
                      arrow={false}
                      last={i === entries.length - 1}
                      trailing={
                        <View style={{ alignItems: "flex-end" }}>
                          <AppText variant="body" style={{ color: e.delta > 0 ? colors.success : colors.ink60 }}>
                            {e.delta > 0 ? `+${e.delta}` : e.delta}
                          </AppText>
                          <AppText variant="caption" style={{ marginTop: 2 }}>{timeAgo(e.createdAt)}</AppText>
                        </View>
                      }
                    />
                  ))}
                </View>
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

// Card text at reduced weight needs to fade toward whatever `colors.onInk`
// resolves to — not a hardcoded cream literal. `onInk` flips per theme
// (dark paper in light mode, light paper in dark mode) to always sit
// correctly on the card's `colors.ink` face; a fixed literal doesn't, and
// silently washes out once the card itself goes light in dark mode.
function onInkAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  // the member card — rounded like the physical object it mimics
  card: { backgroundColor: colors.ink, borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(250,248,245,0.2)", padding: space.xl, justifyContent: "space-between" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  cardTier: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: onInkAlpha(colors.onInk, 0.45) },
  // bottom-left dog-ear: a darker under-shadow triangle, then a slightly
  // lighter one inset on top of it to read as the fold's lit top face.
  foldShadow: {
    position: "absolute", bottom: 0, left: 0, width: 0, height: 0,
    borderStyle: "solid", borderBottomWidth: 26, borderLeftWidth: 26,
    borderBottomColor: "transparent", borderLeftColor: "rgba(0,0,0,0.35)",
  },
  foldFace: {
    position: "absolute", bottom: 2, left: 2, width: 0, height: 0,
    borderStyle: "solid", borderBottomWidth: 20, borderLeftWidth: 20,
    borderBottomColor: "transparent", borderLeftColor: "rgba(250,248,245,0.14)",
  },
  chip: { width: 38, height: 28, borderRadius: 6, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  chipInner: { width: 26, height: 16, borderRadius: 3, borderWidth: 1, borderColor: "rgba(34,30,25,0.4)" },
  cardPoints: { fontFamily: font.serif, fontSize: 44, lineHeight: 50, color: colors.paper },
  cardWorth: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: onInkAlpha(colors.onInk, 0.65), marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.lg },
  cardName: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: colors.paper },
  cardPhone: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: onInkAlpha(colors.onInk, 0.65), marginTop: 2 },
  cardBrand: { fontFamily: font.serif, fontSize: 18, lineHeight: 22, color: colors.paper },
  // the next tier, tucked behind — a lighter surface (not another ink face) so
  // "behind" reads instantly, its sliver just tall enough for one label line.
  peekCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    overflow: "hidden",
    justifyContent: "flex-end",
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  peekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  peekLabel: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: colors.ink60 },
  peekPct: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: colors.accent },
  track: { height: 2, backgroundColor: colors.line },
  fill: { height: 2, backgroundColor: colors.ink },
  eyebrow: { color: colors.ink60, marginTop: space["3xl"] },
  // grouped-row card — same bordered box profile.tsx uses for its own menu groups
  groupCard: { borderWidth: 1, borderColor: colors.line, overflow: "hidden", backgroundColor: colors.surface },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 58, position: "relative" },
  iconTile: { width: 28, height: 28, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  rowSeparator: { position: "absolute", left: space.lg + 28 + space.md, right: space.lg, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  rowTitle: { fontFamily: font.medium },
  rowValue: { color: colors.ink60 },
});
