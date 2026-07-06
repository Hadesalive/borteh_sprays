import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/Text";
import { CategoryChip } from "@/components/ui";
import { colors, space } from "@/lib/theme";

// A curated superset — deliberately broader than the current catalog, so a user can pick a
// note we don't stock yet and be personalized the day it lands. Stored as text (recs.user_scent_prefs).
const SCENTS = [
  "Oud", "Amber", "Vanilla", "Rose", "Musk", "Sandalwood", "Woody", "Fresh", "Citrus", "Floral",
  "Gourmand", "Spicy", "Leather", "Aquatic", "Powdery", "Sweet", "Smoky", "Green", "Fruity", "Jasmine",
  "Bergamot", "Patchouli", "Saffron", "Tonka", "Cardamom", "Tobacco", "Coconut", "Cherry", "Chocolate",
  "Coffee", "Iris", "Lavender", "Tuberose", "Incense", "Honey", "Almond", "Cinnamon", "Marine", "Oakmoss", "Vetiver",
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
      <AppText variant="label" style={s.q}>Notes & families you love</AppText>
      <AppText variant="caption" style={{ marginTop: 2 }}>Pick as many as you like — the more, the better.</AppText>
      <View style={s.chips}>
        {SCENTS.map((sc) => (
          <CategoryChip key={sc} label={sc} active={values.includes(sc)} onPress={() => toggleScent(sc)} />
        ))}
      </View>

      <AppText variant="label" style={[s.q, { marginTop: space.xl }]}>Show me</AppText>
      <View style={s.chips}>
        {GENDERS.map((g) => (
          <CategoryChip key={g.code} label={g.label} active={gender === g.code} onPress={() => pickGender(g.code)} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  q: { color: colors.ink60 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
});
