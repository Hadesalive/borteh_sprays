import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from "react-native";
import ReAnimated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ChoiceGrid, NoteGrid, RomanList, Segment } from "@/components/Quiz";
import { AppText } from "@/components/Text";
import { useProducts } from "@/lib/api";
import { EASE_IN_OUT } from "@/lib/animations";
import { useContent, useOnboardingSlides } from "@/lib/content";
import { usePickedForYou } from "@/lib/feed";
import { markOnboarded } from "@/lib/onboarding";
import {
  BUDGETS, DIRECTIONS, EMPTY_ANSWERS, GENDERS, INTENSITIES, NOTES, OCCASIONS, SWEETNESS,
  quizHasSignal, saveQuizPrefs, summarize, type QuizAnswers,
} from "@/lib/quiz";
import { Colors, space } from "@/lib/theme";
import { ThemedStatusBar, useTheme, useThemedStyles } from "@/lib/theme-context";

// Bundled fallbacks — the intro must render full even offline or before the DB loads.
// The DB (public.onboarding_slide) is the source of truth; these images stay bundled and
// are matched to each DB slide by order until the owner uploads slide art.
const FALLBACK_SLIDES = [
  {
    img: require("../assets/onboarding/borteh-01.png"),
    title: "The whole maison, in your pocket.",
    body: "Every bottle, live from the Freetown counter.",
  },
  {
    img: require("../assets/onboarding/borteh-06.png"),
    title: "Make it yours.",
    body: "Save what you love; hear when it returns.",
  },
  {
    img: require("../assets/onboarding/borteh-04.png"),
    title: "Order without the errand.",
    body: "Pay the rider at your door, follow every step.",
  },
];

