import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

// True iOS 26 Liquid Glass when available; otherwise a frosted-blur fallback that still looks good
// on older iOS / Android. Guarded so a dev client built before expo-glass-effect was added can't crash.
let available = false;
try {
  available = isLiquidGlassAvailable();
} catch {
  available = false;
}
export const LIQUID_GLASS = available;

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  fallbackLight: { backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  fallbackDark: { backgroundColor: "rgba(20,20,22,0.32)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
});

/** Rounded liquid-glass surface (for the nav pill, sheets, etc.). Children render above the material. */
export function GlassSurface({ radius, tint = "dark", tintColor, intensity = 48, children, style }: { radius: number; tint?: "light" | "dark"; tintColor?: string; intensity?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const clip = { ...StyleSheet.absoluteFillObject, borderRadius: radius, overflow: "hidden" as const };
  return (
    <View style={style}>
      {LIQUID_GLASS ? (
        <GlassView glassEffectStyle="regular" tintColor={tintColor} isInteractive style={clip} />
      ) : (
        <BlurView tint={tint} intensity={intensity} experimentalBlurMethod="dimezisBlurView" style={clip} />
      )}
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: radius, borderWidth: 1, borderColor: tint === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.6)" }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Liquid-glass material as an absolute fill — drop inside any rounded container (e.g. a button pill). */
export function GlassFill({ radius, tint = "dark", tintColor, intensity = 40 }: { radius: number; tint?: "light" | "dark"; tintColor?: string; intensity?: number }) {
  const clip = { ...StyleSheet.absoluteFillObject, borderRadius: radius, overflow: "hidden" as const };
  return (
    <>
      {LIQUID_GLASS ? (
        <GlassView glassEffectStyle="regular" tintColor={tintColor} isInteractive style={clip} />
      ) : (
        <BlurView tint={tint} intensity={intensity} experimentalBlurMethod="dimezisBlurView" style={clip} />
      )}
      <View
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, borderWidth: 1, borderColor: tint === "dark" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.6)" }]}
        pointerEvents="none"
      />
    </>
  );
}

/** Circular liquid-glass icon button surface (back buttons, floating controls over imagery). */
export function GlassCircle({ size = 42, tint = "light", children, style }: { size?: number; tint?: "light" | "dark"; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (LIQUID_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={[dim, styles.center, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[dim, styles.center, tint === "dark" ? styles.fallbackDark : styles.fallbackLight, style]}>
      <BlurView tint={tint} intensity={28} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2, overflow: "hidden" }]} />
      {children}
    </View>
  );
}
