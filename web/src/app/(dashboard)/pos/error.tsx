"use client";

import { PageError } from "@/components/admin/page-error";

export default function PosError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load the till" reset={reset} />;
}
