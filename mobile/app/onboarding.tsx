import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ChoiceGrid, NoteGrid, ResultCard, Segment } from "@/components/Quiz";
import { AppText } from "@/components/Text";
import { useContent, useOnboardingSlides } from "@/lib/content";
import { markOnboarded } from "@/lib/onboarding";
import {
  BUDGETS, DIRECTIONS, EMPTY_ANSWERS, GENDERS, INTENSITIES, NOTES, OCCASIONS, SWEETNESS,
  quizHasSignal, saveQuizPrefs, summarize, type QuizAnswers,
} from "@/lib/quiz";
import { colors, space } from "@/lib/theme";

// Bundled fallbacks — the intro must render full even offline or before the DB loads.
// The DB (public.onboarding_slide) is the source of truth; these images stay bundled and
// are matched to each DB slide by order until the owner uploads slide art.
const FALLBACK_SLIDES = [
  {
    img: require("../assets/home/hero-rose.jpg"),
    title: "The whole maison, in your pocket.",
    body: "Browse every fragrance on the shelf, with live stock straight from the Freetown counter.",
  },
  {
    img: require("../assets/home/scent/oriental.jpg"),
    title: "Make it yours.",
    body: "Save the scents you love, leave reviews, and get told the moment a sold-out bottle returns.",
  },
  {
    img: require("../assets/home/collections/date-night.jpg"),
    title: "Order without the errand.",
    body: "Check out in the app, pay the rider at your door, and follow every step on the way.",
  },
];

// The quiz, as an ordered list of questions. Each declares whether it carries an answer yet
// (drives the button label), keeping app/onboarding.tsx a thin state machine over lib/quiz.ts.
type QuizStep = { key: string; title: string; body: string };
const QUIZ_STEPS: QuizStep[] = [
  { key: "gender", title: "Who's it for?", body: "We'll lead with the right side of the shelf." },
  { key: "world", title: "Pick your world", body: "Choose any that pull you in — the more, the sharper." },
  { key: "character", title: "How should it feel?", body: "Loudness and sweetness set the whole mood." },
  { key: "notes", title: "Notes you love — or don't", body: "Tap once for love, twice for not-for-me." },
  { key: "context", title: "When & how much?", body: "So we suggest what fits the moment and the budget." },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [phase, setPhase] = useState<"slides" | "quiz" | "result">("slides");
  const [slideStep, setSlideStep] = useState(0);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  const { data: dbSlides } = useOnboardingSlides();
  const slides =
    dbSlides && dbSlides.length
      ? dbSlides.map((sl, i) => ({ title: sl.title, body: sl.body, imageUrl: sl.imageUrl, img: (FALLBACK_SLIDES[i] ?? FALLBACK_SLIDES[0]).img }))
      : FALLBACK_SLIDES.map((sl) => ({ title: sl.title, body: sl.body, imageUrl: null as string | null, img: sl.img }));

  const skipLabel = useContent("onboarding.skip", "Skip");
  const slideCta = useContent("onboarding.slide_cta", "Continue");
  const quizIntro = useContent("onboarding.taste.title", "Let's find your scent");
  const quizCta = useContent("onboarding.taste.cta", "Continue");
  const quizDone = useContent("onboarding.taste.cta_done", "See my profile");
  const finishCta = useContent("onboarding.taste.cta_finish", "Start exploring");
  const busyLabel = useContent("onboarding.taste.cta_busy", "Setting up…");

  const TOTAL = slides.length + QUIZ_STEPS.length; // dots span slides + quiz (result = full)
  const dotIndex = phase === "slides" ? slideStep : phase === "quiz" ? slides.length + quizStep : TOTAL;
  const imgH = Math.min(500, Math.round(height * 0.55));

  const animate = () => {
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const advanceSlide = () => {
    Haptics.selectionAsync();
    animate();
    if (slideStep < slides.length - 1) setSlideStep((s) => s + 1);
    else setPhase("quiz");
  };

  const advanceQuiz = () => {
    Haptics.selectionAsync();
    animate();
    if (quizStep < QUIZ_STEPS.length - 1) setQuizStep((s) => s + 1);
    else reveal();
  };

  const backQuiz = () => {
    Haptics.selectionAsync();
    animate();
    if (quizStep > 0) setQuizStep((s) => s - 1);
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

  const Dots = () => (
    <View style={s.dots}>
      {Array.from({ length: TOTAL }).map((_, i) => (
        <View key={i} style={[s.dot, i === dotIndex ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );

  // ---- SLIDES ------------------------------------------------------------------------------
  if (phase === "slides") {
    const slide = slides[Math.min(slideStep, slides.length - 1)];
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Animated.View style={{ opacity: fade, flex: 1 }}>
          <View style={[s.image, { height: imgH }]}>
            <Image source={slide.imageUrl ? { uri: slide.imageUrl } : slide.img} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
            <Pressable onPress={() => finish(false)} style={[s.skip, { top: space.md }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={skipLabel}>
              <AppText variant="label">{skipLabel}</AppText>
            </Pressable>
          </View>
          <View style={s.body}>
            <AppText variant="display">{slide.title}</AppText>
            <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{slide.body}</AppText>
            <Dots />
          </View>
        </Animated.View>
        <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
          <Button title={slideCta} onPress={advanceSlide} />
        </View>
      </View>
    );
  }

  // ---- RESULT ------------------------------------------------------------------------------
  if (phase === "result") {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <AppText variant="display">{quizIntro}</AppText>
          <View style={{ marginTop: space["2xl"] }}>
            <ResultCard words={words} matchCount={matchCount} />
          </View>
          <Dots />
        </ScrollView>
        <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
          <Button title={busy ? busyLabel : finishCta} onPress={() => finish(false)} disabled={busy} />
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
      <StatusBar style="dark" />
      <View style={s.topBar}>
        <Pressable onPress={backQuiz} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <AppText variant="label" style={{ color: colors.ink40 }}>← Back</AppText>
        </Pressable>
        <Pressable onPress={() => finish(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={skipLabel}>
          <AppText variant="label" style={{ color: colors.ink40 }}>{skipLabel}</AppText>
        </Pressable>
      </View>

      <Animated.View style={{ opacity: fade, flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <AppText variant="display">{step.title}</AppText>
          <AppText variant="bodySoft" style={{ marginTop: space.sm }}>{step.body}</AppText>

          <View style={{ marginTop: space["2xl"], gap: space.xl }}>
            {step.key === "gender" && (
              <Segment options={GENDERS} value={answers.gender} onChange={(g) => setAnswers((a) => ({ ...a, gender: g }))} />
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

          <Dots />
        </ScrollView>
      </Animated.View>

      <View style={[s.footer, { paddingBottom: insets.bottom + space["2xl"] }]}>
        <Button
          title={isLast ? quizDone : answered ? quizCta : "Skip this one"}
          onPress={advanceQuiz}
          variant={isLast ? "primary" : answered ? "primary" : "secondary"}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  image: { backgroundColor: colors.surface },
  skip: { position: "absolute", right: space.gutter, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.xs },
  body: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space["3xl"] },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space["3xl"] },
  q: { color: colors.ink60 },
  dots: { flexDirection: "row", gap: space.sm, marginTop: space["2xl"] },
  dot: { width: 24, height: 4 },
  dotOn: { backgroundColor: colors.ink },
  dotOff: { backgroundColor: colors.line },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
});
