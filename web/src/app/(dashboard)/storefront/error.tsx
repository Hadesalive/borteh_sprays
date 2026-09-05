"use client";

import { PageError } from "@/components/admin/page-error";

export default function StorefrontError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load the storefront" reset={reset} />;
}
