"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Flag, SealCheck } from "@phosphor-icons/react";

import { Chip } from "@/components/admin/chip";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { decideReview } from "@/app/(dashboard)/reviews/actions";

export type QueueReport = { reason: string; detail: string | null; reporter: string; createdAt: string };

export type QueueRow = {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  title: string | null;
  body: string | null;
  reviewer: string;
  verifiedPurchase: boolean;
  createdAt: string;
  /** Reports still open against this review — empty when the word filter held it. */
  reports: QueueReport[];
};

const REASON_LABEL: Record<string, string> = {
  offensive: "Offensive",
  spam: "Spam",
  irrelevant: "Irrelevant",
  other: "Other",
};

function Stars({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(5, n));
  return (
    <span aria-label={`${n} out of 5`} className="text-[13px] leading-none">
      <span className="text-brand">{"★".repeat(filled)}</span>
      <span className="text-muted-foreground">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function fmt(ts: string) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ReviewQueue({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(row: QueueRow, status: "published" | "rejected") {
    setError(null);
    start(async () => {
      const res = await decideReview({ reviewId: row.id, status, productId: row.productId });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden p-0">
        <EmptyState title="Nothing waiting." description="Reported and filtered reviews land here for a decision." />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="bg-destructive-soft px-3 py-2 text-[13px] text-destructive-soft-foreground">
          {error}
        </p>
      ) : null}

      {rows.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Stars n={r.rating} />
            <Link href={`/products/${r.productId}`} className="text-[13px] font-medium hover:underline">
              {r.productName}
            </Link>
            {r.verifiedPurchase ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <SealCheck weight="fill" className="size-3.5" /> Verified
              </span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {r.reviewer} · {fmt(r.createdAt)}
            </span>
          </div>

          {r.title ? <p className="mt-2 text-[13px] font-medium">{r.title}</p> : null}
          {r.body ? <p className="mt-1 text-[13px] text-muted-foreground">{r.body}</p> : null}

          {r.reports.length > 0 ? (
            <ul className="mt-3 space-y-1 border-l-2 border-destructive/40 pl-3">
              {r.reports.map((rep, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-destructive">
                    <Flag weight="fill" className="size-3" />
                    {REASON_LABEL[rep.reason] ?? rep.reason}
                  </span>{" "}
                  reported by {rep.reporter} · {fmt(rep.createdAt)}
                  {rep.detail ? <span className="block italic">“{rep.detail}”</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              <Chip tone="warning">Held by the word filter</Chip>
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(r, "published")}
              className="inline-flex h-8 items-center border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              Publish
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide(r, "rejected")}
              className="inline-flex h-8 items-center bg-destructive/10 px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
