import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { colors } from "@/lib/theme";

// Maison dual-thumb range slider — 2px line track, ink active segment, round paper
// thumbs with an ink border (the design's one round control besides avatars/knobs).
// Pure RN (PanResponder), snapped to `step`, haptic tick per step.

const THUMB = 20;

export function RangeSlider({
  min,
  max,
  step,
  low,
  high,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}) {
  const [width, setWidth] = useState(0);
  // Refs so the responders always see current values/width (they're created once).
  const state = useRef({ low, high, width: 0, min, max, step, onChange });
  state.current = { low, high, width, min, max, step, onChange };
  const grabbed = useRef<{ from: number }>({ from: 0 });

  const usable = Math.max(1, width - THUMB);
  const toX = (v: number) => ((v - min) / Math.max(1, max - min)) * usable;

  const makeResponder = (thumb: "low" | "high") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grabbed.current.from = thumb === "low" ? state.current.low : state.current.high;
      },
      onPanResponderMove: (_e, g) => {
        const s = state.current;
        const range = Math.max(1, s.max - s.min);
        const usableW = Math.max(1, s.width - THUMB);
        const raw = grabbed.current.from + (g.dx / usableW) * range;
        const snapped = Math.round(raw / s.step) * s.step;
        if (thumb === "low") {
          const next = Math.max(s.min, Math.min(snapped, s.high - s.step));
          if (next !== s.low) {
            Haptics.selectionAsync();
            s.onChange(next, s.high);
          }
        } else {
          const next = Math.min(s.max, Math.max(snapped, s.low + s.step));
          if (next !== s.high) {
            Haptics.selectionAsync();
            s.onChange(s.low, next);
          }
        }
      },
    });

  const lowPan = useMemo(() => makeResponder("low"), []);
  const highPan = useMemo(() => makeResponder("high"), []);

  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={s.track} />
      {width > 0 ? (
        <>
          <View style={[s.active, { left: toX(low) + THUMB / 2, width: Math.max(0, toX(high) - toX(low)) }]} />
          <View {...lowPan.panHandlers} style={[s.thumb, { left: toX(low) }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="adjustable" accessibilityLabel="Minimum price" />
          <View {...highPan.panHandlers} style={[s.thumb, { left: toX(high) }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="adjustable" accessibilityLabel="Maximum price" />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 32, justifyContent: "center" },
  track: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: colors.line },
  active: { position: "absolute", height: 2, backgroundColor: colors.ink },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.ink },
});