// The quiz, as an ordered list of questions. Each declares whether it carries an answer yet
// (drives the button label), keeping app/onboarding.tsx a thin state machine over lib/quiz.ts.
type QuizStep = { key: string; title: string; body: string };
const QUIZ_STEPS: QuizStep[] = [
  { key: "gender", title: "Who's it for?", body: "We'll lead with the right side of the shelf." },
  { key: "world", title: "Pick your world", body: "Choose any that pull you in. The more, the sharper." },
  { key: "character", title: "How should it feel?", body: "Loudness and sweetness set the whole mood." },
  { key: "notes", title: "Notes you love, or don't", body: "Tap once for love, twice for not-for-me." },
  { key: "context", title: "When & how much?", body: "So we suggest what fits the moment and the budget." },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const CAROUSEL_MS = 4000;
const SPLASH_MS = 1600;
// Every phase's content sits in a column capped at this width and centered.
// A no-op on phones (already narrower than this), it's what keeps the hero
// image, quiz copy, and CTA from stretching edge-to-edge into a sparse,
// oversized crop on iPad — the same "readable column" iPad apps reach for
// instead of redesigning proportions per screen size.
const MAX_CONTENT_W = 480;
// A dedicated decorative rose for the falling petals — not colors.error. They
// happened to be the same red before; that borrowed a token reserved for
// functional error/destructive states for a purely decorative flourish, and
// would have silently drifted if that token ever changed for unrelated reasons.
const PETAL_ROSE = "#C4573F";

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const [phase, setPhase] = useState<"splash" | "slides" | "quiz" | "result">("splash");
  const [slideStep, setSlideStep] = useState(0);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: dbSlides } = useOnboardingSlides();
  const slides =
    dbSlides && dbSlides.length
      ? dbSlides.map((sl, i) => ({ title: sl.title, body: sl.body, imageUrl: sl.imageUrl, img: (FALLBACK_SLIDES[i] ?? FALLBACK_SLIDES[0]).img }))
      : FALLBACK_SLIDES.map((sl) => ({ title: sl.title, body: sl.body, imageUrl: null as string | null, img: sl.img }));

  const skipLabel = useContent("onboarding.skip", "Skip");
  const carouselCta = useContent("onboarding.slide_cta", "Find my scent");
  const quizCta = useContent("onboarding.taste.cta", "Continue");
  const quizDone = useContent("onboarding.taste.cta_done", "See my profile");
  const finishCta = useContent("onboarding.taste.cta_finish", "Start exploring");
  const busyLabel = useContent("onboarding.taste.cta_busy", "Setting up…");

  const imgH = Math.min(500, Math.round(height * 0.55));

  // Splash: a fixed beat, then straight into the auto-playing carousel — "one continuous take".
  useEffect(() => {
    if (phase !== "splash") return;
    const id = setTimeout(() => setPhase("slides"), SPLASH_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Carousel: plays itself. Loops the 3 slides until the customer taps through to the quiz.
  useEffect(() => {
    if (phase !== "slides") return;
    const id = setInterval(() => setSlideStep((v) => (v + 1) % slides.length), CAROUSEL_MS);
    return () => clearInterval(id);
  }, [phase, slides.length]);

  const advanceQuiz = () => {
    Haptics.selectionAsync();
    if (quizStep < QUIZ_STEPS.length - 1) setQuizStep((v) => v + 1);
    else reveal();
  };

  const backQuiz = () => {
    Haptics.selectionAsync();
    if (quizStep > 0) setQuizStep((v) => v - 1);
    else setPhase("slides");
  };

  // End of the quiz: persist + seed the taste vector, then show the profile card.
  const reveal = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("result");
    if (quizHasSignal(answers)) {
      try {
        const n = await saveQuizPrefs(answers); // null when signed-out (synced on sign-in)
        setMatchCount(n);
      } catch {
        /* saved locally; syncs on sign-in */
      }
    }
  };

  // Leave onboarding for the app. Skipping mid-quiz saves whatever was answered so far.
  const finish = async (save = false) => {
    if (busy) return;
    setBusy(true);
    if (save && quizHasSignal(answers)) {
      try { await saveQuizPrefs(answers); } catch { /* best-effort */ }
    }
    markOnboarded();
    router.replace("/(tabs)");
  };

  const words = useMemo(() => summarize(answers), [answers]);

  // ---- SPLASH --------------------------------------------------------------------------------
  if (phase === "splash") {
    return <SplashScene />;
  }

  // ---- SLIDES (auto-playing carousel) ---------------------------------------------------------
  if (phase === "slides") {
    const slide = slides[slideStep];
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <ThemedStatusBar />
        <View style={s.content}>
          <View style={[s.image, { height: imgH }]}>
            <CarouselSlide key={slideStep} source={slide.imageUrl ? { uri: slide.imageUrl } : slide.img} />
            <Pressable onPress={() => finish(false)} style={[s.skip, { top: space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={skipLabel}>
              <AppText variant="label">{skipLabel}</AppText>
            </Pressable>
          </View>
          <View style={s.body}>
            <ReAnimated.View key={slideStep} entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)}>
              <RomanProgress total={slides.length} index={slideStep} />
              <AppText variant="display" style={{ marginTop: space.md }}>{slide.title}</AppText>
              <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{slide.body}</AppText>
            </ReAnimated.View>
          </View>
          <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
            <Button title={carouselCta} onPress={() => { Haptics.selectionAsync(); setPhase("quiz"); }} />
          </View>
        </View>
      </View>
    );
  }

  // ---- RESULT ------------------------------------------------------------------------------
  if (phase === "result") {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <ThemedStatusBar />
        <View style={s.content}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <ProgressBar fraction={1} />
            <AppText variant="label" style={[s.eyebrow, { marginTop: space.xl }]}>Your scent profile</AppText>
            <AppText variant="display" style={{ marginTop: space.sm }}>
              {words.length ? words.join(".\n") + "." : "We'll learn as you browse."}
            </AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.md, maxWidth: 300 }}>
              {matchCount != null && matchCount > 0
                ? `${matchCount} ${matchCount === 1 ? "scent" : "scents"} on the shelf match your taste. Your home is tuned to them.`
                : "Saved. Your home will tune to this as the shelf grows."}
            </AppText>
            <ClosestMatches />
          </ScrollView>
          <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
            <Button title={busy ? busyLabel : finishCta} onPress={() => finish(false)} disabled={busy} />
          </View>
        </View>
      </View>
    );
  }

  // ---- QUIZ --------------------------------------------------------------------------------
  const step = QUIZ_STEPS[quizStep];
  const answered = ((): boolean => {
    switch (step.key) {
      case "gender": return !!answers.gender;
      case "world": return answers.directions.length > 0;
      case "character": return !!(answers.intensity || answers.sweetness);
      case "notes": return answers.loves.length + answers.avoids.length > 0;
      case "context": return answers.occasions.length > 0 || !!answers.budget;
      default: return false;
    }
  })();
  const isLast = quizStep === QUIZ_STEPS.length - 1;

  const toggleInArray = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // Note tri-state: neutral → love → avoid → neutral.
  const cycleNote = (n: string) => {
    setAnswers((a) => {
      if (a.loves.includes(n)) return { ...a, loves: a.loves.filter((x) => x !== n), avoids: [...a.avoids, n] };
      if (a.avoids.includes(n)) return { ...a, avoids: a.avoids.filter((x) => x !== n) };
      return { ...a, loves: [...a.loves, n] };
    });
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ThemedStatusBar />
      <View style={s.content}>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.md }}>
          <ProgressBar fraction={(quizStep + 1) / QUIZ_STEPS.length} />
        </View>
        <View style={s.topBar}>
          <Pressable onPress={backQuiz} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <AppText variant="label" style={{ color: colors.ink40 }}>← Back</AppText>
          </Pressable>
          <Pressable onPress={() => finish(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={skipLabel}>
            <AppText variant="label" style={{ color: colors.ink40 }}>{skipLabel}</AppText>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <ReAnimated.View key={quizStep} entering={FadeIn.duration(250)} exiting={FadeOut.duration(120)}>
            <AppText variant="body" style={s.stepEyebrow}>Question {quizStep + 1} of {QUIZ_STEPS.length}</AppText>
            <AppText variant="display" style={{ marginTop: space.xs }}>{step.title}</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{step.body}</AppText>

            <View style={{ marginTop: space["2xl"], gap: space.xl }}>
              {step.key === "gender" && (
                <RomanList options={GENDERS} value={answers.gender} onChange={(g) => setAnswers((a) => ({ ...a, gender: g }))} />
              )}

              {step.key === "world" && (
                <ChoiceGrid options={DIRECTIONS} selected={answers.directions} multi onToggle={(c) => setAnswers((a) => ({ ...a, directions: toggleInArray(a.directions, c) }))} />
              )}

              {step.key === "character" && (
                <>
                  <View>
                    <AppText variant="label" style={s.q}>Intensity</AppText>
                    <View style={{ marginTop: space.sm }}>
                      <Segment options={INTENSITIES} value={answers.intensity} onChange={(v) => setAnswers((a) => ({ ...a, intensity: v }))} />
                    </View>
                  </View>
                  <View>
                    <AppText variant="label" style={s.q}>Sweetness</AppText>
                    <View style={{ marginTop: space.sm }}>
                      <Segment options={SWEETNESS} value={answers.sweetness} onChange={(v) => setAnswers((a) => ({ ...a, sweetness: v }))} />
                    </View>
                  </View>
                </>
              )}

              {step.key === "notes" && (
                <NoteGrid notes={NOTES} loves={answers.loves} avoids={answers.avoids} onCycle={cycleNote} />
              )}

              {step.key === "context" && (
                <>
                  <View>
                    <AppText variant="label" style={s.q}>Occasions</AppText>
                    <View style={{ marginTop: space.sm }}>
                      <ChoiceGrid options={OCCASIONS} selected={answers.occasions} multi onToggle={(c) => setAnswers((a) => ({ ...a, occasions: toggleInArray(a.occasions, c) }))} />
                    </View>
                  </View>
                  <View>
                    <AppText variant="label" style={s.q}>Budget</AppText>
                    <View style={{ marginTop: space.sm }}>
                      <Segment options={BUDGETS} value={answers.budget} onChange={(v) => setAnswers((a) => ({ ...a, budget: v }))} />
                    </View>
                  </View>
                </>
              )}
            </View>
          </ReAnimated.View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
          <Button
            title={isLast ? quizDone : answered ? quizCta : "Skip this one"}
            onPress={advanceQuiz}
            variant={isLast ? "primary" : answered ? "primary" : "secondary"}
          />
        </View>
      </View>
    </View>
  );
}

