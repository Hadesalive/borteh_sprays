"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type ModerationResult = { ok: true } | { ok: false; error: string };

/**
 * Decide a review from the moderation queue, and close any reports filed
 * against it in the same breath — a report left "open" after staff have acted
 * would keep the queue lying about how much work is outstanding.
 *
 * Publishing resolves the reports as 'dismissed' (we looked, the review is
 * fine); rejecting resolves them as 'actioned' (the report was right).
 */
export async function decideReview(input: {
  reviewId: string;
  status: "published" | "rejected";
  productId?: string;
}): Promise<ModerationResult> {
  await requireStaff();
  const db = createAdminClient();

  const { error } = await db.from("review").update({ status: input.status }).eq("id", input.reviewId);
  if (error) return { ok: false, error: error.message };

  const { error: reportError } = await db
    .from("review_report")
    .update({ status: input.status === "published" ? "dismissed" : "actioned" })
    .eq("review_id", input.reviewId)
    .eq("status", "open");
  if (reportError) return { ok: false, error: reportError.message };

  revalidatePath("/reviews");
  if (input.productId) revalidatePath(`/products/${input.productId}`);
  return { ok: true };
}
