import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { Chip } from "@/components/admin/chip";
import { ProductEditor, type EditorInitial } from "@/components/admin/product-editor";
import { ProductInventory, type InventoryVariant } from "@/components/admin/product-inventory";
import { ProductSignals, type EngagementRow, type SimilarProduct } from "@/components/admin/product-signals";
import { ProductReviews, type ReviewRow } from "@/components/admin/product-reviews";
import { ProductRestock, type RestockGroup } from "@/components/admin/product-restock";
import { ProductImages, type ProductImage } from "@/components/admin/product-images";

export const dynamic = "force-dynamic";

type Band = "in_stock" | "low" | "out";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServerClient();

  const [{ data: product }, brandsRes, categoriesRes, imagesRes] = await Promise.all([
    db
      .from("product")
      .select(
        `id, name, brand_id, category_id, gender, description, scent_family, main_accords, release_year, is_active, is_featured,
         product_variant(id, size_ml, concentration, sku, barcode, price_minor, compare_at_price_minor, is_active, deleted_at,
           inventory_item(qty_on_hand, qty_reserved, qty_available, reorder_point),
           availability_signal(band)),
         product_scent_note(position, scent_note(name))`
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    db.from("brand").select("id, name").is("deleted_at", null).order("name"),
    db.from("category").select("id, name").order("name"),
    db.from("product_image").select("id, storage_path, is_primary, sort_order").eq("product_id", id).order("sort_order", { ascending: true }),
  ]);

  if (!product) notFound();

  type VariantRec = {
    id: string;
    size_ml: number | null;
    concentration: string | null;
    sku: string | null;
    barcode: string | null;
    price_minor: number | null;
    compare_at_price_minor: number | null;
    is_active: boolean | null;
    deleted_at: string | null;
    inventory_item: { qty_on_hand: number; qty_reserved: number; qty_available: number; reorder_point: number }
      | { qty_on_hand: number; qty_reserved: number; qty_available: number; reorder_point: number }[]
      | null;
    availability_signal: { band: Band } | { band: Band }[] | null;
  };
  type NoteRec = { position: "top" | "heart" | "base"; scent_note: { name: string } | { name: string }[] | null };

  const variantRecs = ((product.product_variant ?? []) as VariantRec[]).filter((v) => !v.deleted_at);
  const noteRecs = (product.product_scent_note ?? []) as NoteRec[];

  const initial: EditorInitial = {
    id: product.id,
    name: product.name ?? "",
    brand_id: (product.brand_id as string) ?? "",
    category_id: (product.category_id as string | null) ?? null,
    gender: (product.gender as string) ?? "unisex",
    description: (product.description as string | null) ?? "",
    scent_family: (product.scent_family as string | null) ?? "",
    main_accords: (product.main_accords as string[] | null) ?? [],
    release_year: (product.release_year as number | null) ?? null,
    is_active: product.is_active !== false,
    is_featured: product.is_featured === true,
    notes: noteRecs
      .map((n) => ({ name: one(n.scent_note)?.name ?? "", position: n.position }))
      .filter((n) => n.name),
    variants: variantRecs.map((v) => ({
      id: v.id,
      size_ml: v.size_ml ?? 0,
      concentration: v.concentration ?? "EDP",
      sku: v.sku ?? "",
      barcode: v.barcode ?? null,
      price_minor: v.price_minor ?? 0,
      compare_at_price_minor: v.compare_at_price_minor ?? null,
      is_active: v.is_active !== false,
    })),
  };

  const inventory: InventoryVariant[] = variantRecs.map((v) => {
    const inv = one(v.inventory_item);
    return {
      variantId: v.id,
      sku: v.sku ?? "—",
      label: [v.size_ml != null ? `${v.size_ml} ml` : null, v.concentration].filter(Boolean).join(" · ") || "Variant",
      band: one(v.availability_signal)?.band ?? null,
      onHand: inv?.qty_on_hand ?? 0,
      reserved: inv?.qty_reserved ?? 0,
      available: inv?.qty_available ?? 0,
      reorderPoint: inv?.reorder_point ?? 0,
    };
  });

  const brands = (brandsRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const categories = (categoriesRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const images: ProductImage[] = ((imagesRes.data ?? []) as { id: string; storage_path: string; is_primary: boolean | null }[]).map((im) => ({
    id: im.id,
    url: `${supabaseUrl}/storage/v1/object/public/product-images/${im.storage_path}`,
    storagePath: im.storage_path,
    isPrimary: im.is_primary === true,
  }));

  // --- Phase 2: intelligence & moderation (read-only signals + review moderation) ---
  const variantIds = variantRecs.map((v) => v.id);
  const [reviewsRes, engRes, simRes, restockRes] = await Promise.all([
    db.from("review")
      .select("id, rating, title, body, status, verified_purchase, created_at, app_user(display_name)")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    db.rpc("fn_product_engagement", { p_product_id: id }),           // recs.events wrapper (service_role)
    db.rpc("fn_similar_products", { p_product_id: id, p_limit: 6 }), // embedding neighbours
    variantIds.length
      ? db.from("restock_subscription").select("variant_id").in("variant_id", variantIds).eq("status", "active")
      : Promise.resolve({ data: [] as { variant_id: string }[], error: null }),
  ]);

  type ReviewRec = {
    id: string; rating: number | null; title: string | null; body: string | null;
    status: "pending" | "published" | "rejected"; verified_purchase: boolean | null; created_at: string;
    app_user: { display_name: string | null } | { display_name: string | null }[] | null;
  };
  const reviews: ReviewRow[] = ((reviewsRes.data ?? []) as ReviewRec[]).map((r) => ({
    id: r.id,
    rating: r.rating ?? 0,
    title: r.title,
    body: r.body,
    status: r.status,
    verifiedPurchase: r.verified_purchase === true,
    createdAt: r.created_at,
    reviewer: one(r.app_user)?.display_name?.trim() || "Anonymous",
  }));

  const engagement: EngagementRow[] = ((engRes.data ?? []) as { event_type: string; events: number; users: number }[])
    .map((e) => ({ event_type: e.event_type, events: Number(e.events), users: Number(e.users) }));
  const engagementAvailable = !engRes.error;

  const simRows = (simRes.data ?? []) as { product_id: string; distance: number }[];
  let similar: SimilarProduct[] = [];
  if (simRows.length) {
    const { data: simProducts } = await db.from("product").select("id, name, brand(name)").in("id", simRows.map((s) => s.product_id));
    const byId = new Map((simProducts ?? []).map((p) => [p.id as string, p]));
    similar = simRows
      .map((s) => {
        const p = byId.get(s.product_id);
        return p ? { id: p.id as string, name: (p.name as string) ?? "Untitled", brand: one(p.brand as { name: string | null } | { name: string | null }[] | null)?.name ?? "—" } : null;
      })
      .filter((s): s is SimilarProduct => s !== null);
  }

  const countByVariant = new Map<string, number>();
  for (const s of (restockRes.data ?? []) as { variant_id: string }[]) {
    countByVariant.set(s.variant_id, (countByVariant.get(s.variant_id) ?? 0) + 1);
  }
  const restockGroups: RestockGroup[] = variantRecs
    .map((v) => ({
      variantId: v.id,
      label: [v.size_ml != null ? `${v.size_ml} ml` : null, v.concentration].filter(Boolean).join(" · ") || "Variant",
      sku: v.sku ?? "—",
      count: countByVariant.get(v.id) ?? 0,
    }))
    .filter((g) => g.count > 0);

  return (
    <div className="px-5 pb-6 pt-2">
      <Link href="/products" className="inline-flex items-center gap-1.5 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Products
      </Link>
      <div className="flex flex-wrap items-center gap-2.5 pb-4 pt-1">
        <h1 className="text-xl font-[650] tracking-[-0.2px]">{initial.name || "Untitled product"}</h1>
        <Chip tone={initial.is_active ? "success" : "neutral"}>{initial.is_active ? "Active" : "Hidden"}</Chip>
        {initial.is_featured ? <Chip tone="info">Featured</Chip> : null}
        {!initial.scent_family ? <Chip tone="warning">Needs a scent family</Chip> : null}
      </div>

      <div className="mb-5">
        <ProductImages productId={initial.id} images={images} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ProductEditor initial={initial} brands={brands} categories={categories} />
        <ProductInventory productId={initial.id} variants={inventory} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ProductReviews productId={initial.id} reviews={reviews} />
        <div className="space-y-5">
          <ProductSignals engagement={engagement} similar={similar} available={engagementAvailable} />
          <ProductRestock groups={restockGroups} />
        </div>
      </div>
    </div>
  );
}
