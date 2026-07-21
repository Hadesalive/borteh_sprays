// The registry of editable app-copy keys (public.app_content) surfaced in the admin "App copy"
// editor. Each entry carries a human label + the app's bundled fallback, so the editor can show
// and edit a key even before it has a DB row (Save upserts it). Grow this as more screens are
// swept into the CMS — the key strings mirror the mobile `useContent(key, fallback)` calls and
// the content register at docs/cms/content-register.md.

export type ContentField = {
  /** Stable `screen.slot` key — must match the mobile useContent(...) call. */
  key: string;
  label: string;
  help?: string;
  /** Render a textarea instead of a single-line input. */
  multiline?: boolean;
  /** The bundled fallback shipped in the app — shown as the placeholder / reset target. */
  fallback: string;
};

export type ContentGroup = {
  title: string;
  description?: string;
  fields: ContentField[];
};

export const contentGroups: ContentGroup[] = [
  {
    title: "Onboarding",
    description:
      "The surrounding copy on the first-run intro. The three intro slides are edited under App Studio → Onboarding.",
    fields: [
      { key: "onboarding.slide_cta", label: "Slide button", fallback: "Continue" },
      { key: "onboarding.skip", label: "Skip link", fallback: "Skip" },
      { key: "onboarding.taste.title", label: "Taste step — title", fallback: "What do you love?" },
      {
        key: "onboarding.taste.body",
        label: "Taste step — body",
        multiline: true,
        fallback:
          "We'll tune your home to it — from day one. You can change this any time in your profile.",
      },
      { key: "onboarding.taste.cta", label: "Taste step — button", fallback: "Get started" },
      { key: "onboarding.taste.cta_busy", label: "Taste step — button (while saving)", fallback: "Setting up…" },
      {
        key: "onboarding.taste.picked_word",
        label: "Taste step — “picked” word",
        help: "Used in the count, e.g. “Get started · 3 picked”.",
        fallback: "picked",
      },
    ],
  },
];

/** Flat list of every registered key — handy for validation. */
export const contentKeys = contentGroups.flatMap((g) => g.fields.map((f) => f.key));
