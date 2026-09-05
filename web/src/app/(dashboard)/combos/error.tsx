"use client";

import { PageError } from "@/components/admin/page-error";

export default function CombosError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load combos" reset={reset} />;
}
