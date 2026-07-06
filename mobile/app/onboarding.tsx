import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { markOnboarded } from "@/lib/onboarding";
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
    cta: "Get started",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const imgH = Math.min(500, Math.round(height * 0.55));
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markOnboarded();
    router.replace("/(tabs)");
  };
  const next = () => {
    if (last) return finish();
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep((s) => s + 1);
  };

  return (
    // Image starts below the status bar — the bar always sits on paper, icons stay legible.
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <Animated.View style={{ opacity: fade, flex: 1 }}>
        <View style={[s.image, { height: imgH }]}>
          <Image source={slide.img} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          {!last ? (
            <Pressable onPress={finish} style={[s.skip, { top: space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
              <AppText variant="label">Skip</AppText>
            </Pressable>
          ) : null}
        </View>

        <View style={s.body}>
          <AppText variant="display">{slide.title}</AppText>
          <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{slide.body}</AppText>
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[s.dot, i === step ? s.dotOn : s.dotOff]} />
            ))}
          </View>
        </View>
      </Animated.View>

      <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
        <Button title={slide.cta} onPress={next} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  image: { backgroundColor: colors.surface },
  skip: { position: "absolute", right: space.gutter, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space["3xl"] },
  dots: { flexDirection: "row", gap: space.sm, marginTop: space["2xl"] },
  dot: { width: 24, height: 4 },
  dotOn: { backgroundColor: colors.ink },
  dotOff: { backgroundColor: colors.line },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
