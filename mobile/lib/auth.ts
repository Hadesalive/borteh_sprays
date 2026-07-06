import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { mergeAnonEvents } from "./track";
import { syncScentPrefs } from "./scentPrefs";

// Phone + password auth (no OTP — SMS is too costly, ADR-004). Supabase needs an email/password
// pair, so we map the phone to a synthetic, non-deliverable email; the real phone lives in
// user_metadata and on the app_user row (created by the fn_handle_new_user trigger).
//
// Supabase project setting required: Auth → "Confirm email" must be OFF (synthetic emails can't
// be confirmed), so sign-up returns a session immediately.

let session: Session | null = null;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

supabase.auth.getSession().then(({ data }) => {
  session = data.session;
  ready = true;
  emit();
});
supabase.auth.onAuthStateChange((event, s) => {
  session = s;
  emit();
  // On a real sign-in (login / signup / password-reset auto-signin), claim this device's
  // anonymous events for the user. Idempotent, so repeat fires are harmless.
  if (event === "SIGNED_IN") {
    mergeAnonEvents();
    syncScentPrefs(); // push any onboarding-captured scent prefs now that we have a user
  }
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Current session (null when signed out). Reactive. */
export const useSession = () => useSyncExternalStore(subscribe, () => session, () => session);
/** Whether the initial session check has finished (avoids a sign-in flash on launch). */
export const useAuthReady = () => useSyncExternalStore(subscribe, () => ready, () => ready);

/** Sierra Leone normalisation → E.164 (e.g. "077 123456" / "+23277123456" → "+23277123456"). */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0")) d = "232" + d.slice(1);
  if (!d.startsWith("232")) d = "232" + d;
  return "+" + d;
}

// Supabase validates the email domain via DNS, so a made-up domain ("phone.borteh.app") is
// rejected. We use the project's own host (always resolves, owned by the project) — the email is
// only an internal login key; users only ever see/enter their phone.
const AUTH_DOMAIN = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "supabase.co";
const phoneToEmail = (phone: string) => `${normalizePhone(phone).replace("+", "")}@${AUTH_DOMAIN}`;

export async function signUp({ name, phone, password }: { name: string; phone: string; password: string }) {
  const e164 = normalizePhone(phone);
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(phone),
    password,
    options: { data: { display_name: name.trim(), phone: e164 } },
  });
  if (error) throw error;
  // The trigger seeds app_user with display_name from metadata but phone from the (empty) auth
  // phone column — set the real phone now that we're authenticated (RLS: own row).
  if (data.user) {
    await supabase.from("app_user").update({ phone: e164, display_name: name.trim() }).eq("id", data.user.id);
  }
  return data;
}

/** Update the signed-in user's display name (auth metadata + app_user row). Reactive via onAuthStateChange. */
export async function updateProfile({ name }: { name: string }) {
  const trimmed = name.trim();
  const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
  if (error) throw error;
  if (data.user) {
    await supabase.from("app_user").update({ display_name: trimmed }).eq("id", data.user.id);
  }
  return data;
}

export async function signIn({ phone, password }: { phone: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Phone + name recovery: verify the account, set a new password, then sign in. */
export async function resetPassword({ phone, name, newPassword }: { phone: string; name: string; newPassword: string }) {
  const e164 = normalizePhone(phone);
  const { error } = await supabase.rpc("fn_reset_password", { p_phone: e164, p_name: name.trim(), p_new_password: newPassword });
  if (error) {
    if (/no_match/.test(error.message)) throw new Error("We couldn't find an account with that phone and name.");
    throw error;
  }
  await signIn({ phone, password: newPassword });
}
