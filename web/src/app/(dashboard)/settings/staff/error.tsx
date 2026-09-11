"use client";

import { PageError } from "@/components/admin/page-error";

export default function StaffError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load staff" reset={reset} />;
}
