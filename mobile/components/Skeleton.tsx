import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, type DimensionValue, StyleSheet, View } from "react-native";
import { colors, space } from "@/lib/theme";

/** A single pulsing placeholder block — squared surface, no spinner. */
export function Skel({ w, h, r = 0, style }: { w?: DimensionValue; h: number; r?: number; style?: object }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.5, duration: 720, useNativeDriver: true }),
        ]),
      ).start();
    });
    return () => {
      cancelled = true;
    };
  }, [pulse]);
  return <Animated.View style={[{ width: w ?? "100%", height: h, borderRadius: r, backgroundColor: colors.surface, opacity: pulse }, style]} />;
}

/** Home first-load skeleton — mirrors the Maison layout's rhythm. */
export function HomeSkeleton({ topInset, heroW }: { topInset: number; heroW: number }) {
  return (
    <View style={{ paddingTop: topInset + space.md }}>
      <View style={s.header}>
        <Skel w={200} h={26} />
        <Skel w={32} h={32} r={16} />
      </View>
      <View style={{ marginTop: space.sm }}>
        <Skel w={heroW} h={360} />
      </View>
      <View style={s.block}>
        <Skel w={220} h={32} style={{ marginTop: space["2xl"] }} />
        <Skel w={120} h={16} style={{ marginTop: space.md }} />
      </View>
      <View style={s.rail}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 160 }}>
            <Skel h={200} />
            <Skel w={120} h={20} style={{ marginTop: space.sm }} />
            <Skel w={90} h={14} style={{ marginTop: space.xs }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter },
  block: { paddingHorizontal: space.gutter },
  rail: { flexDirection: "row", gap: space.lg, paddingHorizontal: space.gutter, marginTop: space.lg },
});
