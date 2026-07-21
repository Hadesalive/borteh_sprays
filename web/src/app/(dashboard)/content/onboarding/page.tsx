import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { OnboardingEditor, type Slide } from "@/components/admin/onboarding-editor";

export const dynamic = "force-dynamic";

export default async function OnboardingContentPage() {
  const db = createServerClient();
  const { data } = await db
    .from("onboarding_slide")
    .select("id, title, body, image_path, is_active, sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const slides: Slide[] = (data ?? []).map((s) => ({
    id: s.id as string,
    title: s.title as string,
    body: s.body as string,
    imagePath: (s.image_path as string | null) ?? null,
    active: s.is_active as boolean,
  }));

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="The intro slides a first-time shopper swipes through. Edit copy, reorder, hide, or add slides — the app reads them live."
      />
      <OnboardingEditor slides={slides} />
    </>
  );
}
