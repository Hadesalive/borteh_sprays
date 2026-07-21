import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { useSession } from "./auth";
import { supabase } from "./supabase";

// Profile-domain data: loyalty points, notification preferences, the coupon
// wallet, and referrals. Thin hooks over RLS-scoped tables + the staff-audited
// RPCs from migration 20260706090025.

// ── Loyalty ─────────────────────────────────────────────────────────────────

export type Loyalty = { points: number; lifetime: number; lifetimeSpendMinor: number; currentTierId: string | null };

export function useLoyalty() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<Loyalty | null>({
    queryKey: ["loyalty", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_account")
        .select("points_balance, lifetime_points, lifetime_spend_minor, current_tier_id")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            points: data.points_balance ?? 0,
            lifetime: data.lifetime_points ?? 0,
            lifetimeSpendMinor: Number(data.lifetime_spend_minor ?? 0),
            currentTierId: (data.current_tier_id as string | null) ?? null,
          }
        : null;
    },
  });
}

export type LoyaltyTier = { id: string; name: string; discountPercent: number; thresholdMinor: number };

/** Active tiers, lowest threshold first — powers the "road to the Loyalty Card" progress. */
export function useLoyaltyTiers() {
  const session = useSession();
  return useQuery<LoyaltyTier[]>({
    queryKey: ["loyalty-tiers"],
    enabled: !!session,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_tier")
        .select("id, name, discount_percent, cumulative_spend_threshold_minor")
        .eq("is_active", true)
        .order("cumulative_spend_threshold_minor", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        discountPercent: Number(t.discount_percent ?? 0),
        thresholdMinor: Number(t.cumulative_spend_threshold_minor ?? 0),
      }));
    },
  });
}

/** Loyalty programme settings — readable by every signed-in user (lc_read). */
export type LoyaltyConfig = { enabled: boolean; tiersEnabled: boolean; pointValueMinor: number; earnRate: number; referralPoints: number; expiryDays: number };

export function useLoyaltyConfig() {
  const session = useSession();
  return useQuery<LoyaltyConfig>({
    queryKey: ["loyalty-config"],
    enabled: !!session,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_config")
        .select("loyalty_enabled, tiers_enabled, point_value_minor, points_per_currency_unit, referral_points, points_expiry_days")
        .maybeSingle();
      if (error) throw error;
      return {
        enabled: data?.loyalty_enabled ?? false,
        tiersEnabled: data?.tiers_enabled ?? false,
        pointValueMinor: Number(data?.point_value_minor ?? 0),
        earnRate: Number(data?.points_per_currency_unit ?? 0),
        referralPoints: Number(data?.referral_points ?? 0),
        expiryDays: Number(data?.points_expiry_days ?? 0),
      };
    },
  });
}

/** The member's effective tier — highest-discount active tier reached by lifetime
 *  spend or assigned by an admin. Mirrors fn_place_order so the checkout preview
 *  can't drift from the charge. Returns null when tiers are off or none qualify. */
export function tierFor(loyalty: Loyalty | null | undefined, tiers: LoyaltyTier[] | undefined, tiersEnabled: boolean): LoyaltyTier | null {
  if (!tiersEnabled || !loyalty || !tiers?.length) return null;
  const qualified = tiers.filter((t) => t.thresholdMinor <= loyalty.lifetimeSpendMinor || t.id === loyalty.currentTierId);
  if (!qualified.length) return null;
  return qualified.reduce((best, t) => (t.discountPercent > best.discountPercent ? t : best));
}

export type LedgerEntry = {
  id: string;
  delta: number;
  type: "earn" | "redeem" | "expire" | "adjustment";
  reason: string | null;
  createdAt: string;
};

/** Points history, newest first. */
export function useLoyaltyLedger() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<LedgerEntry[]>({
    queryKey: ["loyalty-ledger", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_ledger")
        .select("id, delta, type, reason, created_at")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, delta: r.delta, type: r.type, reason: r.reason, createdAt: r.created_at }));
    },
  });
}

// ── Notification preferences ────────────────────────────────────────────────

export type NotifPrefs = { pushEnabled: boolean; marketingOptIn: boolean };

export function useNotifPrefs() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<NotifPrefs>({
    queryKey: ["notif-prefs", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_preference").select("push_enabled, marketing_opt_in").eq("user_id", uid!).maybeSingle();
      if (error) throw error;
      return { pushEnabled: data?.push_enabled ?? false, marketingOptIn: data?.marketing_opt_in ?? false };
    },
  });
}

export function useUpdateNotifPref() {
  const qc = useQueryClient();
  const session = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (patch: Partial<{ push_enabled: boolean; marketing_opt_in: boolean }>) => {
      if (!uid) throw new Error("Sign in first.");
      const { error } = await supabase.from("notification_preference").upsert({ user_id: uid, ...patch });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["notif-prefs", uid] });
      const prev = qc.getQueryData<NotifPrefs>(["notif-prefs", uid]);
      qc.setQueryData<NotifPrefs>(["notif-prefs", uid], (p) => ({
        pushEnabled: patch.push_enabled ?? p?.pushEnabled ?? false,
        marketingOptIn: patch.marketing_opt_in ?? p?.marketingOptIn ?? false,
      }));
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notif-prefs", uid], ctx.prev);
    },
  });
}

// ── Coupon wallet ───────────────────────────────────────────────────────────

export type Coupon = {
  id: string;
  code: string;
  label: string; // "15% off" / "Le 50 off"
  minOrderMinor: number;
  endsAt: string | null;
};

