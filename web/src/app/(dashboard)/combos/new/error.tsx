"use client";

import { PageError } from "@/components/admin/page-error";

export default function ComboFormError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this combo" reset={reset} />;
}
