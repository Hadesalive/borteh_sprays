import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Explicit scent preferences captured at onboarding (pre-sign-in) and editable in settings.
// Stored locally so onboarding works signed-out; pushed to the server (fn_set_scent_prefs,
// which seeds the taste vector) when signed in, and synced on sign-in for anyone who onboarded
// first. Server is the source of truth once authenticated.

const KEY = "borteh.scentprefs.v1";
export type ScentPrefs = { values: string[]; gender: string | null };

export async function getLocalPrefs(): Promise<ScentPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && Array.isArray(p.values)) return { values: p.values, gender: p.gender ?? null };
  } catch {
    // corrupt cache
  }
  return { values: [], gender: null };
}

/** Save prefs locally, and to the server if signed in (seeds the taste vector). */
export async function saveScentPrefs(values: string[], gender: string | null): Promise<number | null> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ values, gender }));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null; // saved locally; syncScentPrefs() pushes it on sign-in
  const { data, error } = await supabase.rpc("fn_set_scent_prefs", { p_values: values, p_gender: gender });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** On sign-in: push any locally-captured prefs to the server. Idempotent, best-effort. */
export async function syncScentPrefs(): Promise<void> {
  const local = await getLocalPrefs();
  if (!local.values.length && !local.gender) return;
  try {
    await supabase.rpc("fn_set_scent_prefs", { p_values: local.values, p_gender: local.gender });
  } catch {
    // non-fatal; stays local until next save/sync
  }
}

/** For the settings picker: server prefs when signed in, else the local ones. */
export async function fetchScentPrefs(): Promise<ScentPrefs> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data, error } = await supabase.rpc("fn_get_scent_prefs");
    if (!error && Array.isArray(data)) {
      const rows = data as { kind: string; value: string }[];
      return {
        values: rows.filter((r) => r.kind === "scent").map((r) => r.value),
        gender: rows.find((r) => r.kind === "gender")?.value ?? null,
      };
    }
  }
  return getLocalPrefs();
}
