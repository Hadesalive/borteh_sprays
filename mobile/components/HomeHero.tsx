import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useHomeCarousel } from "@/lib/api";
import { imageUrl } from "@/lib/supabase";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

type Slide = { key: string; img: number | { uri: string }; label: string; title: string; cta: string; to: Href };

// Bundled fallback — shown until the owner adds carousel slides in the admin.
const FALLBACK: Slide[] = [
  { key: "f-oud", img: require("../assets/home/hero-oud.jpg"), label: "Signature", title: "Scents that linger.", cta: "Shop the collection", to: "/shop" },
  { key: "f-gold", img: require("../assets/home/hero-gold.jpg"), label: "Amber & oud", title: "Warmth that stays.", cta: "Shop warm scents", to: { pathname: "/shop", params: { family: "oriental" } } },
  { key: "f-rose", img: require("../assets/home/hero-rose.jpg"), label: "Rose & jasmine", title: "Florals in bloom.", cta: "Shop florals", to: { pathname: "/shop", params: { family: "floral" } } },
];

const ADVANCE_MS = 4800;

/** Atmospheric hero — auto-advancing, Ken Burns zoom on the active slide, pauses on touch. */
export function HomeHero({ width }: { width: number }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const snap = width + space.md;
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduceMotion = useRef(false);
  const kb = useRef(new Animated.Value(0)).current;

  // DB-driven slides (curated order); falls back to the bundled set.
  const { data: carousel, error } = useHomeCarousel();
  const slides = useMemo<Slide[]>(() => {
    if (!error && carousel && carousel.length) {
      return carousel.map((c, i) => {
        const remote = c.imagePath ? imageUrl(c.imagePath) : null;
        return {
          key: c.id,
          img: remote ? { uri: remote } : FALLBACK[i % FALLBACK.length].img,
          label: c.label ?? "",
          title: c.title,
          cta: c.cta ?? "Shop now",
          to: (c.link ?? "/shop") as Href,
        };
      });
    }
    return FALLBACK;
  }, [carousel, error]);

  const count = slides.length;
  const countRef = useRef(count);
  countRef.current = count;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = () => {
    stop();
    if (reduceMotion.current || countRef.current <= 1) return;
    timer.current = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % countRef.current;
        scrollRef.current?.scrollTo({ x: next * snap, animated: true });
        return next;
      });
    }, ADVANCE_MS);
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduceMotion.current = r;
      start();
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, count]);

  // Ken Burns: slow zoom restarts on each slide
  useEffect(() => {
    if (reduceMotion.current) return;
    kb.setValue(0);
    Animated.timing(kb, { toValue: 1, duration: ADVANCE_MS + 1200, useNativeDriver: true }).start();
  }, [idx, kb]);
  const zoom = kb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={s.rail}
        onScrollBeginDrag={stop}
        onMomentumScrollEnd={(e) => {
          setIdx(Math.round(e.nativeEvent.contentOffset.x / snap));
          start();
        }}
      >
        {slides.map((sl, i) => (
          <Pressable
            key={sl.key}
            onPress={() => router.push(sl.to)}
            style={({ pressed }) => [s.card, { width }, pressed && { opacity: 0.97 }]}
            accessibilityRole="button"
            accessibilityLabel={sl.cta}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: i === idx ? zoom : 1 }] }]}>
              <Image source={sl.img} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={300} />
            </Animated.View>
            <LinearGradient colors={["rgba(15,11,8,0.12)", "rgba(15,11,8,0.5)", "rgba(12,9,6,0.92)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.content}>
              <View style={s.copy}>
                {sl.label ? <AppText style={s.label}>{sl.label}</AppText> : null}
                <AppText style={s.title}>{sl.title}</AppText>
              </View>
              <View style={s.cta}>
                <AppText style={s.ctaTxt}>{sl.cta}</AppText>
                <ArrowRight size={15} color="#FFFFFF" weight="bold" />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {slides.map((sl, i) => (
          <View key={sl.key} style={[s.dot, i === idx ? s.dotOn : s.dotOff]} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rail: { paddingHorizontal: space.xl, gap: space.md },
  card: { height: 240, borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#1A1411", justifyContent: "flex-end" },
  content: { padding: space.xl, gap: space.lg },
  copy: { gap: space.sm },
  label: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,0.72)" },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, color: "#FFFFFF", letterSpacing: -0.4 },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  ctaTxt: { fontFamily: font.semibold, fontSize: 14, color: "#FFFFFF", letterSpacing: -0.1 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: space.lg },
  dot: { height: 6, borderRadius: 3 },
  dotOn: { width: 18, backgroundColor: colors.accent },
  dotOff: { width: 6, backgroundColor: "#D9D2C8" },
});