// ---- splash: floating mark + falling petals, one fixed beat before the carousel -------------
function SplashScene() {
  const s = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const markY = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    markY.set(withRepeat(withSequence(
      withTiming(-8, { duration: 2200, easing: EASE_IN_OUT }),
      withTiming(0, { duration: 2200, easing: EASE_IN_OUT }),
    ), -1, true));
  }, [reduced, markY]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: markY.get() }] }));

  return (
    <View style={s.splashScreen}>
      <ThemedStatusBar />
      {!reduced && (
        <>
          <Petal delayMs={0} durationMs={5000} leftPct={18} topPx={120} size={22} bronze={false} />
          <Petal delayMs={1200} durationMs={6500} leftPct={51} topPx={90} size={16} bronze={false} />
          <Petal delayMs={2600} durationMs={5600} leftPct={82} topPx={140} size={19} bronze={false} />
          <Petal delayMs={3400} durationMs={7000} leftPct={64} topPx={60} size={13} bronze />
        </>
      )}
      <View style={s.splashCenter}>
        <ReAnimated.View style={markStyle}>
          <Image source={require("../assets/splash-icon.png")} style={s.splashMark} contentFit="contain" />
        </ReAnimated.View>
        <AppText variant="display" style={{ marginTop: space.lg }}>Borteh Sprays</AppText>
        <AppText variant="serif20" style={s.splashTag}>smell good today.</AppText>
      </View>
    </View>
  );
}

