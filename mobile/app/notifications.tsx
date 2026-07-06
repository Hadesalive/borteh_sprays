import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell } from "phosphor-react-native";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { NotifIcon } from "@/components/NotifIcon";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { type AppNotification, timeAgo, useMarkRead, useNotifications } from "@/lib/notifications";
import { enablePush, syncBadge, usePushStatus } from "@/lib/push";
import { colors, font, space } from "@/lib/theme";

function RowSkeleton() {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Skel w={200} h={16} />
        <Skel w={260} h={12} style={{ marginTop: space.sm }} />
      </View>
      <Skel w={24} h={12} />
    </View>
  );
}

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { data, isLoading, refetch } = useNotifications();
  const { data: products } = useProducts();
  const markRead = useMarkRead();
  const pushStatus = usePushStatus();

  const items = data ?? [];
  const unread = items.filter((n) => !n.readAt);

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
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space["3xl"] }}>
        <BackButton onPress={() => router.back()} />
        <View style={s.titleRow}>
          <AppText variant="heading">Notifications</AppText>
          {unread.length > 0 ? <LinkLabel label="Mark all read" onPress={() => markRead.mutate(unread.map((n) => n.id))} color={colors.accent} /> : null}
        </View>

        {/* push opt-in — shown only while the permission has never been asked */}
        {session && pushStatus === "undetermined" ? (
          <View style={s.pushCard}>
            <Bell size={20} color={colors.ink} weight="regular" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="body">Get these on your lock screen</AppText>
              <AppText variant="caption" style={{ marginTop: 2 }}>Order updates and restock alerts — nothing else.</AppText>
            </View>
            <LinkLabel label="Turn on" color={colors.accent} onPress={() => enablePush()} />
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
          <View style={{ marginTop: space.md }}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
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
          <View style={{ marginTop: space.md }}>
            {items.map((n) => {
              const isUnread = !n.readAt;
              const lead = n.title ?? n.body;
              const detail = n.title ? n.body : null;
              return (
                <Pressable key={n.id} onPress={() => openItem(n)} style={s.row} accessibilityRole="button" accessibilityLabel={lead}>
                  <View style={s.iconSlot}>
                    <NotifIcon n={n} unread={isUnread} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="body" numberOfLines={2} style={isUnread ? s.titleUnread : s.titleRead}>
                      {lead}
                    </AppText>
                    {detail ? (
                      <AppText variant="caption" numberOfLines={2} style={{ marginTop: 2 }}>
                        {detail}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="caption" style={{ color: colors.ink40 }}>
                    {timeAgo(n.createdAt)}
                  </AppText>
                </Pressable>
              );
            })}
            <View style={{ marginTop: space["2xl"], alignItems: "center" }}>
              <LinkLabel label="Refresh" onPress={() => refetch()} color={colors.ink60} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  pushCard: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  iconSlot: { width: 24, alignItems: "center" },
  titleUnread: { fontFamily: font.semibold },
  titleRead: { color: colors.ink60 },
});
