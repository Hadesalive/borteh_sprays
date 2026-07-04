import { MagnifyingGlass, SlidersHorizontal, User } from "phosphor-react-native";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

export function SearchBar({
  value,
  onChangeText,
  onFilter,
  placeholder = "Search fragrances…",
}: {
  value: string;
  onChangeText: (t: string) => void;
  onFilter?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={s.searchRow}>
      <View style={s.search}>
        <MagnifyingGlass size={19} color={colors.inkMute} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={s.input}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      <Pressable onPress={onFilter} style={s.filter} accessibilityRole="button" accessibilityLabel="Filters">
        <SlidersHorizontal size={20} color={colors.onInk} />
      </Pressable>
    </View>
  );
}

export function CategoryChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active ? s.chipActive : s.chipIdle]}>
      {icon}
      <AppText variant="chip" style={{ color: active ? colors.onInk : colors.ink }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Avatar({ size = 44 }: { size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <User size={Math.round(size * 0.5)} color={colors.inkMute} />
    </View>
  );
}

export function SectionHeader({ title, trailing, onPressTrailing }: { title: string; trailing?: string; onPressTrailing?: () => void }) {
  return (
    <View style={s.section}>
      <AppText variant="title">{title}</AppText>
      {trailing ? (
        <Pressable onPress={onPressTrailing} hitSlop={8} disabled={!onPressTrailing}>
          <AppText variant="label" style={{ color: colors.accent }}>
            {trailing}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Looks like the search field but acts as a button — used on Home to jump to Shop. */
export function SearchButton({ onPress, placeholder = "Search fragrances…" }: { onPress: () => void; placeholder?: string }) {
  return (
    <Pressable style={s.searchRow} onPress={onPress} accessibilityRole="button" accessibilityLabel="Search fragrances">
      <View style={s.search}>
        <MagnifyingGlass size={19} color={colors.inkMute} />
        <AppText numberOfLines={1} style={s.searchPlaceholder}>
          {placeholder}
        </AppText>
      </View>
      <View style={s.filter}>
        <SlidersHorizontal size={20} color={colors.onInk} />
      </View>
    </Pressable>
  );
}

export function ScentTile({ label, count, onPress }: { label: string; count?: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.scentTile} accessibilityRole="button" accessibilityLabel={`Shop ${label} scents`}>
      <AppText variant="cardTitle">{label}</AppText>
      {count != null ? (
        <AppText variant="small" style={{ marginTop: 2 }}>
          {count} {count === 1 ? "scent" : "scents"}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: space.md },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  filter: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 42, paddingHorizontal: space.lg, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.accent },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  avatar: { backgroundColor: colors.field, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, marginTop: space.lg, marginBottom: space.md },
  searchPlaceholder: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.placeholder },
  scentTile: { width: 132, height: 88, borderRadius: radius.lg, backgroundColor: colors.plinth, paddingHorizontal: space.lg, justifyContent: "center" },
});
