"use client";

import { PageError } from "@/components/admin/page-error";

export default function LoyaltyError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load loyalty settings" reset={reset} />;
}
