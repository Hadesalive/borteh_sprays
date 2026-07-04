import { Eye, EyeSlash } from "phosphor-react-native";
import { useState } from "react";
import { type KeyboardTypeOptions, Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = "none",
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  minimal,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  autoFocus?: boolean;
  returnKeyType?: "next" | "done" | "go";
  onSubmitEditing?: () => void;
  minimal?: boolean;
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={s.wrap}>
      <AppText style={s.label}>{label}</AppText>
      <View style={[s.field, minimal && s.fieldMinimal]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={s.input}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"}>
            {hidden ? <Eye size={19} color={colors.inkMute} /> : <EyeSlash size={19} color={colors.inkMute} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, letterSpacing: 0.1 },
  field: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 54, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.field },
  fieldMinimal: { height: 46, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent", borderBottomWidth: 1, borderBottomColor: colors.line },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.ink, padding: 0 },
});
