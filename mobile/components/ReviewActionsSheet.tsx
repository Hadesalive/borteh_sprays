import * as Haptics from "expo-haptics";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";
import { AppText } from "./Text";

export type SheetOption<T extends string> = { key: T; label: string; destructive?: boolean };

/**
 * A bottom sheet of choices, in the SortSheet mould.
 *
 * Deliberately not `Alert.alert`: Android caps an alert at three buttons and
 * silently drops the rest, which would have hidden two of the four report
 * reasons on every Android phone.
 */
export function ReviewActionsSheet<T extends string>({
  visible,
  title,
  description,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  description?: string;
  options: SheetOption<T>[];
  onSelect: (key: T) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={`Close ${title.toLowerCase()}`} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={s.header}>
            <AppText variant="heading">{title}</AppText>
            {description ? (
              <AppText variant="bodySoft" style={{ marginTop: space.xs }}>
                {description}
              </AppText>
            ) : null}
          </View>

          {options.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                onSelect(o.key);
              }}
              style={s.row}
              accessibilityRole="button"
            >
              <AppText variant="body" style={{ flex: 1, color: o.destructive ? colors.error : colors.ink }}>
                {o.label}
              </AppText>
            </Pressable>
          ))}

          <Pressable onPress={onClose} style={s.row} accessibilityRole="button">
            <AppText variant="body" style={{ flex: 1, color: colors.ink60 }}>
              Cancel
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(34,30,25,0.4)" },
  sheet: { backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.gutter },
  header: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
});
