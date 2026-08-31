import { useRouter } from "expo-router";
import { DotsThree, MegaphoneSimple } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { useSession } from "@/lib/auth";
import { timeAgo, useDeleteNotifications, useMarkRead, useNotices } from "@/lib/notifications";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// The maison's bulletin — public notices only (hours, delivery changes, offers).
// Tailored for READING, not triage: each notice is an editorial post (eyebrow +
// date, serif headline, full body), and opening the screen marks them read —
// notices carry no action, so they shouldn't keep the bell lit.

function PostSkeleton() {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.post}>
      <Skel w={90} h={12} />
      <Skel w={240} h={24} style={{ marginTop: space.md }} />
      <Skel w={"100%"} h={14} style={{ marginTop: space.md }} />
      <Skel w={"70%"} h={14} style={{ marginTop: space.sm }} />
    </View>
  );
}

export default function Notices() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data, isLoading } = useNotices();
  const markRead = useMarkRead();
  const deleteNotifications = useDeleteNotifications();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const items = data ?? [];

  // Reading the bulletin clears its unread — once per visit.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    const unread = items.filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length) {
      marked.current = true;
      markRead.mutate(unread);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const openActions = () => {
    Alert.alert("Notices", undefined, [
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => deleteNotifications.mutate(items.map((n) => n.id)),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        <View style={s.titleRow}>
          <AppText variant="heading">Notices</AppText>
          {items.length > 0 ? (
            <Pressable onPress={openActions} hitSlop={12} accessibilityRole="button" accessibilityLabel="Notice list actions">
              <DotsThree size={26} color={colors.ink} weight="bold" />
            </Pressable>
          ) : null}
        </View>
        <AppText variant="caption" style={{ marginTop: space.xs }}>
          News from the maison: hours, deliveries, offers.
        </AppText>

        {!session ? (
          <EmptyState
            inline
            icon={<MegaphoneSimple size={32} color={colors.ink40} weight="regular" />}
            title="Sign in to read notices."
            body="Announcements and offers from the shop land here."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : isLoading && items.length === 0 ? (
          <View style={{ marginTop: space.sm }}>
            <PostSkeleton />
            <PostSkeleton />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            inline
            icon={<MegaphoneSimple size={32} color={colors.ink40} weight="regular" />}
            title="Nothing posted yet."
            body="When the maison has news (hours, deliveries, or an offer worth knowing), it's published here."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        ) : (
          <View style={{ marginTop: space.sm }}>
            {items.map((n) => (
              <View key={n.id} style={s.post}>
                <View style={s.eyebrowRow}>
                  <AppText variant="label" style={{ color: n.type === "promo" ? colors.accent : colors.ink60 }}>
                    {n.type === "promo" ? "Offer" : "Notice"}
                  </AppText>
                  <AppText variant="caption" style={{ color: colors.ink40 }}>
                    {timeAgo(n.createdAt)}
                  </AppText>
                </View>
                <AppText variant="serif20" style={{ marginTop: space.sm }}>
                  {n.title ?? n.body}
                </AppText>
                {n.title ? (
                  <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
                    {n.body}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  post: { paddingVertical: space["2xl"], borderBottomWidth: 1, borderBottomColor: colors.line },
  eyebrowRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
});
