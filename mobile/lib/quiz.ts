import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// The onboarding scent quiz: a small, ordered set of questions whose answers map to the
// family / accord / note terms the catalog actually carries, then seed the recommendation taste
// vector via fn_set_quiz_prefs (loved pulls toward, avoided pushes away). Kept as data (not JSX)
// so the mapping is unit-testable and tweakable without touching the UI.
//
// Works signed-out: answers persist locally and are pushed to the server on sign-in
// (syncQuizPrefs, called from lib/auth). "Seed only, behavior wins" — the nightly rollup later
// overwrites taste from real engagement.

export type QuizAnswers = {
  gender: string | null; // 'male' | 'female' | 'unisex'
  directions: string[]; // scent worlds (multi)
  intensity: string | null; // 'subtle' | 'balanced' | 'bold'
  sweetness: string | null; // 'dry' | 'balanced' | 'sweet'
  loves: string[]; // specific notes loved
  avoids: string[]; // specific notes to keep away
  occasions: string[]; // everyday | office | date_night | going_out
  budget: string | null; // value | mid | premium
};

export const EMPTY_ANSWERS: QuizAnswers = {
  gender: null,
  directions: [],
  intensity: null,
  sweetness: null,
  loves: [],
  avoids: [],
  occasions: [],
  budget: null,
};

// ---- option catalogs (labels are user-facing; codes/terms feed the catalog match) -----------

export const GENDERS = [
  { code: "male", label: "For him" },
  { code: "female", label: "For her" },
  { code: "unisex", label: "Anything" },
] as const;

// Each "world" maps to the family/accord terms that define it. Terms are matched with a broad
// ILIKE against scent_family, main_accords and note names, so "Amber" also catches "Amber Woody".
export const DIRECTIONS = [
  { code: "fresh", label: "Fresh & clean", blurb: "Citrus, air, cool skin", terms: ["Fresh", "Citrus", "Aquatic", "Green", "Aromatic"] },
  { code: "warm", label: "Warm & spicy", blurb: "Amber, spice, resins", terms: ["Amber", "Warm Spicy", "Spicy", "Woody"] },
  { code: "sweet", label: "Sweet & gourmand", blurb: "Vanilla, caramel, dessert", terms: ["Sweet", "Vanilla", "Gourmand", "Caramel"] },
  { code: "woody", label: "Woody & oud", blurb: "Oud, sandalwood, smoke", terms: ["Oud", "Woody", "Sandalwood", "Smoky"] },
  { code: "floral", label: "Floral", blurb: "Rose, jasmine, blossom", terms: ["Floral", "Rose", "Jasmine", "White Floral"] },
] as const;

export const INTENSITIES = [
  { code: "subtle", label: "Subtle", blurb: "Close to the skin", terms: ["Fresh", "Citrus", "Musk"] },
  { code: "balanced", label: "Balanced", blurb: "Noticed, not loud", terms: [] as string[] },
  { code: "bold", label: "Bold", blurb: "Enters the room first", terms: ["Oud", "Amber", "Woody"] },
] as const;

export const SWEETNESS = [
  { code: "dry", label: "Dry", blurb: "Woods & spice", terms: ["Woody", "Spicy"] },
  { code: "balanced", label: "Balanced", blurb: "A little of both", terms: [] as string[] },
  { code: "sweet", label: "Sweet", blurb: "Gourmand & sugary", terms: ["Vanilla", "Sweet", "Gourmand"] },
] as const;

// Specific notes for the love / avoid grid — a curated superset, deliberately broader than the
// current shelf so a pick we don't stock yet still personalizes the day it lands.
export const NOTES = [
  "Oud", "Vanilla", "Rose", "Amber", "Musk", "Sandalwood", "Saffron", "Leather",
  "Coffee", "Chocolate", "Coconut", "Caramel", "Tobacco", "Citrus", "Jasmine", "Patchouli",
  "Cardamom", "Cinnamon", "Honey", "Powdery", "Incense", "Aquatic", "Almond", "Cherry",
] as const;

