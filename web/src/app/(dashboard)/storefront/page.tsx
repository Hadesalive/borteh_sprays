import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import {
  StorefrontBuilder,
  type HeroSlide,
  type Chip,
  type ScentRow,
} from "@/components/admin/storefront-builder";

export const dynamic = "force-dynamic";

export default async function StorefrontPage() {
  const db = createServerClient();

  const [hero, collections, scents, brands] = await Promise.all([
    db.from("home_carousel").select("id, label, title, cta_text, link_url, image_path, is_active").is("deleted_at", null).order("sort_order"),
    db.from("category").select("name, slug, cover_image_path").eq("kind", "collection").eq("is_featured_home", true).is("deleted_at", null).order("sort_order"),
    db.from("home_scent_family").select("id, family, label, is_active").order("sort_order"),
    db.from("brand").select("name, slug, logo_path").eq("is_featured_home", true).is("deleted_at", null).order("sort_order").order("name"),
  ]);

  const heroSlides: HeroSlide[] = (hero.data ?? []).map((s) => ({
    id: s.id as string,
    label: (s.label as string | null) ?? "",
    title: s.title as string,
    cta: (s.cta_text as string | null) ?? "",
    imagePath: (s.image_path as string | null) ?? null,
    active: s.is_active as boolean,
  }));
  const collectionChips: Chip[] = (collections.data ?? []).map((c) => ({
    name: c.name as string,
    imagePath: (c.cover_image_path as string | null) ?? null,
  }));
  const scentRows: ScentRow[] = (scents.data ?? []).map((s) => ({
    id: s.id as string,
    label: s.label as string,
    active: s.is_active as boolean,
  }));
  const brandChips: Chip[] = (brands.data ?? []).map((b) => ({
    name: b.name as string,
    imagePath: (b.logo_path as string | null) ?? null,
  }));

  return (
    <>
      <PageHeader title="Storefront" description="Customise what shoppers see first on the app home — live data." />
      <StorefrontBuilder
        hero={heroSlides}
        collections={collectionChips}
        scents={scentRows}
        brands={brandChips}
      />
    </>
  );
}
