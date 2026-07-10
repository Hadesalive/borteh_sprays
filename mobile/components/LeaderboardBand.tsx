import { useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useLeaderboard } from "@/lib/account";
import { formatLe } from "@/lib/format";
import { colors, font, space } from "@/lib/theme";
import { track } from "@/lib/track";
import { Trophy } from "./LeaderboardArt";
import { AppText } from "./Text";

// Home teaser for the leaderboard — top 3 with serif medallions plus the caller's own
// standing, tapping through to the full board. Self-gating: renders nothing until there's
// a board to show, so a brand-new shop (no spend yet) simply doesn't display it.

export function LeaderboardBand({ position = 0 }: { position?: number }) {
  const router = useRouter();
  const { data: rows } = useLeaderboard(3);

  if (!rows || rows.length === 0) return null;
  const top = rows.filter((r) => r.rank <= 3).slice(0, 3);
  const me = rows.find((r) => r.isMe);

  const open = () => {
    track("module_tap", { module: "leaderboard", position, metadata: {} });
    router.push("/leaderboard");
  };

  return (
    <View style={{ marginTop: space["4xl"] }}>
      <Pressable style={s.card} onPress={open} accessibilityRole="button" accessibilityLabel="Open the leaderboard">
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
            <View key={r.rank} style={s.row}>
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

const s = StyleSheet.create({
  card: { marginHorizontal: space.gutter, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  rows: { marginTop: space.lg, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  medallion: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  medallionGold: { backgroundColor: colors.ink, borderColor: colors.ink },
  medallionNum: { fontFamily: font.serif, fontSize: 14, lineHeight: 18, color: colors.ink },
  meTxt: { color: colors.accent, fontFamily: font.semibold },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
});
