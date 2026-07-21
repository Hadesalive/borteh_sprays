import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AppNotification, useMarkRead } from "@/lib/notifications";
import { imageUrl } from "@/lib/supabase";
import { colors, font, space } from "@/lib/theme";
import { notifGlyph } from "./NotifIcon";

// Heads-up banner (fed by the realtime stream in NotificationsLive). DARK GLASS —
// heavy blur under a translucent ink tint, so the screen glows through while the
// banner still reads unmistakably dark over the paper UI.
//
// Tuned to read like a real OS banner: it drops on a spring with a soft shadow so it
// floats, scales down under your finger, pauses its dismiss timer while touched, and
// flicks up to dismiss. Two more deliberate "native" choices:
//   • Text is the PHONE's system font (SF / Roboto), not the app serif — a real
//     notification is drawn by the OS, so it uses the OS face.
//   • The leading mark is the Borteh monogram (the "app icon"), with a small semantic
//     status dot in the corner — the one-glance confirmed / on-the-way / cancelled cue.
// Tap → open target + mark read · drag up to flick away · auto-dismisses.

let listener: ((n: AppNotification) => void) | null = null;
/** Show the banner (call from anywhere; no-op before the root component mounts). */
export function showNotificationToast(n: AppNotification) {
  listener?.(n);
}

const SHOW_MS = 5000;
const PAPER = "rgba(250,248,245,0.95)";
const PAPER70 = "rgba(250,248,245,0.72)";
const PAPER45 = "rgba(250,248,245,0.45)";
// The phone's own UI font — SF on iOS, Roboto on Android — so the banner reads as system chrome.
const SYS = Platform.select({ ios: "System", android: "sans-serif", default: "System" });
const SYS_MED = Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" });

export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const markRead = useMarkRead();
  const [item, setItem] = useState<AppNotification | null>(null);
  const slide = useRef(new Animated.Value(0)).current; // 0 = hidden above, 1 = resting
  const dragY = useRef(new Animated.Value(0)).current; // finger-follow while swiping up
  const press = useRef(new Animated.Value(1)).current; // tactile scale under the finger
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const arm = () => {
    clearTimer();
    timer.current = setTimeout(() => hideRef.current(), SHOW_MS);
  };
  const armRef = useRef(arm);
  armRef.current = arm;

  const hide = () => {
    clearTimer();
    Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        dragY.setValue(0);
        press.setValue(1);
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
      press.setValue(1);
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 6 }).start();
      armRef.current();
    };
    return () => {
      listener = null;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe up to dismiss — the card follows the finger, then commits or springs back.
  // Touching it pauses the auto-dismiss so a banner never vanishes mid-read.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => clearTimer(),
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) dragY.setValue(Math.max(g.dy, -160));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24 || g.vy < -0.5) hideRef.current();
        else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
          armRef.current();
        }
      },
    }),
  ).current;

  const setPressed = (down: boolean) => {
    if (down) clearTimer();
    else armRef.current();
    Animated.spring(press, { toValue: down ? 0.97 : 1, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };

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
  const thumb = item.imagePath ? imageUrl(item.imagePath) : null;
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [-180, 0] }), dragY);
  const scale = Animated.multiply(slide.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }), press);

  return (
    <Animated.View
      style={[s.wrap, { top: insets.top + space.xs, transform: [{ translateY }] }]}
      pointerEvents="box-none"
      {...pan.panHandlers}
    >
      <Animated.View style={[s.shadow, { opacity: slide, transform: [{ scale }] }]}>
        <Pressable onPress={open} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} accessibilityRole="button" accessibilityLabel={`Borteh: ${item.title ?? item.body}`}>
          <View style={s.card}>
            {/* dark glass: blur what's beneath, then tint it ink — Android's blur
                fallback still reads correctly thanks to the translucent tint */}
            <BlurView intensity={72} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, s.tintFill]} />
            <View style={s.row}>
              {/* the app-icon slot: Borteh monogram + a small semantic status dot */}
              <View style={s.mark}>
                <Text style={s.markLetter} maxFontSizeMultiplier={1} allowFontScaling={false}>B</Text>
                <View style={[s.badge, { backgroundColor: chip }]}>
                  <Icon size={10} color={colors.paper} weight="fill" />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.nameRow}>
                  <Text style={s.name} numberOfLines={1}>Borteh</Text>
                  <Text style={s.time} maxFontSizeMultiplier={1.2}>now</Text>
                </View>
                <Text style={s.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {item.title ?? item.body}
                </Text>
                {item.title ? (
                  <Text style={s.body} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                    {item.body}
                  </Text>
                ) : null}
              </View>
              {/* iOS-attachment style: the perfume's photo rides on the right */}
              {thumb ? (
                <View style={s.thumb}>
                  <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} />
                </View>
              ) : null}
            </View>
            {/* grab handle, like the system banner */}
            <View style={s.handle} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: space.sm, right: space.sm, zIndex: 100 },
  // depth: iOS shadow lives on this un-clipped layer, Android elevation on the card.
  shadow: {
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: "#0B0906", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      default: {},
    }),
  },
  card: { borderRadius: 22, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(250,248,245,0.22)", paddingTop: space.md, paddingBottom: space.sm, paddingHorizontal: space.md, elevation: 10 },
  tintFill: { backgroundColor: "rgba(34,30,25,0.6)" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  // monogram "app icon": a paper tile with the serif mark (the logo stays the house serif)
  mark: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  markLetter: { fontFamily: font.serif, fontSize: 26, lineHeight: 30, color: colors.ink, marginTop: 1 },
  badge: { position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1A1712" },
  nameRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  // system font throughout the text — SF / Roboto, so it reads as OS chrome
  name: { fontFamily: SYS_MED, fontWeight: "600", fontSize: 13, lineHeight: 17, color: PAPER70 },
  time: { fontFamily: SYS, fontWeight: "400", fontSize: 13, lineHeight: 17, color: PAPER45 },
  title: { fontFamily: SYS_MED, fontWeight: "600", fontSize: 15, lineHeight: 20, color: PAPER, marginTop: 2 },
  body: { fontFamily: SYS, fontWeight: "400", fontSize: 14, lineHeight: 19, color: PAPER70, marginTop: 1 },
  thumb: { width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(250,248,245,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(250,248,245,0.18)" },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(250,248,245,0.22)", marginTop: space.sm },
});
