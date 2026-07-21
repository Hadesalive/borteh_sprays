"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type CollectionInput = {
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

function toRow(input: CollectionInput) {
  return {
    name: input.name.trim(),
    slug: input.slug.trim(),
    is_active: input.active,
    is_featured_home: input.featured,
  };
}

export async function createCollection(input: CollectionInput): Promise<ActionResult> {
  await requireStaff();
  if (!input.name.trim() || !input.slug.trim()) return { ok: false, error: "Name and slug are required." };
  const { error } = await createAdminClient().from("category").insert({ ...toRow(input), kind: "collection" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/collections");
  return { ok: true };
}

export async function updateCollection(id: string, input: CollectionInput): Promise<ActionResult> {
  await requireStaff();
  if (!input.name.trim() || !input.slug.trim()) return { ok: false, error: "Name and slug are required." };
  const { error } = await createAdminClient().from("category").update(toRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/collections");
  return { ok: true };
}

export async function setCollectionFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient().from("category").update({ is_featured_home: featured }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/collections");
  return { ok: true };
}

/** Soft delete — frees the slug (uq index is WHERE deleted_at is null). */
export async function deleteCollection(id: string): Promise<ActionResult> {
  await requireStaff();
  const { error } = await createAdminClient()
    .from("category")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/collections");
  return { ok: true };
}
