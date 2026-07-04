import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, type DimensionValue, StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";

/** A single pulsing placeholder block. */
export function Skel({ w, h, r = 8, style }: { w?: DimensionValue; h: number; r?: number; style?: object }) {
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
  return <Animated.View style={[{ width: w ?? "100%", height: h, borderRadius: r, backgroundColor: colors.field, opacity: pulse }, style]} />;
}

/** Home first-load skeleton — mirrors the real layout's rhythm. */
export function HomeSkeleton({ topInset, heroW }: { topInset: number; heroW: number }) {
  return (
    <View style={{ paddingTop: topInset + space.sm }}>
      <View style={s.header}>
        <View>
          <Skel w={150} h={22} r={6} />
          <Skel w={110} h={12} r={4} style={{ marginTop: 8 }} />
        </View>
        <Skel w={44} h={44} r={22} />
      </View>
      <View style={s.block}>
        <Skel h={54} r={radius.md} />
      </View>
      <View style={[s.block, { marginTop: space.lg }]}>
        <Skel w={heroW} h={240} r={radius.xl} />
      </View>
      <View style={s.block}>
        <Skel w={140} h={18} r={5} style={{ marginTop: space["2xl"] }} />
      </View>
      <View style={s.rail}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 168 }}>
            <Skel h={200} r={radius.lg} />
            <Skel w={120} h={14} r={4} style={{ marginTop: space.md }} />
            <Skel w={80} h={14} r={4} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl, marginBottom: space.lg },
  block: { paddingHorizontal: space.xl },
  rail: { flexDirection: "row", gap: space.md, paddingHorizontal: space.xl, marginTop: space.md },
});
