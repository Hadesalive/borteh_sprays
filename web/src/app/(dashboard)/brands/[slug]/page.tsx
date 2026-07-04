import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { BrandForm } from "@/components/admin/brand-form";

export const dynamic = "force-dynamic";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = createServerClient();
  const { data } = await db
    .from("brand")
    .select("id, name, slug, description, is_active, is_featured_home")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  return (
    <BrandForm
      initial={{
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        description: (data.description as string | null) ?? null,
        active: data.is_active as boolean,
        featured: data.is_featured_home as boolean,
      }}
    />
  );
}
