import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/Text";
import { colors, radius, space } from "@/lib/theme";

// Presentational building blocks for the onboarding scent quiz. Each is dumb: props in,
// onChange out. The flow, state and answer→term mapping live in app/onboarding.tsx + lib/quiz.ts.

type Option = { code: string; label: string; blurb?: string };

// ---- card choices (single or multi select) --------------------------------------------------
export function ChoiceGrid({
  options,
  selected,
  multi = false,
  onToggle,
}: {
  options: readonly Option[];
  selected: string[];
  multi?: boolean;
  onToggle: (code: string) => void;
}) {
  return (
    <View style={s.grid}>
      {options.map((o) => {
        const on = selected.includes(o.code);
        return (
          <Pressable
            key={o.code}
            onPress={() => {
              Haptics.selectionAsync();
              onToggle(o.code);
            }}
            style={[s.card, on && s.cardOn]}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
          >
            <AppText variant="title" style={[s.cardLabel, on && s.onInk]}>{o.label}</AppText>
            {o.blurb ? (
              <AppText variant="caption" style={[{ marginTop: 2 }, on && s.onInkSoft]}>{o.blurb}</AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- two-to-three way segment (gender, intensity, sweetness) --------------------------------
export function Segment({
  options,
  value,
  onChange,
}: {
  options: readonly Option[];
  value: string | null;
  onChange: (code: string) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = value === o.code;
        return (
          <Pressable
            key={o.code}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.code);
            }}
            style={[s.seg, on && s.segOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
          >
            <AppText variant="label" style={[s.segLabel, on && s.onInk]}>{o.label}</AppText>
            {o.blurb ? (
              <AppText variant="caption" style={[s.segBlurb, on && s.onInkSoft]}>{o.blurb}</AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- love / avoid note grid (tri-state per note) --------------------------------------------
// Tap cycles: neutral → love → avoid → neutral. Colour-coded so the two intents read at a glance.
export function NoteGrid({
  notes,
  loves,
  avoids,
  onCycle,
}: {
  notes: readonly string[];
  loves: string[];
  avoids: string[];
  onCycle: (note: string) => void;
}) {
  return (
    <View style={s.notes}>
      {notes.map((n) => {
        const loved = loves.includes(n);
        const avoided = avoids.includes(n);
        const state = loved ? "love" : avoided ? "avoid" : "off";
        return (
          <Pressable
            key={n}
            onPress={() => {
              Haptics.selectionAsync();
              onCycle(n);
            }}
            style={[s.note, loved && s.noteLove, avoided && s.noteAvoid]}
            accessibilityRole="button"
            accessibilityLabel={`${n}, ${state === "love" ? "loved" : state === "avoid" ? "not for me" : "no preference"}`}
          >
            {loved ? <AppText variant="caption" style={s.noteMarkLove}>♥ </AppText> : null}
            {avoided ? <AppText variant="caption" style={s.noteMarkAvoid}>✕ </AppText> : null}
            <AppText variant="label" style={[s.noteLabel, (loved || avoided) && s.onInk]}>{n}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- result card ----------------------------------------------------------------------------
export function ResultCard({ words, matchCount }: { words: string[]; matchCount: number | null }) {
  return (
    <View style={s.result}>
      <AppText variant="caption" style={{ color: colors.ink40, letterSpacing: 1 }}>YOUR SCENT PROFILE</AppText>
      <View style={s.resultWords}>
        {words.length ? (
          words.map((w, i) => (
            <View key={w} style={s.resultChip}>
              <AppText variant="label" style={{ color: colors.accentInk }}>{w}</AppText>
            </View>
          ))
        ) : (
          <AppText variant="body" style={{ marginTop: space.sm }}>We'll learn as you browse.</AppText>
        )}
      </View>
      {matchCount != null && matchCount > 0 ? (
        <AppText variant="bodySoft" style={{ marginTop: space.lg }}>
          {matchCount} {matchCount === 1 ? "scent on the shelf matches" : "scents on the shelf match"} your taste. Your home is tuned to them.
        </AppText>
      ) : (
        <AppText variant="bodySoft" style={{ marginTop: space.lg }}>
          Saved. Your home will tune to this as the shelf grows.
        </AppText>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  card: {
    minWidth: "47%",
    flexGrow: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  cardOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  cardLabel: { color: colors.ink },
  onInk: { color: colors.onInk },
  onInkSoft: { color: colors.onInk, opacity: 0.7 },

  segment: { flexDirection: "row", gap: space.sm },
  seg: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    alignItems: "center",
  },
  segOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  segLabel: { color: colors.ink },
  segBlurb: { marginTop: 2, textAlign: "center" },

  notes: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  note: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
  },
  noteLove: { backgroundColor: colors.accent, borderColor: colors.accent },
  noteAvoid: { backgroundColor: colors.ink60, borderColor: colors.ink60 },
  noteLabel: { color: colors.ink },
  noteMarkLove: { color: colors.onAccent ?? colors.onInk },
  noteMarkAvoid: { color: colors.onInk },

  result: {
    padding: space.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  resultWords: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  resultChip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    backgroundColor: colors.accentSoft ?? colors.field,
    borderRadius: radius.pill,
  },
});
