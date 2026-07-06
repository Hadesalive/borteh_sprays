import Constants from "expo-constants";
import * as Device from "expo-device";
import * as ExpoNotifications from "expo-notifications";
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Push registration + tap routing. The server side is a DB trigger that mirrors
// every inbox row to Expo's push service; this module owns the device half:
// permission, token → notification_preference.push_token, and deep links.
//
// Permission is asked at a MOMENT (after an order is placed, or from the
// notifications screen) — never on first launch. initPush() only refreshes
// silently when permission was already granted.

export type PushStatus =
  | "unknown" // not checked yet
  | "unavailable" // simulator / Expo Go / no EAS project id — push can't work here
  | "undetermined" // never asked — we may show a "turn on" prompt
  | "denied" // asked and refused — only fixable in Settings, don't nag
  | "enabled"; // granted + token saved

let status: PushStatus = "unknown";
let lastToken: string | null = null;
const listeners = new Set<() => void>();
const set = (s: PushStatus) => {
  status = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePushStatus = () => useSyncExternalStore(subscribe, () => status, () => status);

// Foreground presentation: the in-app banner (NotificationToast, fed by realtime)
// owns what the user sees while the app is open — suppress the system banner so a
// push never shows twice. Backgrounded/closed pushes use the normal system UI.
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true, // still lands in the notification center
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const projectId = (): string | null =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Constants?.expoConfig as any)?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId ?? null;

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await ExpoNotifications.setNotificationChannelAsync("default", {
    name: "Order & restock updates",
    importance: ExpoNotifications.AndroidImportance.DEFAULT,
  });
}

/** Persist the token where the schema keeps it. No-op when signed out (retried on sign-in). */
async function saveToken(token: string) {
  lastToken = token;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notification_preference").upsert({ user_id: user.id, push_token: token, push_enabled: true });
}

async function fetchAndSaveToken(): Promise<boolean> {
  const pid = projectId();
  if (!pid) return false;
  try {
    const { data: token } = await ExpoNotifications.getExpoPushTokenAsync({ projectId: pid });
    await ensureAndroidChannel();
    await saveToken(token);
    return true;
  } catch {
    return false; // no APNs/FCM credentials yet — dev build without push setup
  }
}

/** User-invoked: request permission, register, save. Call from a prompt, not on launch. */
export async function enablePush(): Promise<PushStatus> {
  if (!Device.isDevice || !projectId()) {
    set("unavailable");
    return status;
  }
  const perm = await ExpoNotifications.requestPermissionsAsync();
  if (!perm.granted) {
    set(perm.canAskAgain ? "undetermined" : "denied");
    return status;
  }
  set((await fetchAndSaveToken()) ? "enabled" : "unavailable");
  return status;
}

/** Turn push off for this account (permission stays; the server just stops sending). */
export async function disablePush() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await supabase.from("notification_preference").upsert({ user_id: user.id, push_enabled: false });
  set("undetermined");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function routeFromData(data: any) {
  if (data?.reference_type === "order" && data?.reference_id) {
    router.push({ pathname: "/order/[id]", params: { id: String(data.reference_id) } });
  } else if (data?.type === "promo" || data?.type === "system") {
    router.push("/notices"); // public notices read in the bulletin
  } else {
    router.push("/notifications"); // restocks land in the inbox, which resolves further
  }
}

let booted = false;

/** App boot: silent token refresh (never prompts), tap listeners, sign-in re-save. */
export async function initPush() {
  if (booted) return;
  booted = true;

  // a tap on a push — app running or backgrounded
  ExpoNotifications.addNotificationResponseReceivedListener((resp) => {
    routeFromData(resp.notification.request.content.data);
  });
  // a tap that cold-started the app
  ExpoNotifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (resp) routeFromData(resp.notification.request.content.data);
    })
    .catch(() => {});

  // token saved pre-sign-in? persist it once the user signs in
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && lastToken) saveToken(lastToken).catch(() => {});
  });

  if (!Device.isDevice || !projectId()) {
    set("unavailable");
    return;
  }
  try {
    const perm = await ExpoNotifications.getPermissionsAsync();
    if (perm.granted) {
      set((await fetchAndSaveToken()) ? "enabled" : "unavailable");
    } else {
      set(perm.canAskAgain ? "undetermined" : "denied");
    }
  } catch {
    set("unavailable");
  }
}

/** Keep the app-icon badge honest with the inbox. */
export function syncBadge(unread: number) {
  ExpoNotifications.setBadgeCountAsync(unread).catch(() => {});
}
