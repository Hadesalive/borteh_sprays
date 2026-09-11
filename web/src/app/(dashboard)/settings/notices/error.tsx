"use client";

import { PageError } from "@/components/admin/page-error";

export default function NoticesError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load public notices" reset={reset} />;
}
