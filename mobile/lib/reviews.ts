import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { track } from "./track";

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewerName: string | null;
  status: "pending" | "published" | "rejected";
  createdAt: string;
  mine: boolean;
  userId: string;
};

/** Published reviews for a product, plus the caller's own (even while pending). */
export function useReviews(productId?: string) {
  return useQuery<Review[]>({
    queryKey: ["reviews", productId],
    enabled: !!productId,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("review")
        .select("id, rating, title, body, reviewer_name, status, created_at, user_id")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        reviewerName: r.reviewer_name,
        status: r.status,
        createdAt: r.created_at,
        mine: !!user && r.user_id === user.id,
        userId: r.user_id,
      }));
    },
  });
}

/** Per-star counts (index 0 = 1★ … index 4 = 5★), for a distribution bar —
 *  shared by the product page's compact summary and the full reviews screen. */
export function bucketRatings(reviews: Review[] | undefined): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const rv of reviews ?? []) {
    const bucket = Math.max(1, Math.min(5, Math.round(rv.rating)));
    counts[bucket - 1]++;
  }
  return counts;
}

/** Create or update the caller's review (one per product), via fn_submit_review —
 *  clients can no longer write the review table directly. The server runs the
 *  review through a word filter: clean text publishes immediately, a flagged
 *  match is held as "pending" for staff to clear. Returns which one happened. */
export async function submitReview(input: {
  productId: string;
  rating: number;
  title?: string;
  body?: string;
  reviewerName: string;
}): Promise<"published" | "pending"> {
  const { data, error } = await supabase.rpc("fn_submit_review", {
    p_product: input.productId,
    p_rating: input.rating,
    p_title: input.title?.trim() || null,
    p_body: input.body?.trim() || null,
    p_reviewer_name: input.reviewerName.trim() || null,
  });
  if (error) throw error;
  track("review", { productId: input.productId, metadata: { rating: input.rating } });
  return data as "published" | "pending";
}

export type ReportReason = "offensive" | "spam" | "irrelevant" | "other";

/** Report a review as objectionable. Hides it (for everyone) pending a staff decision. */
export async function reportReview(reviewId: string, reason: ReportReason, detail?: string): Promise<void> {
  const { error } = await supabase.rpc("fn_report_review", {
    p_review: reviewId,
    p_reason: reason,
    p_detail: detail?.trim() || null,
  });
  if (error) throw error;
}

/** Stop seeing this customer's reviews. Personal to the caller — the blocked user is unaffected. */
export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_block_user", { p_user: userId });
  if (error) throw error;
}

/** Undo blockUser. */
export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_unblock_user", { p_user: userId });
  if (error) throw error;
}
