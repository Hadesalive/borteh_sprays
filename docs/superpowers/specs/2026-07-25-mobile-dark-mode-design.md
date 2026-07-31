# Mobile dark mode — design & migration recipe (2026-07-25)

Add full app-wide dark mode to the Borteh Sprays mobile app (Expo SDK 55 / RN 0.83),
with a Light / Dark / System toggle in Profile settings. Aesthetic: **warm "Inverted
Maison"** (dark warm paper + warm off-white ink + brightened bronze), keeping the
editorial/premium Maison identity after dark. Approved 2026-07-25.

## Why it's non-trivial
Colors are centralized in `lib/theme.ts` (good) but consumed two ways across ~58 files:
- inline `colors.x` in render (reactive once `colors` comes from a hook), and
- **module-scope `StyleSheet.create({...})` with colors baked in at import** (~57 files) —
  these are frozen at load and must be recomputed per active palette.

## Architecture

### 1. `lib/theme.ts`
- Split the current palette into `lightColors` and `darkColors` (same keys, incl. all
  back-compat aliases). Export `export type Colors = typeof lightColors`.
- Keep `export const colors = lightColors` so un-migrated files still compile (they stay
  light until migrated). `space / radius / font / label / duration / shadow` unchanged.

Dark palette (warm Inverted Maison):
```
paper #16130F  surface #211C16  ink #F2EDE4  ink60 #A8A093  ink40 #6E665A
line  #322B22  accent  #C08A4E  success #5B9E77  error #E0715F  warning #C79A3E
onInk #16130F  onAccent #16130F  accentSoft #2A2019
back-compat: bg→paper field/plinth→surface inkSoft→ink60 inkMute/placeholder→ink40
             rating/badge/link/accentInk→accent onAccent→#16130F
```

### 2. `lib/theme-context.tsx` (new)
- `ThemeProvider`: holds `scheme: "light"|"dark"|"system"` (default "system"), persisted to
  AsyncStorage key `borteh.theme`. Effective `mode` = scheme==="system" ? useColorScheme() : scheme.
- `useTheme()` → `{ colors, mode, scheme, setScheme }`.
- `useThemedStyles(factory: (c: Colors) => T)` → memoized `factory(colors)` keyed by `mode`.
- `<ThemedStatusBar/>` → `<StatusBar style={mode === "dark" ? "light" : "dark"} />`.

### 3. `app/_layout.tsx`
- Wrap: `SafeAreaProvider > ThemeProvider > QueryClientProvider > …`.
- Theme the Stack `contentStyle.backgroundColor` from `useTheme().colors.paper` (move Stack
  into a child component so it can read the hook). Root bg themed to avoid white flash.

### 4. `app.json`
- `expo.userInterfaceStyle: "light"` → `"automatic"` (lets native surfaces + launch render dark).

### 5. Toggle UI — `app/profile.tsx`
- New "Appearance" section: squared Maison segmented control **System · Light · Dark** wired to
  `setScheme`. Instant + persisted.

## Per-file migration recipe (the ~57 StyleSheet files)
1. `import { useTheme, useThemedStyles } from "@/lib/theme-context";` (+ `Colors` type from `@/lib/theme` if needed).
2. In the component body add `const { colors } = useTheme();` — this **shadows** the static
   `import { colors }`, making every inline `colors.x` reactive with NO edit at each use site.
3. Module-scope `const s = StyleSheet.create({ … })` → `const makeStyles = (colors: Colors) =>
   StyleSheet.create({ … });` and inside the component `const s = useThemedStyles(makeStyles);`.
4. Module-scope constants derived from `colors.x` (e.g. a `PAPER`/`SCRIM` built from a token) →
   move into `makeStyles` or the component. Literal rgba scrims on photos may stay (theme-agnostic).
5. Replace any hardcoded hex that maps to a token with the token (10 files have stray hex).
6. Hardcoded `<StatusBar style="dark" />` → `<ThemedStatusBar />`.

Migrate shared components first (Text, ui, TabBar, cards, Skeleton, ListRow, Button, Field…) so
screens inherit, then screens. Un-migrated files stay light and keep compiling throughout.

## Out of scope (follow-ups)
Separate dark splash image; reworking photo scrims/gradients (images stay, their beds flip).

## Verify
`npx tsc --noEmit` clean · `npx expo export --platform ios` bundles · manual toggle spot-check of
core screens (Home, Shop, Product, Bag, Profile) in both modes.
