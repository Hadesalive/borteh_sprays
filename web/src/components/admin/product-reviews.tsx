"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SealCheck } from "@phosphor-icons/react";

import { Chip, type Tone } from "@/components/admin/chip";
import { setReviewStatus } from "@/app/(dashboard)/products/actions";

export type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: "pending" | "published" | "rejected";
  verifiedPurchase: boolean;
  createdAt: string;
  reviewer: string;
};

const STATUS: Record<ReviewRow["status"], { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  published: { label: "Published", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5`} className="text-[13px] leading-none">
      <span className="text-brand">{"★".repeat(Math.max(0, Math.min(5, n)))}</span>
      <span className="text-[#D6D3CD]">{"★".repeat(5 - Math.max(0, Math.min(5, n)))}</span>
    </span>
  );
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewItem({ r, productId }: { r: ReviewRow; productId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const s = STATUS[r.status];

  function set(status: ReviewRow["status"]) {
    setErr(null);
    start(async () => {
      const res = await setReviewStatus({ reviewId: r.id, status, productId });
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  return (
    <div className="border-t border-border px-5 py-3.5 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stars n={r.rating} />
          <span className="text-[13px] font-medium">{r.reviewer}</span>
          {r.verifiedPurchase ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-success" title="Verified purchase">
              <SealCheck weight="duotone" className="size-3.5" /> Verified
            </span>
          ) : null}
        </div>
        <Chip tone={s.tone}>{s.label}</Chip>
      </div>
      {r.title ? <p className="mt-1.5 text-[13px] font-medium">{r.title}</p> : null}
      {r.body ? <p className="mt-0.5 text-[13px] text-muted-foreground">{r.body}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{fmtDate(r.createdAt)}</span>
        <span className="flex items-center gap-1.5">
          {err ? <span className="text-[12px] text-destructive-soft-foreground">{err}</span> : null}
          {r.status !== "published" ? (
            <button type="button" disabled={pending} onClick={() => set("published")}
              className="h-7 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-[#1a1917] disabled:opacity-40">
              Publish
            </button>
          ) : null}
          {r.status !== "rejected" ? (
            <button type="button" disabled={pending} onClick={() => set("rejected")}
              className="h-7 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40">
              Reject
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function ProductReviews({ productId, reviews }: { productId: string; reviews: ReviewRow[] }) {
  const published = reviews.filter((r) => r.status === "published").length;
  const pending = reviews.filter((r) => r.status === "pending").length;

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-[13px] font-[650] tracking-[-0.1px]">Reviews</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Only published reviews count toward the product rating.</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {pending ? <Chip tone="warning">{pending} pending</Chip> : null}
          <span className="nums">{published} published</span>
        </span>
      </div>
      {reviews.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No reviews yet.</p>
      ) : (
        reviews.map((r) => <ReviewItem key={r.id} r={r} productId={productId} />)
      )}
    </div>
  );
}
