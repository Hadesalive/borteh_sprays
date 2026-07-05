import { Eye, EyeSlash } from "phosphor-react-native";
import { useState } from "react";
import { type KeyboardTypeOptions, Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, font, space } from "@/lib/theme";
import { AppText } from "./Text";

// Maison input — h52, paper bg, 1px squared border, label above in 12px uppercase.
// Error state paints the border + helper line in `error`.
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
  error,
  helper,
  minimal, // accepted for back-compat; Maison fields are all bordered
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoFocus?: boolean;
  returnKeyType?: "next" | "done" | "go";
  onSubmitEditing?: () => void;
  error?: string;
  helper?: string;
  minimal?: boolean;
}) {
  const [hidden, setHidden] = useState(true);
  const hasError = !!error;
  return (
    <View style={s.wrap}>
      <AppText variant="label" style={{ color: hasError ? colors.error : colors.ink60 }}>
        {label}
      </AppText>
      <View style={[s.field, { borderColor: hasError ? colors.error : colors.line }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink40}
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
            {hidden ? <Eye size={20} color={colors.ink40} /> : <EyeSlash size={20} color={colors.ink40} />}
          </Pressable>
        ) : null}
      </View>
      {error || helper ? (
        <AppText variant="caption" style={{ color: hasError ? colors.error : colors.ink60 }}>
          {error || helper}
        </AppText>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.xs },
  field: { flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingHorizontal: space.lg, borderWidth: 1, backgroundColor: colors.paper },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.ink, padding: 0 },
});
