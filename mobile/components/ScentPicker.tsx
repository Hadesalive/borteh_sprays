import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/Text";
import { CategoryChip } from "@/components/ui";
import { Colors, space } from "@/lib/theme";
import { useThemedStyles } from "@/lib/theme-context";

// A curated superset — deliberately broader than the current catalog, so a user can pick a
// note we don't stock yet and be personalized the day it lands. Stored as text (recs.user_scent_prefs).
// Grouped by perfumery family — a flat wall of 40 chips has no way to scan; a handful of
// labeled groups does.
const SCENT_GROUPS: { label: string; items: string[] }[] = [
  { label: "Woody & earthy", items: ["Oud", "Sandalwood", "Woody", "Patchouli", "Oakmoss", "Vetiver"] },
  { label: "Warm & spiced", items: ["Amber", "Spicy", "Saffron", "Tonka", "Cardamom", "Tobacco", "Cinnamon", "Incense"] },
  { label: "Sweet & gourmand", items: ["Vanilla", "Gourmand", "Sweet", "Coconut", "Cherry", "Chocolate", "Coffee", "Honey", "Almond", "Fruity"] },
  { label: "Floral", items: ["Rose", "Floral", "Jasmine", "Iris", "Lavender", "Tuberose"] },
  { label: "Fresh & green", items: ["Fresh", "Citrus", "Aquatic", "Green", "Marine", "Bergamot"] },
  { label: "Musk & leather", items: ["Musk", "Leather", "Powdery", "Smoky"] },
];
const GENDERS = [
  { label: "For men", code: "male" },
  { label: "For women", code: "female" },
  { label: "Anything", code: "unisex" },
];

// Controlled: manages its own selection (seeded from initial props) and reports every change up.
export function ScentPicker({
  initialValues = [],
  initialGender = null,
  onChange,
}: {
  initialValues?: string[];
  initialGender?: string | null;
  onChange: (values: string[], gender: string | null) => void;
}) {
  const s = useThemedStyles(makeStyles);
  const [values, setValues] = useState<string[]>(initialValues);
  const [gender, setGender] = useState<string | null>(initialGender);

  const toggleScent = (sc: string) => {
    Haptics.selectionAsync();
    const next = values.includes(sc) ? values.filter((v) => v !== sc) : [...values, sc];
    setValues(next);
    onChange(next, gender);
  };
  const pickGender = (g: string) => {
    Haptics.selectionAsync();
    const next = gender === g ? null : g;
    setGender(next);
    onChange(values, next);
  };

  return (
    <View>
      <View style={s.headRow}>
        <AppText variant="label" style={s.q}>Notes & families you love</AppText>
        {values.length > 0 ? <AppText variant="label" style={s.count}>{values.length} selected</AppText> : null}
      </View>
      <AppText variant="caption" style={{ marginTop: 2 }}>Pick as many as you like. The more, the better.</AppText>

      {SCENT_GROUPS.map((group) => (
        <View key={group.label} style={{ marginTop: space.lg }}>
          <AppText variant="label" style={s.groupLabel}>{group.label}</AppText>
          <View style={s.chips}>
            {group.items.map((sc) => (
              <CategoryChip key={sc} label={sc} active={values.includes(sc)} onPress={() => toggleScent(sc)} />
            ))}
          </View>
        </View>
      ))}

      {/* a single choice, not another preference list — its own bordered block
          keeps it from reading as one more row of the notes wall above */}
      <View style={s.genderBlock}>
        <AppText variant="label" style={s.q}>Show me</AppText>
        <View style={s.chips}>
          {GENDERS.map((g) => (
            <CategoryChip key={g.code} label={g.label} active={gender === g.code} onPress={() => pickGender(g.code)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  q: { color: colors.ink60 },
  headRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  count: { color: colors.accent },
  groupLabel: { color: colors.ink40 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  genderBlock: { marginTop: space["2xl"], paddingTop: space.xl, borderTopWidth: 1, borderTopColor: colors.line },
});
