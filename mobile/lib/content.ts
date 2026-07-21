import { useQuery } from "@tanstack/react-query";
import { imageUrl, supabase } from "./supabase";

// App-wide CMS reads (online-first, bundled fallbacks).
//
//   useContent(key, fallback)  — one editable string from public.app_content.
//   useContentImage(key)       — an editable image URL from public.app_content.
//   useOnboardingSlides()      — the structured onboarding_slide list.
//
// Golden rule: a missing key, a slow network, or an error must NEVER blank a screen.
// Every hook here degrades to the caller's bundled fallback. RLS already scopes reads
// to public/active rows, so these run signed-in or not.

// --- Generic copy store (app_content) ---------------------------------------

export type ContentMap = Record<string, { text: string | null; imagePath: string | null }>;

/** All editable copy in one cached fetch. Individual keys are read off this map, so a
 *  screen with ten useContent() calls still makes a single network request. */
export function useAppContent() {
  return useQuery<ContentMap>({
    queryKey: ["app-content"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_content")
        .select("key, value_text, image_path");
      if (error) throw error;
      const map: ContentMap = {};
      for (const row of data ?? []) {
        map[row.key as string] = {
          text: (row.value_text as string | null) ?? null,
          imagePath: (row.image_path as string | null) ?? null,
        };
      }
      return map;
    },
  });
}

/** One editable string. Returns the DB value, or `fallback` while loading / when absent. */
export function useContent(key: string, fallback: string): string {
  const { data } = useAppContent();
  const value = data?.[key]?.text;
  return value != null && value !== "" ? value : fallback;
}

/** An editable image URL for a key, or the (optional) fallback URL when absent. */
export function useContentImage(key: string, fallback: string | null = null): string | null {
  const { data } = useAppContent();
  return imageUrl(data?.[key]?.imagePath) ?? fallback;
}

// --- Onboarding slides (structured) -----------------------------------------

export type OnboardingSlide = {
  id: string;
  title: string;
  body: string;
  /** Storage URL when the owner uploaded one; null → caller uses its bundled image by index. */
  imageUrl: string | null;
};

/** Active onboarding slides in curated order. On loading/error `data` is undefined, so the caller
 *  (app/onboarding.tsx) falls back to its bundled SLIDES — the intro must render even offline. */
export function useOnboardingSlides() {
  return useQuery<OnboardingSlide[]>({
    queryKey: ["onboarding-slides"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_slide")
        .select("id, title, body, image_path, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id as string,
        title: s.title as string,
        body: s.body as string,
        imageUrl: imageUrl(s.image_path as string | null),
      }));
    },
  });
}
