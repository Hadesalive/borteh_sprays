import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bell } from "phosphor-react-native";
import { useEffect } from "react";
import { Alert, LayoutAnimation, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { NotifIcon } from "@/components/NotifIcon";
import { Skel } from "@/components/Skeleton";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { type AppNotification, timeAgo, useDeleteNotifications, useMarkRead, useNotifications } from "@/lib/notifications";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const easeList = () => LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
import { enablePush, syncBadge, usePushStatus } from "@/lib/push";
import { imageUrl } from "@/lib/supabase";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// First-load placeholder — mirrors the photo-led row layout so nothing jumps.
function LoadingRows() {
  const s = useThemedStyles(makeStyles);
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.row, i < 2 && s.rowBorder]}>
          <Skel w={52} h={52} r={10} />
          <View style={{ flex: 1 }}>
            <Skel w={190} h={15} />
            <Skel w={130} h={11} style={{ marginTop: space.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const { data: products } = useProducts();
  const markRead = useMarkRead();
  const deleteNotifs = useDeleteNotifications();
  const pushStatus = usePushStatus();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  const items = data ?? [];
  const unread = items.filter((n) => !n.readAt);

  // Group by calendar day — Today / Yesterday / "12 July" — so a notification is easy to find.
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const dayLabel = (d: Date) => {
    if (dayKey(d) === dayKey(now)) return "Today";
    if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
    return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  };
  const sections: { title: string; data: AppNotification[] }[] = [];
  for (const n of items) {
    const title = dayLabel(new Date(n.createdAt));
    const prev = sections[sections.length - 1];
    if (prev && prev.title === title) prev.data.push(n);
    else sections.push({ title, data: [n] });
  }

  const removeOne = (id: string) => {
    easeList();
    deleteNotifs.mutate([id]);
  };
  const clearAll = () => {
    if (!items.length) return;
    Haptics.selectionAsync();
    Alert.alert("Clear all notifications?", "This removes every notification from your inbox.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: () => {
          easeList();
          deleteNotifs.mutate(items.map((n) => n.id));
        },
      },
    ]);
  };

  // keep the app-icon badge in step with the inbox
  useEffect(() => {
    if (session) syncBadge(unread.length);
  }, [session, unread.length]);

  const openItem = (n: AppNotification) => {
    Haptics.selectionAsync();
    if (!n.readAt) markRead.mutate([n.id]);
    if ((n.type === "order_status" || n.type === "delivery") && n.referenceType === "order" && n.referenceId) {
      router.push({ pathname: "/order/[id]", params: { id: n.referenceId } });
    } else if (n.type === "restock_available" && n.referenceType === "product_variant" && n.referenceId) {
      // the reference is a variant — resolve its product from the catalog cache
      const product = (products ?? []).find((p) => p.variants.some((v) => v.id === n.referenceId));
      if (product) router.push({ pathname: "/product/[slug]", params: { slug: product.slug } });
    } else if (n.type === "promo" || n.type === "system") {
      router.push("/notices"); // the bulletin — full reading view
    }
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}
        refreshControl={session ? <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.ink40} colors={[colors.ink]} progressBackgroundColor={colors.surface} /> : undefined}
      >
        <BackButton onPress={() => router.back()} />
        <View style={s.titleRow}>
          <AppText variant="heading">Notifications</AppText>
          <View style={s.titleActions}>
            {unread.length > 0 ? <LinkLabel label="Mark all read" onPress={() => markRead.mutate(unread.map((n) => n.id))} /> : null}
            {items.length > 0 ? <LinkLabel label="Clear all" onPress={clearAll} color={colors.ink40} /> : null}
          </View>
        </View>

        {/* push opt-in — shown only while the permission has never been asked */}
        {session && pushStatus === "undetermined" ? (
          <View style={s.pushCard}>
            <Bell size={22} color={colors.ink} weight="regular" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="body" style={{ fontFamily: font.medium }}>Get these on your lock screen</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>Order updates and restock alerts — nothing else.</AppText>
            </View>
            <LinkLabel label="Turn on" onPress={() => enablePush()} />
          </View>
        ) : null}

        {!session ? (
          <EmptyState
            inline
            icon={<Bell size={32} color={colors.ink40} weight="regular" />}
            title="Sign in for updates."
            body="Order progress and restock alerts land here once you're signed in."
            action={<Button title="Sign in" variant="secondary" onPress={() => router.push("/login")} />}
          />
        ) : isLoading && items.length === 0 ? (
          <View style={{ marginTop: space.lg }}>
            <LoadingRows />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            inline
            icon={<Bell size={32} color={colors.ink40} weight="regular" />}
            title="Nothing yet."
            body="When an order moves or a scent you're waiting on returns, you'll hear about it here."
            action={<Button title="Browse fragrances" variant="secondary" onPress={() => router.push("/shop")} />}
          />
        ) : (
          <>
            {sections.map((sec) => (
              <View key={sec.title}>
                <AppText variant="label" style={s.groupLabel}>{sec.title}</AppText>
                <View>
                  {sec.data.map((n, i) => {
                    const last = i === sec.data.length - 1;
                    const isUnread = !n.readAt;
                    const lead = n.title ?? n.body;
                    const detail = n.title ? n.body : null;
                    const thumb = n.imagePath ? imageUrl(n.imagePath) : null;
                    return (
                      <SwipeToDelete key={n.id} onDelete={() => removeOne(n.id)}>
                        <Pressable onPress={() => openItem(n)} style={[s.row, !last && s.rowBorder]} accessibilityRole="button" accessibilityLabel={lead}>
                          {/* photo-led: the product shot leads when there is one; otherwise the
                              status glyph gets the same bordered paper seat so every row is an object */}
                          <View style={s.lead}>
                            {thumb ? (
                              <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={n.id} />
                            ) : (
                              <NotifIcon n={n} unread={isUnread} />
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={s.leadLine}>
                              {isUnread ? <View style={s.unreadDot} /> : null}
                              <AppText variant="bodyLg" numberOfLines={2} style={isUnread ? s.titleUnread : s.titleRead}>
                                {lead}
                              </AppText>
                              <AppText variant="caption" style={s.time} maxFontSizeMultiplier={1.2}>
                                {timeAgo(n.createdAt)}
                              </AppText>
                            </View>
                            {detail ? (
                              <AppText variant="bodySoft" numberOfLines={2} style={{ marginTop: 2 }}>
                                {detail}
                              </AppText>
                            ) : null}
                          </View>
                        </Pressable>
                      </SwipeToDelete>
                    );
                  })}
                </View>
              </View>
            ))}
            {/* quiet end mark — the list rests on a rule instead of dead-ending in white */}
            <View style={s.tail}>
              <View style={s.tailRule} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  titleActions: { flexDirection: "row", alignItems: "center", gap: space.lg },

  // push opt-in — same card language as Profile
  pushCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, padding: space.lg },

  // open editorial list — rows sit directly on paper, separated by hairlines (no card chrome)
  groupLabel: { color: colors.ink40, marginTop: space["2xl"], marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg, backgroundColor: colors.paper },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },

  // the leading object — product shot or status glyph on the same bordered surface seat
  lead: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  leadLine: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, alignSelf: "flex-start", marginTop: 9 },
  titleUnread: { flex: 1, fontFamily: font.medium, color: colors.ink },
  titleRead: { flex: 1, color: colors.ink },
  time: { color: colors.ink40, marginTop: 4 },

  // end treatment — a short centered rule closes the list
  tail: { alignItems: "center", marginTop: space["3xl"] },
  tailRule: { width: 40, height: 1, backgroundColor: colors.line },
});
