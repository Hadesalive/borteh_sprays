"use client";

import { PageError } from "@/components/admin/page-error";

export default function PosSaleDetailError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this receipt" reset={reset} />;
}
