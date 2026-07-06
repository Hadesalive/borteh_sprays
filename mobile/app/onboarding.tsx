import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ScentPicker } from "@/components/ScentPicker";
import { AppText } from "@/components/Text";
import { markOnboarded } from "@/lib/onboarding";
import { saveScentPrefs } from "@/lib/scentPrefs";
import { colors, space } from "@/lib/theme";

const SLIDES = [
  {
    img: require("../assets/home/hero-rose.jpg"),
    title: "The whole maison, in your pocket.",
    body: "Browse every fragrance on the shelf, with live stock straight from the Freetown counter.",
    cta: "Continue",
  },
  {
    img: require("../assets/home/scent/oriental.jpg"),
    title: "Make it yours.",
    body: "Save the scents you love, leave reviews, and get told the moment a sold-out bottle returns.",
    cta: "Continue",
  },
  {
    img: require("../assets/home/collections/date-night.jpg"),
    title: "Order without the errand.",
    body: "Check out in the app, pay the rider at your door, and follow every step on the way.",
    cta: "Continue",
  },
];
const TOTAL = SLIDES.length + 1; // + the scent-taste step

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<string[]>([]);
  const [gender, setGender] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const imgH = Math.min(500, Math.round(height * 0.55));
  const picking = step === SLIDES.length; // last step = scent taste
  const slide = SLIDES[step];

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (values.length || gender) {
      try { await saveScentPrefs(values, gender); } catch { /* saved locally; syncs on sign-in */ }
    }
    markOnboarded();
    router.replace("/(tabs)");
  };

  const advance = () => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep((s) => s + 1);
  };

  const Dots = () => (
    <View style={s.dots}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={[s.dot, i === step ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {picking ? (
        // ---- Scent taste step ----
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space["2xl"], paddingBottom: space.xl }}>
            <Pressable onPress={finish} style={s.skipInline} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
              <AppText variant="label" style={{ color: colors.ink40 }}>Skip</AppText>
            </Pressable>
            <AppText variant="display">What do you love?</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>
              We'll tune your home to it — from day one. You can change this any time in your profile.
            </AppText>
            <View style={{ marginTop: space["2xl"] }}>
              <ScentPicker onChange={(v, g) => { setValues(v); setGender(g); }} />
            </View>
            <Dots />
          </ScrollView>
          <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
            <Button title={busy ? "Setting up…" : values.length ? `Get started · ${values.length} picked` : "Get started"} onPress={finish} disabled={busy} />
          </View>
        </>
      ) : (
        // ---- Intro slides ----
        <>
          <Animated.View style={{ opacity: fade, flex: 1 }}>
            <View style={[s.image, { height: imgH }]}>
              <Image source={slide.img} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
              <Pressable onPress={finish} style={[s.skip, { top: space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
                <AppText variant="label">Skip</AppText>
              </Pressable>
            </View>
            <View style={s.body}>
              <AppText variant="display">{slide.title}</AppText>
              <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{slide.body}</AppText>
              <Dots />
            </View>
          </Animated.View>
          <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
            <Button title={slide.cta} onPress={advance} />
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  image: { backgroundColor: colors.surface },
  skip: { position: "absolute", right: space.gutter, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  skipInline: { alignSelf: "flex-end", paddingVertical: space.xs },
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space["3xl"] },
  dots: { flexDirection: "row", gap: space.sm, marginTop: space["2xl"] },
  dot: { width: 24, height: 4 },
  dotOn: { backgroundColor: colors.ink },
  dotOff: { backgroundColor: colors.line },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
