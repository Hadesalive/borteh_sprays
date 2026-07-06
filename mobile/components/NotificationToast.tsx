import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AppNotification, useMarkRead } from "@/lib/notifications";
import { colors, font, space } from "@/lib/theme";
import { notifGlyph } from "./NotifIcon";
import { AppText } from "./Text";

// Heads-up banner (fed by the realtime stream in NotificationsLive). DARK GLASS —
// heavy blur under a translucent ink tint, so the screen glows through while the
// banner still reads unmistakably dark over the paper UI (the light frost version
// blended away; solid ink had no depth). The status glyph rides a semantic color
// chip (green check = confirmed, bronze moped = on the way, red ✕ = cancelled…),
// so the news lands in one glance before a word is read.
// Tap → open target + mark read · drag up to flick away · auto-dismisses.
// Rounded on purpose: it mimics a SYSTEM banner, not page chrome.

let listener: ((n: AppNotification) => void) | null = null;
/** Show the banner (call from anywhere; no-op before the root component mounts). */
export function showNotificationToast(n: AppNotification) {
  listener?.(n);
}

const SHOW_MS = 5000;
const PAPER60 = "rgba(250,248,245,0.65)";
const PAPER40 = "rgba(250,248,245,0.45)";

export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const markRead = useMarkRead();
  const [item, setItem] = useState<AppNotification | null>(null);
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden above, 1 = resting
  const dragY = useRef(new Animated.Value(0)).current; // finger-follow while swiping up
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        dragY.setValue(0);
        setItem(null);
      }
    });
  };
  const hideRef = useRef(hide);
  hideRef.current = hide;

  useEffect(() => {
    listener = (n) => {
      if (pathRef.current === "/notifications") return; // inbox is live on-screen
      setItem(n);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      dragY.setValue(0);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 5 }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => hideRef.current(), SHOW_MS);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe up to dismiss — the card follows the finger, then commits or springs back.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) dragY.setValue(Math.max(g.dy, -160));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24 || g.vy < -0.5) hideRef.current();
        else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
      },
    }),
  ).current;

  const open = () => {
    if (!item) return;
    markRead.mutate([item.id]);
    const isOrder = item.referenceType === "order" && item.referenceId;
    const isNotice = item.type === "promo" || item.type === "system";
    hide();
    if (isOrder) router.push({ pathname: "/order/[id]", params: { id: item.referenceId! } });
    else if (isNotice) router.push("/notices");
    else router.push("/notifications");
  };

  if (!item) return null;
  const { Icon, chip } = notifGlyph(item);
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }), dragY);

  return (
    <Animated.View
      style={[s.wrap, { top: insets.top + space.xs, opacity: slide, transform: [{ translateY }] }]}
      pointerEvents="box-none"
      {...pan.panHandlers}
    >
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Borteh: ${item.title ?? item.body}`}>
        <View style={s.card}>
          {/* dark glass: blur what's beneath, then tint it ink — Android's blur
              fallback still reads correctly thanks to the translucent tint */}
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, s.tintFill]} />
          <View style={s.row}>
            {/* the status is the avatar — semantic chip + filled glyph, readable in one glance */}
            <View style={[s.chip, { backgroundColor: chip }]}>
              <Icon size={24} color={colors.paper} weight="fill" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.nameRow}>
                <AppText style={s.name} numberOfLines={1}>
                  Borteh
                </AppText>
                <AppText style={s.time} maxFontSizeMultiplier={1.2}>
                  now
                </AppText>
              </View>
              <AppText style={s.title} numberOfLines={1}>
                {item.title ?? item.body}
              </AppText>
              {item.title ? (
                <AppText style={s.body} numberOfLines={2}>
                  {item.body}
                </AppText>
              ) : null}
            </View>
          </View>
          {/* grab handle, like the system banner */}
          <View style={s.handle} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: space.sm, right: space.sm, zIndex: 100 },
  card: { borderRadius: 20, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(250,248,245,0.22)", paddingTop: space.md, paddingBottom: space.sm, paddingHorizontal: space.md },
  tintFill: { backgroundColor: "rgba(34,30,25,0.6)" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  chip: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  name: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: "uppercase", color: PAPER40 },
  time: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: PAPER40 },
  title: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: colors.paper, marginTop: 2 },
  body: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: PAPER60, marginTop: 1 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(250,248,245,0.22)", marginTop: space.sm },
});
