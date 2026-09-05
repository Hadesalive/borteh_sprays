"use client";

import { PageError } from "@/components/admin/page-error";

export default function OnboardingError({ reset }: { error: Error; reset: () => void }) {
  return <PageError title="Couldn't load onboarding slides" reset={reset} />;
}
