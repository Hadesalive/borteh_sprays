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
      }));
    },
  });
}

/** Create or update the caller's review (one per product). Re-enters moderation as "pending". */
export async function submitReview(input: { productId: string; rating: number; title?: string; body?: string; reviewerName: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in to leave a review.");
  const { error } = await supabase.from("review").upsert(
    {
      product_id: input.productId,
      user_id: user.id,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body?.trim() || null,
      reviewer_name: input.reviewerName.trim() || null,
      status: "published",
    },
    { onConflict: "user_id,product_id" },
  );
  if (error) throw error;
  track("review", { productId: input.productId, metadata: { rating: input.rating } });
}
