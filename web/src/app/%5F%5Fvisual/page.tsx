import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Dev-only visual baseline. Renders v6 chrome with no data so Playwright can
// screenshot-diff it. This page's whole purpose is catching UNINTENTIONAL
// pixel drift in later waves — its own baselines were deliberately updated
// for the v6 bronze/paper/square pass (see docs/superpowers/specs/
// 2026-09-02-admin-redesign-design.md). Don't reflexively regenerate
// snapshots if this page's rendering changes later — check whether the
// change was intended first.
//
// 404s in production: this is a test fixture, not a page the shop owner or
// anyone else should ever be able to reach.
export const dynamic = "force-static";

export default function VisualBaselinePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="bg-background p-8">
      <h1 data-testid="heading-display" className="font-display text-3xl text-foreground">
        Borteh Admin
      </h1>

      <Card data-testid="card-default" className="mt-8 w-80 p-4">
        <p className="text-[13px] font-semibold">Card title</p>
        <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
      </Card>

      <Button data-testid="button-primary" className="mt-8">
        New order
      </Button>

      <div className="dark mt-8 bg-background p-8">
        <Card data-testid="card-dark" className="w-80 p-4">
          <p className="text-[13px] font-semibold">Card title</p>
          <p className="mt-1 text-xs text-muted-foreground">Supporting line.</p>
        </Card>
        <Button data-testid="button-dark" className="mt-8">
          New order
        </Button>
      </div>
    </main>
  );
}
