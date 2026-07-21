import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { Bell, MagnifyingGlass, SlidersHorizontal, User } from "phosphor-react-native";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { useSession } from "@/lib/auth";
import { useUnreadCount } from "@/lib/notifications";
import { colors, font, label as labelToken, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Underlined ink label — the Maison inline action ("Shop the edit", "View all", "Explore"). */
export function LinkLabel({ label, onPress, color = colors.ink }: { label: string; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} disabled={!onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ alignSelf: "flex-start", borderBottomWidth: 1, borderBottomColor: color, paddingBottom: 2 }}>
        <AppText variant="label" style={{ color }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Serif section head + optional underlined trailing link. */
export function SectionHeader({ title, trailing, onPressTrailing }: { title: string; trailing?: string; onPressTrailing?: () => void }) {
  return (
    <View style={s.section}>
      <AppText variant="heading">{title}</AppText>
      {trailing ? <LinkLabel label={trailing} onPress={onPressTrailing} /> : null}
    </View>
  );
}

/** Monogram avatar; falls back to a user glyph. */
export function Avatar({ initials, size = 32 }: { initials?: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {initials ? <AppText style={s.avatarTxt}>{initials}</AppText> : <User size={Math.round(size * 0.52)} color={colors.ink40} />}
    </View>
  );
}

/** Bell with an unread-count badge (bronze — the header's one accent). */
export function BellButton({ onPress, count = 0, light = false }: { onPress?: () => void; count?: number; light?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
    >
      <Bell size={24} color={light ? "rgba(250,248,245,0.96)" : colors.ink} weight="regular" />
      {count > 0 ? (
        <View style={s.bellBadge}>
          <AppText style={s.bellBadgeTxt} maxFontSizeMultiplier={1}>
            {count > 9 ? "9+" : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The standard header cluster (bell + avatar) — one source for every screen's top-right.
 *  Resolves the session monogram itself so screens don't repeat it. */
export function HeaderActions({ light = false }: { light?: boolean } = {}) {
  const router = useRouter();
  const session = useSession();
  const unread = useUnreadCount();
  const name = (session?.user?.user_metadata?.display_name as string | undefined)?.trim();
  const initials = name?.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || undefined;
  return (
    <View style={s.headerActions}>
      <BellButton onPress={() => router.push("/notifications")} count={unread} light={light} />
      <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" accessibilityLabel="Account">
        <Avatar initials={initials} />
      </Pressable>
    </View>
  );
}

/** Frosted round bed for controls floating over photography — the ONE sanctioned blur:
 *  functional contrast (an ink glyph is invisible on a dark bottle shot), never decoration.
 *  Blur on iOS; the paper tint keeps it readable where Android falls back to translucency. */
export function FrostCircle({ size = 36, children }: { size?: number; children: ReactNode }) {
  return (
    <View style={[s.frost, { width: size, height: size, borderRadius: size / 2 }]}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(250,248,245,0.6)" }]} />
      {children}
    </View>
  );
}

/** Squared search field with leading glass icon + trailing filter. Editable. */
export function SearchBar({
  value,
  onChangeText,
  onFilter,
  placeholder = "Search fragrances, notes, brands",
}: {
  value: string;
  onChangeText: (t: string) => void;
  onFilter?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <MagnifyingGlass size={20} color={colors.ink40} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink40}
        style={s.input}
        returnKeyType="search"
        autoCorrect={false}
      />
      {onFilter ? (
        <>
          <View style={s.searchDivider} />
          <Pressable onPress={onFilter} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filters">
            <SlidersHorizontal size={20} color={colors.ink} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** Looks like the search field but acts as a button — used on Shop to jump to Search. */
export function SearchButton({ onPress, onFilter, placeholder = "Search fragrances, notes, brands" }: { onPress: () => void; onFilter?: () => void; placeholder?: string }) {
  return (
    <View style={s.field}>
      <MagnifyingGlass size={20} color={colors.ink40} />
      <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityRole="button" accessibilityLabel="Search fragrances">
        <AppText numberOfLines={1} style={s.placeholder}>
          {placeholder}
        </AppText>
      </Pressable>
      {onFilter ? (
        <>
          <View style={s.searchDivider} />
          <Pressable onPress={onFilter} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filters">
            <SlidersHorizontal size={20} color={colors.ink} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** Squared toggle chip — ink fill when active, 1px line when idle. */
export function CategoryChip({ label, icon, active, onPress }: { label: string; icon?: ReactNode; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active ? s.chipActive : s.chipIdle]}>
      {icon}
      <AppText variant="label" style={{ color: active ? colors.onInk : colors.ink }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Squared Maison toggle — ink fill + paper knob when on, 1px line when off. */
export function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onToggle(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[s.toggle, value ? s.toggleOn : s.toggleOff]}
    >
      <View style={[s.knob, value ? s.knobOn : s.knobOff]} />
    </Pressable>
  );
}

/** Squared surface tile for a labelled category. */
export function ScentTile({ label, count, onPress, style }: { label: string; count?: number; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={[s.scentTile, style]} accessibilityRole="button" accessibilityLabel={`Shop ${label}`}>
      <AppText variant="serif20">{label}</AppText>
      {count != null ? (
        <AppText variant="caption" style={{ marginTop: 2 }}>
          {count} {count === 1 ? "scent" : "scents"}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: space.gutter },
  avatar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarTxt: { fontFamily: font.semibold, fontSize: 12, color: colors.ink },
  bellBadge: { position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 999, paddingHorizontal: 3, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  bellBadgeTxt: { fontFamily: font.semibold, fontSize: 10, lineHeight: 12, color: colors.paper },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.lg },
  frost: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  toggle: { width: 44, height: 24, padding: 2, borderWidth: 1, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.ink, borderColor: colors.ink, alignItems: "flex-end" },
  toggleOff: { backgroundColor: "transparent", borderColor: colors.line, alignItems: "flex-start" },
  knob: { width: 18, height: 18 },
  knobOn: { backgroundColor: colors.paper },
  knobOff: { backgroundColor: colors.ink40 },
  field: { flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  searchDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: space.md, backgroundColor: colors.line },
  input: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.ink, padding: 0 },
  placeholder: { fontFamily: font.regular, fontSize: 14, color: colors.ink40 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: space.sm },
  chipActive: { backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink },
  chipIdle: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  scentTile: { minHeight: 72, backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: "center" },
});
