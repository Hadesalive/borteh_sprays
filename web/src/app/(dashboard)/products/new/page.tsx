import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { ProductEditor, type EditorInitial } from "@/components/admin/product-editor";

export const dynamic = "force-dynamic";

const BLANK: EditorInitial = {
  id: "",
  name: "",
  brand_id: "",
  category_id: null,
  gender: "unisex",
  description: "",
  scent_family: "",
  main_accords: [],
  release_year: null,
  is_active: true,
  is_featured: false,
  notes: [],
  variants: [],
};

export default async function NewProductPage() {
  const db = createServerClient();
  const [brandsRes, categoriesRes] = await Promise.all([
    db.from("brand").select("id, name").is("deleted_at", null).order("name"),
    db.from("category").select("id, name").order("name"),
  ]);
  const brands = (brandsRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const categories = (categoriesRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));

  return (
    <div className="px-5 pb-6 pt-2">
      <Link href="/products" className="inline-flex items-center gap-1.5 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Products
      </Link>
      <div className="pb-4 pt-1">
        <h1 className="text-xl font-[650] tracking-[-0.2px]">New product</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Give it a scent family and at least one variant — it&rsquo;s recommendation-ready the moment you create it. Add images and receive stock on the next screen.</p>
      </div>
      <div className="max-w-3xl">
        <ProductEditor initial={BLANK} brands={brands} categories={categories} />
      </div>
    </div>
  );
}
