import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { supabase } from "./supabase";

// First-party interaction tracking for the recommendation system (Phase 1.3).
// Events are QUEUED locally and flushed in batches through the public.fn_track_events RPC —
// never one request per event. The server forces user_id := auth.uid(); we only ever send an
// anon_id (a persistent device id) so pre-sign-in events can be merged on login. Same
// choke-point idiom as lib/recentlyViewed.ts (module singleton + AsyncStorage), no React.

export type EventType =
  | "view" | "dwell" | "search" | "filter" | "add_to_bag" | "remove_from_bag"
  | "purchase" | "wishlist_add" | "wishlist_remove" | "notify_subscribe"
  | "review" | "not_interested" | "module_impression" | "module_tap";

type TrackOpts = {
  productId?: string | null;
  module?: string | null;
  position?: number | null;
  metadata?: Record<string, unknown>;
};

type QueuedEvent = {
  event_type: EventType;
  product_id: string | null;
  module: string | null;
  position: number | null;
  metadata: Record<string, unknown>;
  created_at: string; // ISO; the server clamps anything in the future to now()
};

const QUEUE_KEY = "borteh.track.queue.v1";
const ANON_KEY = "borteh.anon.v1";
const FLUSH_INTERVAL_MS = 15_000; // periodic flush
const FLUSH_AT_COUNT = 20; // flush early once the queue reaches this many
const MAX_BATCH = 50; // events per RPC call
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // drop events older than 24h (matches the plan)
const MAX_BACKOFF_MS = 5 * 60_000;

let anonId: string | null = null;
let queue: QueuedEvent[] = [];
let flushing = false;
let started = false;
let failures = 0;
let nextRetryAt = 0;
const seenImpressions = new Set<string>(); // module_impression dedup, once per app session

// Non-cryptographic UUID v4 — this is only a device analytics id, never a secret.
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function ensureAnonId(): Promise<string> {
  if (anonId) return anonId;
  const existing = await AsyncStorage.getItem(ANON_KEY);
  anonId = existing || uuid();
  if (!existing) await AsyncStorage.setItem(ANON_KEY, anonId);
  return anonId;
}

function prune() {
  const cutoff = Date.now() - MAX_AGE_MS;
  queue = queue.filter((e) => Date.parse(e.created_at) >= cutoff);
}

async function persist() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // best-effort; the in-memory queue is the source of truth for this session
  }
}

async function flush() {
  if (flushing || queue.length === 0 || Date.now() < nextRetryAt) return;
  flushing = true;
  try {
    const id = await ensureAnonId();
    prune();
    while (queue.length > 0) {
      const slice = queue.slice(0, MAX_BATCH);
      const payload = slice.map((e) => ({ ...e, anon_id: id }));
      const { error } = await supabase.rpc("fn_track_events", { p_events: payload });
      if (error) {
        // Keep everything queued; retry later with exponential backoff.
        failures += 1;
        nextRetryAt = Date.now() + Math.min(FLUSH_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS);
        break;
      }
      failures = 0;
      nextRetryAt = 0;
      queue = queue.slice(slice.length);
      await persist();
    }
  } catch {
    failures += 1;
    nextRetryAt = Date.now() + Math.min(FLUSH_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS);
  } finally {
    flushing = false;
  }
}

/** Enqueue an event. Fire-and-forget; safe to call before initTracking(). */
export function track(event_type: EventType, opts: TrackOpts = {}) {
  queue.push({
    event_type,
    product_id: opts.productId ?? null,
    module: opts.module ?? null,
    position: opts.position ?? null,
    metadata: opts.metadata ?? {},
    created_at: new Date().toISOString(),
  });
  persist();
  if (queue.length >= FLUSH_AT_COUNT) flush();
}

/** module_impression, deduped to once per module per app session. */
export function trackModuleImpression(module: string, position = 0) {
  if (seenImpressions.has(module)) return;
  seenImpressions.add(module);
  track("module_impression", { module, position });
}

/**
 * Claim this device's anonymous events for the now-signed-in user. Call on sign-in.
 * The RPC forces user_id := auth.uid(), so it can only ever merge onto the caller.
 */
export async function mergeAnonEvents() {
  const id = anonId ?? (await AsyncStorage.getItem(ANON_KEY));
  if (!id) return;
  try {
    await supabase.rpc("fn_merge_anon_events", { p_anon_id: id });
  } catch {
    // non-fatal; events stay attributed to the anon_id until a later merge
  }
}

/** Hydrate the queue, start the flush timer + background-flush listener. Call once at app root. */
export async function initTracking() {
  if (started) return;
  started = true;
  await ensureAnonId();
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) queue = parsed;
  } catch {
    // corrupt cache — start clean
  }
  prune();
  await persist();
  setInterval(flush, FLUSH_INTERVAL_MS);
  AppState.addEventListener("change", (state) => {
    if (state !== "active") flush(); // flush on background/inactive so nothing is lost
  });
  if (queue.length > 0) flush();
}