export const OCCASIONS = [
  { code: "everyday", label: "Everyday" },
  { code: "office", label: "Office" },
  { code: "date_night", label: "Date night" },
  { code: "going_out", label: "Going out" },
] as const;

export const BUDGETS = [
  { code: "value", label: "Best value" },
  { code: "mid", label: "Mid-range" },
  { code: "premium", label: "Premium" },
] as const;

// ---- answers → server payload ---------------------------------------------------------------

export type QuizPayload = {
  loved: string[];
  avoided: string[];
  gender: string | null;
  dims: Record<string, string | string[]>;
};

const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));

/** Collapse the friendly answers into the term lists + soft dimensions fn_set_quiz_prefs wants. */
export function answersToPayload(a: QuizAnswers): QuizPayload {
  const loved: string[] = [];
  for (const d of DIRECTIONS) if (a.directions.includes(d.code)) loved.push(...d.terms);
  const intensity = INTENSITIES.find((i) => i.code === a.intensity);
  if (intensity) loved.push(...intensity.terms);
  const sweetness = SWEETNESS.find((s) => s.code === a.sweetness);
  if (sweetness) loved.push(...sweetness.terms);
  loved.push(...a.loves);

  // A note can't be both loved and avoided; an explicit avoid wins.
  const avoided = uniq(a.avoids);
  const lovedFinal = uniq(loved).filter((t) => !avoided.includes(t));

  const dims: Record<string, string | string[]> = {};
  if (a.intensity) dims.intensity = a.intensity;
  if (a.sweetness) dims.sweetness = a.sweetness;
  if (a.occasions.length) dims.occasion = a.occasions;
  if (a.budget) dims.budget = a.budget;

  return { loved: lovedFinal, avoided, gender: a.gender, dims };
}

/** A short, human profile line for the result card, e.g. "Warm · Sweet · Oud-forward". */
export function summarize(a: QuizAnswers): string[] {
  const words: string[] = [];
  const dirLabels: Record<string, string> = { fresh: "Fresh", warm: "Warm", sweet: "Sweet", woody: "Woody", floral: "Floral" };
  for (const d of a.directions) if (dirLabels[d]) words.push(dirLabels[d]);
  if (a.intensity === "bold") words.push("Bold");
  if (a.intensity === "subtle") words.push("Understated");
  if (a.sweetness === "sweet" && !words.includes("Sweet")) words.push("Sweet");
  if (a.sweetness === "dry") words.push("Dry");
  if (a.loves.includes("Oud")) words.push("Oud-forward");
  else if (a.loves.length) words.push(`${a.loves[0]}-led`);
  return uniq(words).slice(0, 4);
}

export const quizHasSignal = (a: QuizAnswers) =>
  !!(a.gender || a.directions.length || a.loves.length || a.avoids.length || a.intensity || a.sweetness);

// ---- persistence ----------------------------------------------------------------------------

const KEY = "borteh.quiz.v1";

export async function getLocalQuiz(): Promise<QuizAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { ...EMPTY_ANSWERS, ...p };
  } catch {
    return null;
  }
}

/** Persist answers locally, and seed the taste vector server-side if already signed in. */
export async function saveQuizPrefs(a: QuizAnswers): Promise<number | null> {
  await AsyncStorage.setItem(KEY, JSON.stringify(a));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null; // synced on sign-in by syncQuizPrefs
  return pushQuiz(a);
}

/** On sign-in: push any locally-captured quiz answers. Idempotent, best-effort. */
export async function syncQuizPrefs(): Promise<boolean> {
  const local = await getLocalQuiz();
  if (!local || !quizHasSignal(local)) return false;
  try {
    await pushQuiz(local);
    return true; // signals lib/auth to skip the legacy scent-prefs sync
  } catch {
    return false; // stays local until next save/sync
  }
}

async function pushQuiz(a: QuizAnswers): Promise<number | null> {
  const { loved, avoided, gender, dims } = answersToPayload(a);
  const { data, error } = await supabase.rpc("fn_set_quiz_prefs", {
    p_loved: loved,
    p_avoided: avoided,
    p_gender: gender,
    p_dims: dims,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}
