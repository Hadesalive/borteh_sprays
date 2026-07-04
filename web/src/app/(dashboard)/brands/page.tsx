import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { BrandsTable, type BrandRow } from "@/components/admin/brands-table";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("brand")
    .select("id, name, slug, is_active, is_featured_home, product(count)")
    .is("deleted_at", null)
    .order("is_featured_home", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const brands: BrandRow[] = (data ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    slug: b.slug as string,
    active: b.is_active as boolean,
    featured: b.is_featured_home as boolean,
    products: (b.product as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
  const featured = brands.filter((b) => b.featured && b.active).length;

  return (
    <>
      <PageHeader
        title="Brands"
        description={
          error
            ? "Couldn't load brands — check the Supabase keys in web/.env.local."
            : `${brands.length} brands · ${featured} featured on the app home`
        }
      >
        <Link
          href="/brands/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus weight="duotone" className="size-4" />
          New brand
        </Link>
      </PageHeader>

      <p className="px-6 pt-4 text-xs text-muted-foreground lg:px-10">
        Featured brands appear in the app&rsquo;s &ldquo;Shop by brand&rdquo; rail, in this order.
      </p>

      <BrandsTable brands={brands} />
    </>
  );
}