function Petal({ delayMs, durationMs, leftPct, topPx, size, bronze }: {
  delayMs: number; durationMs: number; leftPct: number; topPx: number; size: number; bronze: boolean;
}) {
  const { colors } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delayMs, withRepeat(withTiming(1, { duration: durationMs, easing: Easing.linear }), -1, false)));
  }, [delayMs, durationMs, t]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: interpolate(p, [0, 0.12, 0.88, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: interpolate(p, [0, 1], [-60, 240]) },
        { rotate: `${interpolate(p, [0, 1], [-30, 50])}deg` },
      ],
    };
  });
  return (
    <ReAnimated.View
      style={[
        styles.petal,
        { left: `${leftPct}%`, top: topPx, width: size, height: size, backgroundColor: bronze ? colors.accent : PETAL_ROSE, opacity: bronze ? 0.7 : 1 },
        style,
      ]}
    />
  );
}

// ---- carousel image layer: Ken Burns while active, crossfades in/out on mount/unmount --------
function CarouselSlide({ source }: { source: ImageSourcePropType }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduced) scale.set(withTiming(1.08, { duration: CAROUSEL_MS, easing: Easing.linear }));
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <ReAnimated.View entering={FadeIn.duration(600)} exiting={FadeOut.duration(600)} style={StyleSheet.absoluteFill}>
      <ReAnimated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      </ReAnimated.View>
    </ReAnimated.View>
  );
}

// ---- roman-numeral row (carousel progress) ----------------------------------------------------
function RomanProgress({ total, index }: { total: number; index: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      {Array.from({ length: total }).map((_, i) => (
        <AppText key={i} variant="bodySoft" style={{ color: i === index ? colors.ink : colors.ink40 }}>{ROMAN[i] ?? i + 1}</AppText>
      ))}
    </View>
  );
}

// ---- thin proportional progress bar (quiz + result) -------------------------------------------
function ProgressBar({ fraction }: { fraction: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 2, backgroundColor: fraction >= 1 ? colors.accent : colors.line }}>
      {fraction < 1 ? <View style={{ width: `${Math.round(fraction * 100)}%`, height: 2, backgroundColor: colors.accent }} /> : null}
    </View>
  );
}

// ---- "closest matches" — top 3 of the same personalized rail the home feed uses --------------
function ClosestMatches() {
  const { data: products } = useProducts();
  const { data: pickedIds } = usePickedForYou(true);
  const s = useThemedStyles(makeStyles);
  const matches = useMemo(() => {
    if (!products || !pickedIds) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return pickedIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 3);
  }, [products, pickedIds]);
  if (!matches.length) return null;
  return (
    <View style={{ marginTop: space["2xl"] }}>
      <AppText variant="label" style={s.eyebrow}>Closest matches</AppText>
      <View style={{ flexDirection: "row", gap: space.md, marginTop: space.md }}>
        {matches.map((p) => (
          <View key={p.id} style={{ flex: 1 }}>
            <View style={s.matchArch}>
              {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <AppText variant="body" numberOfLines={1} style={{ marginTop: space.sm }}>{p.name}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  petal: { position: "absolute", borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomRightRadius: 999, borderBottomLeftRadius: 0 },
});

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, width: "100%", maxWidth: MAX_CONTENT_W, alignSelf: "center" },
  image: { backgroundColor: colors.surface, overflow: "hidden" },
  skip: { position: "absolute", right: space.gutter, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.xs },
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space["3xl"] },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space["3xl"] },
  q: { color: colors.ink60 },
  eyebrow: { color: colors.ink40 },
  stepEyebrow: { fontStyle: "italic", color: colors.accent },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },

  splashScreen: { flex: 1, backgroundColor: colors.paper },
  splashCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  splashMark: { width: 140, height: 140 },
  splashTag: { marginTop: space.sm, fontStyle: "italic", color: colors.accent },

  matchArch: { height: 130, borderTopLeftRadius: 56, borderTopRightRadius: 56, backgroundColor: colors.surface, overflow: "hidden" },
});
