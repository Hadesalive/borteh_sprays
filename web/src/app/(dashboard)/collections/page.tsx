import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CollectionsTable, type CollectionRow } from "@/components/admin/collections-table";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("category")
    .select("id, name, slug, is_active, is_featured_home, product(count)")
    .eq("kind", "collection")
    .is("deleted_at", null)
    .order("is_featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const collections: CollectionRow[] = (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    slug: c.slug as string,
    active: c.is_active as boolean,
    featured: c.is_featured_home as boolean,
    products: (c.product as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  const featured = collections.filter((c) => c.featured && c.active).length;

  return (
    <>
      <PageHeader
        title="Collections"
        description={
          error
            ? "Couldn't load collections — check the Supabase keys in web/.env.local."
            : `${collections.length} collections · ${featured} on the app home`
        }
      >
        <Link
          href="/collections/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus weight="duotone" className="size-4" />
          New collection
        </Link>
      </PageHeader>

      <p className="px-6 pt-4 text-xs text-muted-foreground lg:px-10">
        Featured collections appear on the app home, in this order.
      </p>

      <CollectionsTable collections={collections} />
    </>
  );
}
