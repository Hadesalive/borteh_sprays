import { notFound } from "next/navigation";

import { createServerClient } from "@/lib/supabase/server";
import { CollectionForm } from "@/components/admin/collection-form";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = createServerClient();
  const { data } = await db
    .from("category")
    .select("id, name, slug, is_active, is_featured_home")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  return (
    <CollectionForm
      initial={{
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        active: data.is_active as boolean,
        featured: data.is_featured_home as boolean,
      }}
    />
  );
}
