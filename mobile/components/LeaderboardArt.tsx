import { memo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import { colors } from "@/lib/theme";

// House-drawn ornaments for the leaderboard — a laurel, a trophy, and the guilloche
// engraving that ties back to the member card. Pure line/leaf work, Maison palette,
// no gradients. These carry the "special occasion" feeling a plain list can't.

/** Laurel wreath, open at the top — leaves radiating around a circle. Frames the champion. */
export const Laurel = memo(function Laurel({ size = 120, color = colors.accent }: { size?: number; color?: string }) {
  const c = size / 2;
  const R = size * 0.38;
  const leafRx = size * 0.085;
  const leafRy = size * 0.038;
  const angles: number[] = [];
  for (let a = 118; a <= 422; a += 22) {
    const m = ((a % 360) + 360) % 360;
    if (m > 62 && m < 118) continue; // leave the crown open at the top
    angles.push(a);
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} pointerEvents="none">
      {angles.map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const x = c + R * Math.cos(rad);
        const y = c + R * Math.sin(rad);
        return (
          <Ellipse
            key={i}
            cx={x}
            cy={y}
            rx={leafRx}
            ry={leafRy}
            fill={color}
            opacity={0.92}
            rotation={a - 20}
            originX={x}
            originY={y}
          />
        );
      })}
      {/* two closing berries at the base */}
      <Circle cx={c - leafRx} cy={c + R + 1} r={size * 0.02} fill={color} />
      <Circle cx={c + leafRx} cy={c + R + 1} r={size * 0.02} fill={color} />
    </Svg>
  );
});

/** A cup trophy, filled bronze with a thin rim. The screen's emblem. */
export const Trophy = memo(function Trophy({ size = 46, color = colors.accent }: { size?: number; color?: string }) {
  const w = size;
  const h = size * (56 / 48);
  return (
    <Svg width={w} height={h} viewBox="0 0 48 56" pointerEvents="none">
      <Path d="M12 10 C4 10 4 23 14 23" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M36 10 C44 10 44 23 34 23" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M11 6 H37 V15 C37 27 31 34 24 34 C17 34 11 27 11 15 Z" fill={color} />
      <Path d="M21.5 34 H26.5 V42 H21.5 Z" fill={color} />
      <Path d="M16 42 H32 V45 H16 Z" fill={color} />
      <Path d="M12.5 52 L16 45 H32 L35.5 52 Z" fill={color} />
    </Svg>
  );
});

/** Concentric guilloche rings — the member-card engraving, sized for a pedestal face.
 *  Ghost-bronze hairlines on the ink block; drawn in real pixels so it fills the face. */
export const Guilloche = memo(function Guilloche({ w, h }: { w: number; h: number }) {
  const maxR = Math.hypot(w, h);
  const rings = Array.from({ length: Math.ceil(maxR / 11) }, (_, i) => i);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {rings.map((i) => (
        <Circle
          key={i}
          cx={w / 2}
          cy={h + 2}
          r={8 + i * 11}
          stroke={i % 4 === 1 ? "rgba(138,83,39,0.45)" : "rgba(250,248,245,0.08)"}
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
});
