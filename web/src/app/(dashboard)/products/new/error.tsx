"use client";

import { PageError } from "@/components/admin/page-error";

export default function NewProductError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load this page" reset={reset} />;
}
