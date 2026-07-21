import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { Guilloche, Laurel, Trophy } from "@/components/LeaderboardArt";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { type LeaderRow, useLeaderboard } from "@/lib/account";
import { useSession } from "@/lib/auth";
import { formatLe } from "@/lib/format";
import { imageUrl } from "@/lib/supabase";
import { colors, font, space } from "@/lib/theme";

// The board as an occasion, not a spreadsheet: a winner's podium crowns the top three —
// laurel over the champion, guilloche-engraved pedestals in the house style — and the rest
// carry serif rank medallions. The caller's own standing is always pinned in bronze.

function Avatar({ row, size }: { row: LeaderRow; size: number }) {
  const src = row.avatarPath ? imageUrl(row.avatarPath) : null;
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, row.rank === 1 && s.avatarGold]}>
      {src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <AppText style={[s.avatarTxt, { fontSize: size * 0.42, lineHeight: size * 0.5 }]} maxFontSizeMultiplier={1}>
          {row.name.trim().charAt(0).toUpperCase() || "B"}
        </AppText>
      )}
    </View>
  );
}

function Plinth({ row, colW, place }: { row: LeaderRow; colW: number; place: 1 | 2 | 3 }) {
  const first = place === 1;
  const avatarSize = first ? 78 : 60;
  const pedH = first ? 92 : place === 2 ? 66 : 50;
  const pedW = colW;
  return (
    <View style={[s.col, { width: colW }]}>
      <View style={{ height: first ? 30 : 0 }} />
      <View style={{ alignItems: "center" }}>
        {first ? (
          <View style={s.laurelWrap} pointerEvents="none">
            <Laurel size={avatarSize + 46} />
          </View>
        ) : null}
        <Avatar row={row} size={avatarSize} />
      </View>
      <AppText variant="body" numberOfLines={1} style={[s.plinthName, first && { fontFamily: font.semibold }]}>
        {row.isMe ? "You" : row.name}
      </AppText>
      <AppText variant="caption" style={[s.plinthSpend, first && { color: colors.accent }]} numberOfLines={1}>
        {formatLe(row.spendMinor)}
      </AppText>
      <View style={[s.pedestal, { width: pedW, height: pedH }, first ? s.pedestalGold : s.pedestalPlain]}>
        {first ? <Guilloche w={pedW} h={pedH} /> : null}
        <AppText style={[s.pedestalNum, first ? { color: colors.paper } : { color: colors.ink }]} maxFontSizeMultiplier={1}>
          {row.rank}
        </AppText>
      </View>
    </View>
  );
}

function Podium({ rows }: { rows: LeaderRow[] }) {
  const { width } = useWindowDimensions();
  const colW = Math.min(120, Math.floor((width - space.gutter * 2 - space.md * 2) / 3));
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  return (
    <View style={s.podium}>
      {second ? <Plinth row={second} colW={colW} place={2} /> : <View style={{ width: colW }} />}
      {first ? <Plinth row={first} colW={colW} place={1} /> : null}
      {third ? <Plinth row={third} colW={colW} place={3} /> : <View style={{ width: colW }} />}
    </View>
  );
}

function RankRow({ row }: { row: LeaderRow }) {
  return (
    <View style={[s.row, row.isMe && s.rowMe]}>
      <View style={[s.medallion, row.isMe && s.medallionMe]}>
        <AppText style={[s.medallionNum, row.isMe && { color: colors.accent }]} maxFontSizeMultiplier={1}>
          {row.rank}
        </AppText>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="body" numberOfLines={1} style={row.isMe && { fontFamily: font.semibold, color: colors.accent }}>
          {row.isMe ? "You" : row.name}
        </AppText>
      </View>
      <AppText variant="body" style={[s.spend, row.isMe && { color: colors.accent }]} maxFontSizeMultiplier={1.1}>
        {formatLe(row.spendMinor)}
      </AppText>
    </View>
  );
}

