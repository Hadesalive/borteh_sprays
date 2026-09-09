"use client";

import { PageError } from "@/components/admin/page-error";

export default function PosSalesError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load till sales" reset={reset} />;
}
