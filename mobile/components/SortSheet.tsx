import * as Haptics from "expo-haptics";
import { Check } from "phosphor-react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SORT_OPTIONS, type SortKey } from "@/lib/search";
import { colors, space } from "@/lib/theme";
import { AppText } from "./Text";

/** Sort picker — Maison bottom sheet: paper, 1px top border, h56 rows, check on the active row. */
export function SortSheet({ visible, current, onSelect, onClose }: { visible: boolean; current: SortKey; onSelect: (k: SortKey) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sort" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={s.header}>
            <AppText variant="heading">Sort by</AppText>
          </View>
          {SORT_OPTIONS.map((o) => {
            const active = o.key === current;
            return (
              <Pressable
                key={o.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(o.key);
                  onClose();
                }}
                style={s.row}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText variant="body" style={{ flex: 1, color: active ? colors.ink : colors.ink60 }}>
                  {o.label}
                </AppText>
                {active ? <Check size={20} color={colors.ink} weight="regular" /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(34,30,25,0.4)" },
  sheet: { backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.gutter },
  header: { paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
});
