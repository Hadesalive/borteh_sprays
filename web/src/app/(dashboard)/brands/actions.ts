"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";

export type BrandInput = {
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  featured: boolean;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

function toRow(input: BrandInput) {
  return {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description?.trim() || null,
    is_active: input.active,
    is_featured_home: input.featured,
  };
}

export async function createBrand(input: BrandInput): Promise<ActionResult> {
  if (!input.name.trim() || !input.slug.trim()) return { ok: false, error: "Name and slug are required." };
  const { error } = await createAdminClient().from("brand").insert(toRow(input));
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brands");
  return { ok: true };
}

export async function updateBrand(id: string, input: BrandInput): Promise<ActionResult> {
  if (!input.name.trim() || !input.slug.trim()) return { ok: false, error: "Name and slug are required." };
  const { error } = await createAdminClient().from("brand").update(toRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brands");
  return { ok: true };
}

export async function setBrandFeatured(id: string, featured: boolean): Promise<ActionResult> {
  const { error } = await createAdminClient().from("brand").update({ is_featured_home: featured }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brands");
  return { ok: true };
}

/** Soft delete — keeps history and frees the slug (uq index is WHERE deleted_at is null). */
export async function deleteBrand(id: string): Promise<ActionResult> {
  const { error } = await createAdminClient()
    .from("brand")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brands");
  return { ok: true };
}