export function useMyCoupons() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<Coupon[]>({
    queryKey: ["coupons", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_code")
        .select("id, code, discount_type, discount_value, min_order_minor, ends_at, is_active")
        .eq("issued_to_user_id", uid!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .filter((c) => !c.ends_at || new Date(c.ends_at) > new Date())
        .map((c) => ({
          id: c.id,
          code: c.code,
          label: c.discount_type === "percent" ? `${c.discount_value}% off` : `Le ${Math.round(c.discount_value / 100)} off`,
          minOrderMinor: c.min_order_minor ?? 0,
          endsAt: c.ends_at,
        }));
    },
  });
}

/** Server-side coupon check — the same rules fn_place_order enforces. */
export async function validatePromo(code: string, subtotalMinor: number): Promise<{ discountMinor: number; label: string }> {
  const { data, error } = await supabase.rpc("fn_validate_promo", { p_code: code, p_subtotal_minor: subtotalMinor });
  if (error) {
    const m = error.message;
    if (/invalid_code/.test(m)) throw new Error("That code isn't valid.");
    if (/expired/.test(m)) throw new Error("That code has expired.");
    if (/used_up|already_used/.test(m)) throw new Error("That code has already been used.");
    if (/min_order/.test(m)) throw new Error("Your bag is below this code's minimum.");
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { discountMinor: Number(row.discount_minor), label: row.label as string };
}

// Wallet → checkout handoff: tapping a coupon stages it; checkout applies it.
let pendingCoupon: string | null = null;
const pcListeners = new Set<() => void>();
export const stageCoupon = (code: string | null) => {
  pendingCoupon = code;
  pcListeners.forEach((l) => l());
};
export const takePendingCoupon = () => {
  const c = pendingCoupon;
  pendingCoupon = null;
  return c;
};
export const usePendingCoupon = () =>
  useSyncExternalStore(
    (l) => {
      pcListeners.add(l);
      return () => pcListeners.delete(l);
    },
    () => pendingCoupon,
    () => pendingCoupon,
  );

// ── Store contact (the "WhatsApp us" row) ───────────────────────────────────

/** Default store's WhatsApp number — publicly readable; null until the owner sets it. */
export function useStorePhone() {
  return useQuery<string | null>({
    queryKey: ["store-phone"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_location")
        .select("phone")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.phone as string | null) ?? null;
    },
  });
}

// ── Referrals ───────────────────────────────────────────────────────────────

/** The caller's share code — minted lazily server-side. */
export function useReferralCode() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<string>({
    queryKey: ["referral-code", uid],
    enabled: !!uid,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_my_referral_code");
      if (error) throw error;
      return data as string;
    },
  });
}

export type Referral = { firstName: string; joinedAt: string; rewarded: boolean };

/** Everyone who signed up with the caller's code — even before their first order. */
export function useMyReferrals() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<Referral[]>({
    queryKey: ["my-referrals", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_my_referrals");
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({ firstName: r.first_name, joinedAt: r.joined_at, rewarded: r.rewarded }));
    },
  });
}

/** Pre-signup validation — is this code real? Returns the referrer's first name. */
export async function checkReferral(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("fn_check_referral", { p_code: code.trim() });
  if (error) throw new Error("That referral code isn't valid.");
  return data as string;
}

/** Apply a friend's code (new customers only). Returns the friend's first name. */
export async function applyReferral(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("fn_apply_referral", { p_code: code.trim() });
  if (error) {
    const m = error.message;
    if (/invalid_code/.test(m)) throw new Error("That code isn't valid.");
    if (/own_code/.test(m)) throw new Error("That's your own code.");
    if (/already_referred/.test(m)) throw new Error("A referral is already applied.");
    if (/too_late/.test(m)) throw new Error("Referral codes are for first-time customers.");
    throw error;
  }
  return data as string;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
// Top customers by lifetime spend. The whole board comes from a security-definer
// RPC (fn_leaderboard) — the phone never receives the customer table, only ranked
// rows (name, spend, rank) plus the caller's own row when they rank below the cut.

export type LeaderRow = { rank: number; name: string; spendMinor: number; avatarPath: string | null; isMe: boolean };

export function useLeaderboard(limit = 20) {
  const session = useSession();
  return useQuery<LeaderRow[]>({
    queryKey: ["leaderboard", limit, session?.user.id],
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_leaderboard", { p_limit: limit });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((r) => ({
        rank: Number(r.rank),
        name: r.name as string,
        spendMinor: Number(r.spend_minor ?? 0),
        avatarPath: (r.avatar_path as string | null) ?? null,
        isMe: !!r.is_me,
      }));
    },
  });
}

/** Whether the caller currently appears on the public leaderboard (default true). */
export function useLeaderboardVisible() {
  const session = useSession();
  const uid = session?.user.id;
  return useQuery<boolean>({
    queryKey: ["leaderboard-visible", uid],
    enabled: !!uid,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_leaderboard_visible");
      if (error) throw error;
      return data == null ? true : !!data;
    },
  });
}

export function useSetLeaderboardVisible() {
  const qc = useQueryClient();
  const session = useSession();
  const uid = session?.user.id;
  return useMutation({
    mutationFn: async (show: boolean) => {
      const { error } = await supabase.rpc("fn_set_leaderboard_visible", { p_show: show });
      if (error) throw error;
    },
    onMutate: async (show) => {
      await qc.cancelQueries({ queryKey: ["leaderboard-visible", uid] });
      const prev = qc.getQueryData<boolean>(["leaderboard-visible", uid]);
      qc.setQueryData(["leaderboard-visible", uid], show);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["leaderboard-visible", uid], ctx.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
