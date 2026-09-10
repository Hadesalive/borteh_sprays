import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewQueue, type QueueRow, type QueueReport } from "@/components/admin/review-queue";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewer_name: string | null;
  verified_purchase: boolean;
  created_at: string;
  product: { name: string } | null;
};

type ReportRow = {
  review_id: string;
  reason: string;
  detail: string | null;
  reporter_id: string;
  created_at: string;
};

/**
 * Everything waiting on a moderation decision: reviews a customer reported
 * (which hide themselves on the first report) and reviews the word filter
 * held back. Both land as 'pending', so one query covers the queue.
 *
 * This page is the promise behind our App Store review notes — that reports
 * are acted on within 24 hours. See docs/app-store-review.md.
 */
export default async function ReviewModerationPage() {
  const db = createServerClient();

  const { data: reviews, error } = await db
    .from("review")
    .select("id, product_id, user_id, rating, title, body, reviewer_name, verified_purchase, created_at, product:product_id(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = (reviews ?? []) as unknown as ReviewRow[];

  const { data: reportRows, error: reportError } = rows.length
    ? await db
        .from("review_report")
        .select("review_id, reason, detail, reporter_id, created_at")
        .eq("status", "open")
        .in("review_id", rows.map((r) => r.id))
    : { data: [], error: null };
  if (reportError) throw reportError;

  const reports = (reportRows ?? []) as ReportRow[];

  // One bounded lookup for every name we need — review authors and reporters.
  const userIds = [...new Set([...rows.map((r) => r.user_id), ...reports.map((r) => r.reporter_id)])];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: userError } = await db.from("app_user").select("id, display_name").in("id", userIds);
    if (userError) throw userError;
    for (const u of (users ?? []) as Array<{ id: string; display_name: string | null }>) {
      names.set(u.id, u.display_name ?? "");
    }
  }

  const byReview = new Map<string, QueueReport[]>();
  for (const rep of reports) {
    const list = byReview.get(rep.review_id) ?? [];
    list.push({
      reason: rep.reason,
      detail: rep.detail,
      reporter: names.get(rep.reporter_id) || "A customer",
      createdAt: rep.created_at,
    });
    byReview.set(rep.review_id, list);
  }

  const queue: QueueRow[] = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.product?.name ?? "Unknown product",
    rating: r.rating,
    title: r.title,
    body: r.body,
    reviewer: r.reviewer_name || names.get(r.user_id) || "Customer",
    verifiedPurchase: r.verified_purchase,
    createdAt: r.created_at,
    reports: byReview.get(r.id) ?? [],
  }));

  // Reported first — a customer is waiting on those.
  queue.sort((a, b) => b.reports.length - a.reports.length);

  const reported = queue.filter((q) => q.reports.length > 0).length;

  return (
    <>
      <PageHeader
        title="Review moderation"
        description={
          queue.length === 0
            ? "Reported and filtered reviews land here."
            : `${queue.length} waiting${reported > 0 ? ` · ${reported} reported by customers` : ""}.`
        }
      />
      <div className="px-5 pb-6 pt-2">
        <div className="mt-4">
          <ReviewQueue rows={queue} />
        </div>
      </div>
    </>
  );
}
