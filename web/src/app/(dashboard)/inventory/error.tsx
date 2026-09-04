"use client";

import { PageError } from "@/components/admin/page-error";

export default function InventoryError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load inventory" reset={reset} />;
}
