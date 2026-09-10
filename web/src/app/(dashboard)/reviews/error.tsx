"use client";

import { PageError } from "@/components/admin/page-error";

export default function ReviewModerationError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load the moderation queue" reset={reset} />;
}
