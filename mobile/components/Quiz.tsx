import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Animated from "react-native-reanimated";
import { AppText } from "@/components/Text";
import { usePressScale } from "@/lib/animations";
import { Colors, radius, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";

// Presentational building blocks for the onboarding scent quiz. Each is dumb: props in,
// onChange out. The flow, state and answer→term mapping live in app/onboarding.tsx + lib/quiz.ts.

type Option = { code: string; label: string; blurb?: string; image?: ImageSourcePropType };

// ---- card choices (single or multi select; optional image-led "world" card) -----------------
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
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.grid}>
      {options.map((o) => (
        <ChoiceCard key={o.code} option={o} on={selected.includes(o.code)} multi={multi} onToggle={onToggle} s={s} />
      ))}
    </View>
  );
}

function ChoiceCard({
  option: o, on, multi, onToggle, s,
}: {
  option: Option; on: boolean; multi: boolean; onToggle: (code: string) => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const hasImage = !!o.image;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onToggle(o.code); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ checked: on }}
      accessibilityLabel={o.label}
    >
      <Animated.View style={[hasImage ? s.imgCard : s.card, on && s.cardOn, pressStyle]}>
        {hasImage ? (
          <View style={hasImage ? { flexDirection: "row", alignItems: "center", gap: space.md } : undefined}>
            <Image source={o.image} style={s.imgCardThumb} contentFit="cover" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="title" style={[s.cardLabel, on && s.onInk]}>{o.label}</AppText>
              {o.blurb ? <AppText variant="caption" style={[{ marginTop: 2 }, on && s.onInkSoft]}>{o.blurb}</AppText> : null}
            </View>
            {on ? <AppText variant="bodySoft" style={s.yesTag}>yes</AppText> : null}
          </View>
        ) : (
          <>
            <AppText variant="title" style={[s.cardLabel, on && s.onInk]}>{o.label}</AppText>
            {o.blurb ? <AppText variant="caption" style={[{ marginTop: 2 }, on && s.onInkSoft]}>{o.blurb}</AppText> : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ---- roman-numeral single-select list ("who's it for?") -------------------------------------
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"] as const;

export function RomanList({
  options,
  value,
  onChange,
}: {
  options: readonly Option[];
  value: string | null;
  onChange: (code: string) => void;
}) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View>
      {options.map((o, i) => {
        const on = value === o.code;
        return <RomanRow key={o.code} numeral={ROMAN[i] ?? String(i + 1)} option={o} on={on} onChange={onChange} first={i === 0} colors={colors} s={s} />;
      })}
    </View>
  );
}

function RomanRow({
  numeral, option: o, on, onChange, first, colors, s,
}: {
  numeral: string; option: Option; on: boolean; onChange: (code: string) => void; first: boolean;
  colors: Colors; s: ReturnType<typeof makeStyles>;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onChange(o.code); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={o.label}
    >
      <Animated.View style={[s.romanRow, first && s.romanRowFirst, pressStyle]}>
        <AppText variant="bodySoft" style={s.romanNumeral}>{numeral}.</AppText>
        <AppText variant="display" style={[s.romanLabel, !on && { color: colors.ink40 }]}>{o.label}</AppText>
        {on ? <AppText variant="bodySoft" style={s.romanNoted}>— noted</AppText> : null}
      </Animated.View>
    </Pressable>
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
  const s = useThemedStyles(makeStyles);
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

// ---- love / avoid note grid (tri-state per note), grouped by category -----------------------
// Tap cycles: neutral → love → avoid → neutral. Colour-coded so the two intents read at a glance.
export type CategorizedNote = { name: string; category: string };

export function NoteGrid({
  notes,
  loves,
  avoids,
  onCycle,
}: {
  notes: readonly CategorizedNote[];
  loves: string[];
  avoids: string[];
  onCycle: (note: string) => void;
}) {
  const s = useThemedStyles(makeStyles);
  const groups = new Map<string, CategorizedNote[]>();
  for (const n of notes) {
    if (!groups.has(n.category)) groups.set(n.category, []);
    groups.get(n.category)!.push(n);
  }
  return (
    <View>
      {Array.from(groups.entries()).map(([category, group], i) => (
        <View key={category} style={i > 0 ? { marginTop: space.lg } : undefined}>
          <AppText variant="bodySoft" style={s.noteCategory}>{category}</AppText>
          <View style={[s.notes, { marginTop: space.sm }]}>
            {group.map(({ name: n }) => {
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
        </View>
      ))}
    </View>
  );
}

// ---- result card ----------------------------------------------------------------------------
export function ResultCard({ words, matchCount }: { words: string[]; matchCount: number | null }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
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

const makeStyles = (colors: Colors) => StyleSheet.create({
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

  imgCard: {
    width: "100%",
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  imgCardThumb: { width: 48, height: 56, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.line },
  yesTag: { fontStyle: "italic", color: colors.accent },

  romanRow: { flexDirection: "row", alignItems: "baseline", gap: space.md, paddingVertical: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  romanRowFirst: { borderTopWidth: 0 },
  romanNumeral: { width: 22, color: colors.ink40, fontStyle: "italic" },
  romanLabel: { flex: 1, color: colors.ink },
  romanNoted: { fontStyle: "italic", color: colors.accent },

  noteCategory: { fontStyle: "italic", color: colors.ink60 },

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
