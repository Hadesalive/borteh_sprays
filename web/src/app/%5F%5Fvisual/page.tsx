import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";

// Dev-only visual baseline. Renders v5 chrome with no data so Playwright can
// screenshot-diff it. Task 3 and Task 4 must not change these pixels.
//
// 404s in production: this is a test fixture, not a page the shop owner or
// anyone else should ever be able to reach.
export const dynamic = "force-static";

const bevel =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(26,26,26,0.07)]";

export default function VisualBaselinePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-background p-8">
      <Card data-testid="card-default" className="w-80 p-4">
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </Card>

      <button
        data-testid="button-primary"
        className={`mt-8 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors ${bevel}`}
      >
        New order
      </button>
    </main>
  );
}
