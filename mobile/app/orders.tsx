import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { DotsThree, Receipt } from "phosphor-react-native";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { EmptyState } from "@/components/EmptyState";
import { Skel } from "@/components/Skeleton";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useProducts } from "@/lib/api";
import { formatLe } from "@/lib/format";
import { setHideCancelledOrders, useHideCancelledOrders } from "@/lib/orderPrefs";
import { type Order, STATUS_LABEL, STATUS_TONE, useOrders } from "@/lib/orders";
import { Colors, font, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// First-load placeholder — mirrors the photo-led receipt rows so nothing jumps.
function LoadingRows() {
  const s = useThemedStyles(makeStyles);
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.row, i < 2 && s.rowBorder]}>
          <Skel w={52} h={52} r={10} />
          <View style={{ flex: 1 }}>
            <Skel w={110} h={15} />
            <Skel w={150} h={11} style={{ marginTop: space.sm }} />
          </View>
          <Skel w={72} h={18} />
        </View>
      ))}
    </View>
  );
}

export default function Orders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: orders, isLoading, refetch, isRefetching } = useOrders();
  const { data: products } = useProducts();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const hideCancelled = useHideCancelledOrders();

  // A view filter, not a delete — cancelled orders stay in the database
  // (support/accounting record intact), this only controls what's shown.
  const visibleOrders = hideCancelled ? (orders ?? []).filter((o) => o.status !== "cancelled") : orders ?? [];

  const openActions = () => {
    Alert.alert(
      "Orders",
      undefined,
      [
        {
          text: hideCancelled ? "Show cancelled orders" : "Hide cancelled orders",
          onPress: () => setHideCancelledOrders(!hideCancelled),
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

  // Group by month — "July 2026" — so the ledger reads chronologically at a glance.
  const monthLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Earlier");
  const sections: { title: string; data: Order[] }[] = [];
  for (const o of visibleOrders) {
    const title = monthLabel(o.placedAt);
    const prev = sections[sections.length - 1];
    if (prev && prev.title === title) prev.data.push(o);
    else sections.push({ title, data: [o] });
  }

  // status reads as a quiet tinted line, not a chip — semantic color only
  const toneColor = { muted: colors.ink60, success: colors.success, warning: colors.warning, error: colors.error } as const;

  // photo-led: the first line item we can resolve in the catalog cache lends its photo
  // (display-only enrichment — snapshots carry no image, same pattern as the inbox)
  const thumbFor = (o: Order) => {
    for (const line of o.items) {
      const p = (products ?? []).find((prod) => prod.name === line.name);
      if (p?.imageUrl) return p.imageUrl;
    }
    return null;
  };

  // what was ordered, in words — first product name, then how many more ride along
  const summaryFor = (o: Order) => {
    const names: string[] = [];
    for (const line of o.items) if (!names.includes(line.name)) names.push(line.name);
    if (names.length === 0) return o.number;
    return names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0];
  };

  return (
    <View style={s.screen}>
      <ThemedStatusBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.ink40} colors={[colors.ink]} progressBackgroundColor={colors.surface} />}
      >
        <BackButton onPress={() => router.back()} />
        <View style={s.titleRow}>
          <AppText variant="heading">Orders</AppText>
          {orders && orders.length > 0 ? (
            <Pressable onPress={openActions} hitSlop={12} accessibilityRole="button" accessibilityLabel="Order list actions">
              <DotsThree size={26} color={colors.ink} weight="bold" />
            </Pressable>
          ) : null}
        </View>

        {!orders || orders.length === 0 ? (
          isLoading ? (
            <View style={{ marginTop: space.lg }}>
              <LoadingRows />
            </View>
          ) : (
            <EmptyState
              inline
              icon={<Receipt size={32} color={colors.ink40} weight="regular" />}
              title="No orders yet."
              body="When you place an order it'll show up here."
            />
          )
        ) : visibleOrders.length === 0 ? (
          // Every order exists, just hidden by the cancelled-orders filter —
          // distinct from "no orders yet" so it doesn't read as an empty account.
          <EmptyState
            inline
            icon={<Receipt size={32} color={colors.ink40} weight="regular" />}
            title="Nothing to show."
            body="Cancelled orders are hidden right now."
            action={<LinkLabel label="Show cancelled orders" onPress={() => setHideCancelledOrders(false)} />}
          />
        ) : (
          <>
            {sections.map((sec) => (
              <View key={sec.title}>
                <AppText variant="label" style={s.groupLabel}>{sec.title}</AppText>
                <View>
                  {sec.data.map((o, i) => {
                    const last = i === sec.data.length - 1;
                    const count = o.items.reduce((n, it) => n + it.qty, 0);
                    const thumb = thumbFor(o);
                    return (
                      <Pressable key={o.id} onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })} style={[s.row, !last && s.rowBorder]} accessibilityRole="button" accessibilityLabel={`Order ${o.number}`}>
                        <View style={s.lead}>
                          {thumb ? (
                            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={o.id} />
                          ) : (
                            <Receipt size={22} color={colors.ink40} weight="regular" />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText variant="bodyLg" numberOfLines={1} style={s.number}>{summaryFor(o)}</AppText>
                          <AppText variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
                            {o.number} · {fmtDate(o.placedAt)} · {count} {count === 1 ? "item" : "items"}
                          </AppText>
                        </View>
                        <View style={s.meta}>
                          <AppText variant="serif20" numberOfLines={1}>{formatLe(o.totalMinor)}</AppText>
                          <AppText variant="caption" numberOfLines={1} style={{ color: toneColor[STATUS_TONE[o.status]], marginTop: 2 }}>
                            {STATUS_LABEL[o.status]}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {/* quiet end mark — the ledger closes on a rule instead of dead-ending in white */}
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

  // open editorial receipt list — rows on paper, hairline separators, no card chrome
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  groupLabel: { color: colors.ink40, marginTop: space["2xl"], marginBottom: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg, backgroundColor: colors.paper },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },

  // the leading object — first item's photo, or the receipt glyph on the same bordered seat.
  // Square (radius 0) — same fix as notifications.tsx's identical lead box.
  lead: { width: 52, height: 52, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  number: { fontFamily: font.medium },
  meta: { alignItems: "flex-end" },

  // end treatment — a short centered rule closes the list
  tail: { alignItems: "center", marginTop: space["3xl"] },
  tailRule: { width: 40, height: 1, backgroundColor: colors.line },
});
