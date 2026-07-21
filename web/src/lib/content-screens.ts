// The mobile app organised BY SCREEN for the CMS. Each screen has a stable `id`, a human name +
// description, and its editable copy grouped into the sections you actually see on that screen.
// The admin "Screens" hub lists these; /content/screen/[id] edits one. Every `key` mirrors a
// `useContent(key, fallback)` call in the mobile app, and the `fallback` is the shipped copy
// (shown as the placeholder + "reset to default" target). Add a screen here + wire its literals
// in the app to bring it into the CMS. Full backlog: docs/cms/content-register.md.

export type ContentField = {
  /** Stable `screen.slot` key — must match the mobile useContent(...) call. */
  key: string;
  label: string;
  help?: string;
  multiline?: boolean;
  /** The bundled fallback shipped in the app — placeholder + reset target. */
  fallback: string;
};

export type ScreenSection = { title: string; fields: ContentField[] };

export type AppScreen = {
  /** URL/id used at /content/screen/[id]. */
  id: string;
  name: string;
  /** One line: what this screen is. */
  description: string;
  /** The mobile route, shown as a hint. */
  route: string;
  sections: ScreenSection[];
  /** A linked structured editor (e.g. onboarding slides), when the screen has one. */
  structured?: { label: string; href: string; note: string };
};

export const appScreens: AppScreen[] = [
  {
    id: "home",
    name: "Home",
    description: "The first tab — greeting, section titles, and the hero fallback.",
    route: "(tabs)/index",
    sections: [
      {
        title: "Greeting",
        fields: [
          { key: "home.greeting.morning", label: "Morning", fallback: "Good morning" },
          { key: "home.greeting.afternoon", label: "Afternoon", fallback: "Good afternoon" },
          { key: "home.greeting.evening", label: "Evening", fallback: "Good evening" },
        ],
      },
      {
        title: "Section titles",
        fields: [
          { key: "home.rail.shop_by_note", label: "“Shop by note” heading", fallback: "Shop by note" },
          { key: "home.rail.collections", label: "“Collections” heading", fallback: "Collections" },
          { key: "home.rail.perfect_pairs", label: "“Perfect pairs” heading", fallback: "Perfect pairs" },
        ],
      },
      {
        title: "Hero fallback",
        fields: [
          {
            key: "home.hero.fallback_title",
            label: "Headline",
            help: "Only shown if no hero slide is set — manage real slides under Storefront.",
            fallback: "Scents that stay with you.",
          },
          { key: "home.hero.fallback_cta", label: "Button", fallback: "Shop the edit" },
        ],
      },
    ],
  },
  {
    id: "shop",
    name: "Shop",
    description: "The catalogue tab — header, category tabs, and the empty state.",
    route: "(tabs)/shop",
    sections: [
      { title: "Header", fields: [{ key: "shop.title", label: "Title", fallback: "Shop" }] },
      {
        title: "Category tabs",
        fields: [
          { key: "shop.tab.all", label: "All", fallback: "All" },
          { key: "shop.tab.women", label: "Women", fallback: "Women" },
          { key: "shop.tab.men", label: "Men", fallback: "Men" },
          { key: "shop.tab.unisex", label: "Unisex", fallback: "Unisex" },
        ],
      },
      {
        title: "Empty state",
        fields: [
          { key: "shop.empty.title", label: "Heading", fallback: "Nothing on the shelf for that." },
          { key: "shop.empty.body", label: "Message", multiline: true, fallback: "Try another search, or adjust your filters." },
        ],
      },
    ],
  },
  {
    id: "search",
    name: "Search",
    description: "The search screen — placeholder, section labels, and the no-results state.",
    route: "search",
    sections: [
      { title: "Search bar", fields: [{ key: "search.placeholder", label: "Placeholder", fallback: "Fragrances, notes, brands" }] },
      {
        title: "Section labels",
        fields: [
          { key: "search.eyebrow.recent", label: "“Recent”", fallback: "Recent" },
          { key: "search.eyebrow.popular", label: "“Popular searches”", fallback: "Popular searches" },
          { key: "search.eyebrow.trending", label: "“Trending now”", fallback: "Trending now" },
        ],
      },
      { title: "No results", fields: [{ key: "search.empty.title", label: "Heading", fallback: "Nothing on the shelf for that." }] },
    ],
  },
  {
    id: "bag",
    name: "Bag",
    description: "The cart tab — title, empty state, and the checkout button.",
    route: "(tabs)/cart",
    sections: [
      { title: "Header", fields: [{ key: "bag.title", label: "Title", fallback: "Bag" }] },
      {
        title: "Empty state",
        fields: [
          { key: "bag.empty.title", label: "Heading", fallback: "Your bag is empty." },
          { key: "bag.empty.body", label: "Message", multiline: true, fallback: "Browse fragrances and the ones you add will show up here." },
          { key: "bag.empty.cta", label: "Button", fallback: "Browse fragrances" },
        ],
      },
      { title: "Checkout", fields: [{ key: "bag.cta", label: "Checkout button", fallback: "Checkout" }] },
    ],
  },
  {
    id: "saved",
    name: "Saved",
    description: "The wishlist tab — title and its two empty states.",
    route: "(tabs)/wishlist",
    sections: [
      { title: "Header", fields: [{ key: "saved.title", label: "Title", fallback: "Saved" }] },
      {
        title: "Empty — nothing saved",
        fields: [
          { key: "saved.empty.title", label: "Heading", fallback: "Nothing saved yet." },
          { key: "saved.empty.body", label: "Message", multiline: true, fallback: "Tap the heart on any fragrance to keep it here for later." },
          { key: "saved.empty.cta", label: "Button", fallback: "Browse fragrances" },
        ],
      },
    ],
  },
  {
    id: "onboarding",
    name: "Onboarding",
    description: "The first-run intro — the taste step copy. Slides have their own editor.",
    route: "onboarding",
    structured: {
      label: "Intro slides",
      href: "/content/onboarding",
      note: "The three swipeable intro slides (image + headline) are managed in their own editor.",
    },
    sections: [
      {
        title: "Buttons",
        fields: [
          { key: "onboarding.slide_cta", label: "Slide button", fallback: "Continue" },
          { key: "onboarding.skip", label: "Skip link", fallback: "Skip" },
        ],
      },
      {
        title: "Taste step",
        fields: [
          { key: "onboarding.taste.title", label: "Title", fallback: "What do you love?" },
          {
            key: "onboarding.taste.body",
            label: "Body",
            multiline: true,
            fallback: "We'll tune your home to it — from day one. You can change this any time in your profile.",
          },
          { key: "onboarding.taste.cta", label: "Button", fallback: "Get started" },
          { key: "onboarding.taste.cta_busy", label: "Button (while saving)", fallback: "Setting up…" },
          { key: "onboarding.taste.picked_word", label: "“picked” word", help: "Used in the count, e.g. “Get started · 3 picked”.", fallback: "picked" },
        ],
      },
    ],
  },
];

export const findScreen = (id: string) => appScreens.find((s) => s.id === id);
export const screenFields = (s: AppScreen) => s.sections.flatMap((sec) => sec.fields);
export const screenFieldCount = (s: AppScreen) => screenFields(s).length;