export default function Leaderboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data: rows, isLoading } = useLeaderboard(20);

  const list = rows ?? [];
  const podium = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"] }}>
        <View style={s.gutter}>
          <BackButton onPress={() => router.back()} />
        </View>

        {/* masthead — the trophy is the emblem */}
        <View style={s.masthead}>
          <Trophy size={48} />
          <AppText variant="display" style={{ marginTop: space.md }}>Top Buyers</AppText>
          <AppText variant="caption" style={{ marginTop: space.xs }}>The house's most devoted, by all-time spend.</AppText>
        </View>

        {!session ? (
          <View style={[s.gutter, s.center]}>
            <AppText variant="bodySoft" style={{ textAlign: "center", marginTop: space.xl }}>
              Sign in to see who's leading — and where you land.
            </AppText>
            <View style={{ marginTop: space.lg }}>
              <Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />
            </View>
          </View>
        ) : isLoading ? (
          <View style={[s.gutter, { marginTop: space.xl, gap: space.md }]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={s.skelRow}>
                <Skel w={32} h={32} />
                <View style={{ flex: 1 }}><Skel w={150} h={18} /></View>
                <Skel w={70} h={18} />
              </View>
            ))}
          </View>
        ) : list.length === 0 ? (
          <View style={[s.gutter, s.center]}>
            <AppText variant="serif20" style={{ textAlign: "center", marginTop: space.xl }}>No champions yet.</AppText>
            <AppText variant="bodySoft" style={{ textAlign: "center", marginTop: space.sm, maxWidth: 300 }}>
              As orders roll in, the top buyers take the podium. Place one and the crown could be yours.
            </AppText>
            <View style={{ marginTop: space.lg }}>
              <Button title="Start shopping" variant="secondary" onPress={() => router.push("/shop")} />
            </View>
          </View>
        ) : (
          <>
            {podium.length > 0 ? <Podium rows={podium} /> : null}

            {rest.length > 0 ? (
              <View style={[s.gutter, { marginTop: space["3xl"] }]}>
                <View style={s.restLine} />
                {rest.map((row, i, arr) => {
                  const prev = i === 0 ? podium[podium.length - 1] : arr[i - 1];
                  const gap = prev && row.rank - prev.rank > 1;
                  return (
                    <Fragment key={`${row.rank}:${row.name}:${i}`}>
                      {gap ? (
                        <View style={s.gapRow}>
                          <AppText style={s.gapDots} maxFontSizeMultiplier={1}>· · ·</AppText>
                        </View>
                      ) : null}
                      <RankRow row={row} />
                    </Fragment>
                  );
                })}
              </View>
            ) : null}

            {session && !list.some((r) => r.isMe) ? (
              <AppText variant="caption" style={[s.gutter, { marginTop: space.lg }]}>
                You're not on the board yet — your next delivered order puts you on it.
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  gutter: { paddingHorizontal: space.gutter },
  center: { alignItems: "center" },
  masthead: { alignItems: "center", marginTop: space.sm, marginBottom: space.xl, paddingHorizontal: space.gutter },

  // podium
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: space.md, marginTop: space.md },
  col: { alignItems: "center" },
  laurelWrap: { position: "absolute", top: -23, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  avatar: { backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarGold: { borderWidth: 2, borderColor: colors.accent },
  avatarTxt: { fontFamily: font.serif, color: colors.paper },
  plinthName: { marginTop: space.md, maxWidth: "100%", textAlign: "center" },
  plinthSpend: { textAlign: "center" },
  pedestal: { marginTop: space.sm, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1 },
  pedestalPlain: { backgroundColor: colors.surface, borderColor: colors.line },
  pedestalGold: { backgroundColor: colors.ink, borderColor: colors.ink },
  pedestalNum: { fontFamily: font.serif, fontSize: 30, lineHeight: 36 },

  // the rest
  restLine: { height: 1, backgroundColor: colors.line, marginBottom: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMe: { borderLeftWidth: 2, borderLeftColor: colors.accent, paddingLeft: space.md, marginLeft: -space.md - 2 },
  medallion: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  medallionMe: { borderColor: colors.accent, backgroundColor: colors.paper },
  medallionNum: { fontFamily: font.serif, fontSize: 16, lineHeight: 20, color: colors.ink },
  spend: { color: colors.ink60 },
  skelRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  gapRow: { alignItems: "center", paddingVertical: space.sm },
  gapDots: { fontFamily: font.regular, fontSize: 14, letterSpacing: 2, color: colors.ink40 },
});
