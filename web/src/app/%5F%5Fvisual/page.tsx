import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Dev-only visual baseline. Renders v5 chrome with no data so Playwright can
// screenshot-diff it. Task 3 and Task 4 must not change these pixels.
//
// 404s in production: this is a test fixture, not a page the shop owner or
// anyone else should ever be able to reach.
export const dynamic = "force-static";

export default function VisualBaselinePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-background p-8">
      <Card data-testid="card-default" className="w-80 p-4">
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </Card>

      <Button data-testid="button-primary" className="mt-8">
        New order
      </Button>
    </main>
  );
}
