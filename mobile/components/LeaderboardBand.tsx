import { useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Guilloche } from "@/components/Guilloche";
import { useLeaderboard } from "@/lib/account";
import { formatLe } from "@/lib/format";
import { Colors, font, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";
import { track } from "@/lib/track";
import { Trophy } from "./LeaderboardArt";
import { AppText } from "./Text";

// Home teaser for the leaderboard — top 3 with serif medallions plus the caller's own
// standing, tapping through to the full board. Self-gating: renders nothing until there's
// a board to show, so a brand-new shop (no spend yet) simply doesn't display it.

// Card text/texture at reduced weight fades toward whatever `colors.ink` resolves to,
// not a hardcoded literal — `ink` flips per theme (dark on light-mode's light card,
// light on dark-mode's dark card), so deriving from it keeps the guilloche and the
// muted rank numbers legible in both, instead of disappearing in one of them.
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function LeaderboardBand({ position = 0 }: { position?: number }) {
  const router = useRouter();
  const { data: rows } = useLeaderboard(3);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const s = useThemedStyles(makeStyles);
  const [cardH, setCardH] = useState(0);
  const cardW = width - space.gutter * 2;

  if (!rows || rows.length === 0) return null;
  const top = rows.filter((r) => r.rank <= 3).slice(0, 3);
  const me = rows.find((r) => r.isMe);

  const open = () => {
    track("module_tap", { module: "leaderboard", position, metadata: {} });
    router.push("/leaderboard");
  };

  return (
    <View style={{ marginTop: space["4xl"] }}>
      <Pressable
        style={s.card}
        onPress={open}
        onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
        accessibilityRole="button"
        accessibilityLabel="Open the leaderboard"
      >
        {/* Same engraved guilloche the loyalty card/Collections shelf carry — this
            teaser deserves the maison's own texture, not a bare bordered box. */}
        {cardH > 0 ? (
          <Guilloche w={cardW} h={cardH} origin="topRight" ringGap={18} start={12} base={withAlpha(colors.ink, 0.05)} accent={withAlpha(colors.accent, 0.14)} />
        ) : null}
        <View style={s.head}>
          <Trophy size={22} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="serif20">Top Buyers</AppText>
            <AppText variant="caption">The board, ranked by spend</AppText>
          </View>
          <ArrowRight size={20} color={colors.ink} weight="regular" />
        </View>

        <View style={s.rows}>
          {top.map((r) => (
            <View key={r.rank} style={[s.row, r.isMe && s.rowMe]}>
              <View style={[s.medallion, r.rank === 1 && s.medallionGold]}>
                <AppText style={[s.medallionNum, r.rank === 1 && { color: colors.paper }]} maxFontSizeMultiplier={1}>{r.rank}</AppText>
              </View>
              <AppText variant="body" numberOfLines={1} style={[{ flex: 1 }, r.isMe && s.meTxt]}>{r.isMe ? "You" : r.name}</AppText>
              <AppText variant="caption" style={r.isMe && s.meTxt}>{formatLe(r.spendMinor)}</AppText>
            </View>
          ))}
        </View>

        {me ? (
          <View style={s.footer}>
            <AppText variant="label" style={{ color: colors.accent }}>
              {me.rank <= 3 ? `You're #${me.rank}` : `You · #${me.rank}`}
            </AppText>
            <AppText variant="caption">See full board</AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  card: { marginHorizontal: space.gutter, borderWidth: 1, borderColor: colors.line, padding: space.lg, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  rows: { marginTop: space.lg, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 2 },
  // "you" reads as a real highlighted band (bleeding to the card's own padding),
  // not just a change of text color
  rowMe: { backgroundColor: colors.accentSoft, marginHorizontal: -space.lg, paddingHorizontal: space.lg, paddingVertical: space.sm },
  medallion: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  medallionGold: { backgroundColor: colors.ink, borderColor: colors.ink },
  medallionNum: { fontFamily: font.serif, fontSize: 14, lineHeight: 18, color: colors.ink },
  meTxt: { color: colors.accent, fontFamily: font.semibold },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
});
