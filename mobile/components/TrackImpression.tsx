import { useEffect } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { trackModuleImpression } from "@/lib/track";

// Fires a module_impression (once per session, deduped in lib/track) when a home module has
// actually scrolled into view — the plan's "section actually scrolled into viewport", not
// merely rendered. Each wrapper registers its measured position within the scroll content;
// the enclosing scroll view feeds scroll offset + viewport height via reportScroll(), which
// keeps the ScrollView decoupled from individual modules.

type Entry = { module: string; position: number; y: number; height: number };

const registry = new Map<string, Entry>();
let lastScrollY = 0;
let lastViewportH = 0;
const REVEAL_FRACTION = 0.33; // "seen" once ~a third of the module has entered the viewport

function runChecks() {
  if (lastViewportH === 0) return;
  const viewportBottom = lastScrollY + lastViewportH;
  for (const e of registry.values()) {
    const revealPoint = e.y + Math.min(e.height * REVEAL_FRACTION, 80);
    const scrolledPast = lastScrollY <= e.y + e.height; // module hasn't fully left the top
    if (viewportBottom >= revealPoint && scrolledPast) trackModuleImpression(e.module, e.position);
  }
}

/** The enclosing scroll view calls this on scroll and on layout. */
export function reportScroll(scrollY: number, viewportHeight: number) {
  lastScrollY = scrollY;
  lastViewportH = viewportHeight;
  runChecks();
}

/** Clear measured positions on screen mount so a fresh visit re-measures (session dedup lives in lib/track). */
export function resetImpressionRegistry() {
  registry.clear();
}

export function TrackImpression({
  module,
  position = 0,
  children,
}: {
  module: string;
  position?: number;
  children: React.ReactNode;
}) {
  useEffect(
    () => () => {
      registry.delete(module); // braces: Map.delete returns boolean, cleanup must return void
    },
    [module],
  );
  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    registry.set(module, { module, position, y, height });
    runChecks(); // catches modules that mount above the fold after data loads (no scroll fires)
  };
  return <View onLayout={onLayout}>{children}</View>;
}
