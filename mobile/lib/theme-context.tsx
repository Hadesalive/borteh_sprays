// Theme runtime for the app: holds the user's Light/Dark/System preference,
// resolves it against the OS setting, exposes the active palette, and offers a
// memoized themed-StyleSheet helper. See docs/superpowers/specs/2026-07-25-mobile-dark-mode-design.md
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { Colors, darkColors, lightColors } from "@/lib/theme";

export type ThemeScheme = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "borteh.theme";

type ThemeValue = {
  colors: Colors; // active palette
  mode: ThemeMode; // resolved (effective) mode
  scheme: ThemeScheme; // user preference (may be "system")
  setScheme: (s: ThemeScheme) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [scheme, setSchemeState] = useState<ThemeScheme>("system");

  // Hydrate the persisted preference once on mount.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (alive && (v === "light" || v === "dark" || v === "system")) setSchemeState(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setScheme = (s: ThemeScheme) => {
    setSchemeState(s);
    AsyncStorage.setItem(STORAGE_KEY, s).catch(() => {});
  };

  const mode: ThemeMode = scheme === "system" ? (system === "dark" ? "dark" : "light") : scheme;
  const colors: Colors = mode === "dark" ? darkColors : lightColors;

  const value = useMemo<ThemeValue>(
    () => ({ colors, mode, scheme, setScheme }),
    [colors, mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  // Fallback keeps components usable outside the provider (light, no-op setter).
  if (!ctx) return { colors: lightColors, mode: "light", scheme: "system", setScheme: () => {} };
  return ctx;
}

// Memoized themed StyleSheet — recomputes only when the active palette changes.
// Usage: `const s = useThemedStyles(makeStyles)` where
//   `const makeStyles = (colors: Colors) => StyleSheet.create({ ... })`.
export function useThemedStyles<T>(factory: (c: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

// Drop-in replacement for hardcoded `<StatusBar style="dark" />`: flips with the theme.
export function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}
