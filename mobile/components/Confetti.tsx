import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import { colors } from "@/lib/theme";

// A restrained confetti burst for the order-placed moment. Built on the built-in
// Animated API (reanimated isn't installed) with the Maison palette — ink, bronze,
// a lighter bronze, and the success green of the check — never rainbow. Pieces pop
// up from the check, arc over, and settle out. Purely visual; self-unmounts.

const PALETTE = [colors.ink, colors.accent, "#B9793B", colors.success];

type Piece = {
  key: number;
  v: Animated.Value;
  color: string;
  startX: number;
  driftX: number;
  rise: number;
  fall: number;
  len: number;
  thin: number;
  round: boolean;
  spin: number;
  duration: number;
  delay: number;
};

export function Confetti({ originY = 0, count = 46 }: { originY?: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const round = i % 3 === 0;
        const len = 6 + Math.random() * 9;
        return {
          key: i,
          v: new Animated.Value(0),
          color: PALETTE[i % PALETTE.length],
          startX: width / 2 + (Math.random() - 0.5) * 80,
          driftX: (Math.random() - 0.5) * 320,
          rise: 120 + Math.random() * 220,
          fall: height,
          len,
          thin: round ? len * 0.6 : 2 + Math.random() * 3,
          round,
          spin: (2 + Math.random() * 5) * (Math.random() < 0.5 ? -1 : 1),
          duration: 2000 + Math.random() * 1100,
          delay: Math.random() * 160,
        };
      }),
    // one-shot: build once for the life of the burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.timing(p.v, { toValue: 1, duration: p.duration, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    Animated.parallel(anims).start(() => setDone(true));
  }, [pieces]);

  if (done) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => {
        const translateY = p.v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [originY, originY - p.rise, originY + p.fall] });
        const translateX = p.v.interpolate({ inputRange: [0, 1], outputRange: [p.startX, p.startX + p.driftX] });
        const rotate = p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin * 360}deg`] });
        const opacity = p.v.interpolate({ inputRange: [0, 0.08, 0.75, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={p.key}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: p.thin,
              height: p.len,
              borderRadius: p.round ? p.len / 2 : 1,
              backgroundColor: p.color,
              transform: [{ translateX }, { translateY }, { rotate }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}
