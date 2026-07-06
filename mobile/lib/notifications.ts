import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./auth";
import { supabase } from "./supabase";

// In-app notification inbox over the day-one schema (public.notification /
// public.restock_subscription, RLS'd since 20260616090004). Rows are created
// server-side by triggers (order status changes, restocks) — the client reads
// its own, marks read, and manages its restock subscriptions.
// Queries filter by user_id explicitly: staff accounts have read-all policies,
// and the owner tests with one — RLS alone would show them everyone's rows.

export type NotificationType = "order_status" | "restock_available" | "delivery" | "promo" | "system";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string | null;
  body: string;
  referenceType: string | null; // 'order' | 'product_variant' | …
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Row (REST or realtime payload) → AppNotification. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeNotification = (r: any): AppNotification => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body,
  referenceType: r.reference_type,
  referenceId: r.reference_id,
  readAt: r.read_at,
  createdAt: r.created_at,
});

/** Signed-in user's inbox, newest first. Light polling — enough for an inbox. */
export function useNotifications() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    refetchInterval: 90 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("id, type, title, body, reference_type, reference_id, read_at, created_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(normalizeNotification);
    },
  });
}

/** Unread count for the bell dot — derived from the shared inbox query. */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.readAt).length;
}

/** Public notices only (system + promo) — the maison's bulletin, own archive. */
export function useNotices() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<AppNotification[]>({
    queryKey: ["notices", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("id, type, title, body, reference_type, reference_id, read_at, created_at")
        .eq("user_id", uid!)
        .in("type", ["system", "promo"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map(normalizeNotification);
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const session = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("notification").update({ read_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      // optimistic — the row greys out immediately, in both inbox + notices caches
      const patch = (list?: AppNotification[]) =>
        (list ?? []).map((n) => (ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
      await qc.cancelQueries({ queryKey: ["notifications", uid] });
      await qc.cancelQueries({ queryKey: ["notices", uid] });
      const prev = qc.getQueryData<AppNotification[]>(["notifications", uid]);
      const prevNotices = qc.getQueryData<AppNotification[]>(["notices", uid]);
      qc.setQueryData<AppNotification[]>(["notifications", uid], patch);
      qc.setQueryData<AppNotification[]>(["notices", uid], patch);
      return { prev, prevNotices };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications", uid], ctx.prev);
      if (ctx?.prevNotices) qc.setQueryData(["notices", uid], ctx.prevNotices);
    },
  });
}

// ── Restock subscriptions (the product page "Notify me") ────────────────────
// One 'active' row per (user, variant) — enforced by a partial unique index;
// the restock trigger flips rows to 'notified', so history is preserved.

/** Whether the signed-in user has an active subscription on a variant. */
export function useRestockSub(variantId?: string) {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<boolean>({
    queryKey: ["restock-sub", uid, variantId],
    enabled: !!uid && !!variantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restock_subscription")
        .select("id")
        .eq("user_id", uid!)
        .eq("variant_id", variantId!)
        .eq("status", "active")
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}

export function useToggleRestockSub() {
  const qc = useQueryClient();
  const session = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async ({ variantId, subscribe }: { variantId: string; subscribe: boolean }) => {
      if (!uid) throw new Error("Sign in to get restock alerts.");
      if (subscribe) {
        const { error } = await supabase.from("restock_subscription").insert({ user_id: uid, variant_id: variantId });
        // 23505 = already actively subscribed (double tap) — that's the desired end state
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("restock_subscription")
          .update({ status: "cancelled" })
          .eq("user_id", uid)
          .eq("variant_id", variantId)
          .eq("status", "active");
        if (error) throw error;
      }
    },
    onMutate: async ({ variantId, subscribe }) => {
      await qc.cancelQueries({ queryKey: ["restock-sub", uid, variantId] });
      const prev = qc.getQueryData<boolean>(["restock-sub", uid, variantId]);
      qc.setQueryData(["restock-sub", uid, variantId], subscribe);
      return { prev, variantId };
    },
    onError: (_e, vars, ctx) => {
      if (ctx) qc.setQueryData(["restock-sub", uid, ctx.variantId], ctx.prev);
    },
  });
}

// ── Display helper ──────────────────────────────────────────────────────────

/** "just now" · "12m" · "3h" · "2d" · "4 Jul" */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
