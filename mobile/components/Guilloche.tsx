import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";

// The maison's signature engraving — fine concentric ripples radiating from one corner over a
// linen hairline ground, the same guilloche used on the loyalty member card. Pure line work
// (no fills, no gradients). Reused as a texture on the "shop by note" cards and the active nav
// chip so the whole app reads as one crafted object.

// SVG element ids must be unique across every <Svg> mounted at once, so each instance salts its
// linen pattern id from this counter.
let uid = 0;

export function Guilloche({
  w,
  h,
  origin = "topLeft",
  ringGap = 12,
  start = 10,
  base = "rgba(250,248,245,0.10)",
  accent = "rgba(138,83,39,0.35)",
  accentEvery = 5,
  linen = true,
}: {
  w: number;
  h: number;
  origin?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  ringGap?: number;
  start?: number;
  base?: string;
  accent?: string;
  accentEvery?: number;
  linen?: boolean;
}) {
  const maxR = Math.hypot(w, h) + 36;
  const [ox, oy] =
    origin === "topLeft" ? [-6, -6]
    : origin === "topRight" ? [w + 6, -6]
    : origin === "bottomLeft" ? [-6, h + 6]
    : [w + 6, h + 6];
  const count = Math.max(0, Math.ceil((maxR - start) / ringGap));
  const patternId = `guilloche-linen-${(uid += 1)}`;

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {linen ? (
        <>
          <Defs>
            <Pattern id={patternId} patternUnits="userSpaceOnUse" width={4} height={4}>
              <Line x1={0} y1={4} x2={4} y2={0} stroke={base} strokeWidth={0.5} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill={`url(#${patternId})`} />
        </>
      ) : null}
      {Array.from({ length: count }, (_, i) => (
        <Circle
          key={i}
          cx={ox}
          cy={oy}
          r={start + i * ringGap}
          stroke={i % accentEvery === 2 ? accent : base}
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
}
