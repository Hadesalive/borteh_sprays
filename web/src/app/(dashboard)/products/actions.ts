"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

const IMAGES_BUCKET = "product-images";

export type NoteInput = { name: string; position: "top" | "heart" | "base" };

export type VariantInput = {
  id?: string;
  size_ml: number;
  concentration: string;
  sku: string;
  barcode: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  is_active: boolean;
};

export type ProductPayload = {
  id: string;
  name: string;
  brand_id: string;
  category_id: string | null;
  gender: string;
  description: string | null;
  scent_family: string;
  main_accords: string[];
  release_year: number | null;
  is_active: boolean;
  is_featured: boolean;
  notes: NoteInput[];
  variants: VariantInput[];
};

/** The current signed-in staff member's id, for stock_ledger attribution (created_by). */
async function currentStaffId(): Promise<string | null> {
  const auth = await createAuthServerClient();
  const { data } = await auth.auth.getUser();
  return data.user?.id ?? null;
}

function revalidateProduct(productId: string) {
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/inventory");
  revalidatePath("/"); // the app home + admin overview read live catalog/stock
}

/**
 * Save a product's scent profile + variants atomically via fn_save_product.
 * With an id it UPDATEs (embed trigger re-embeds on content change); with no id it CREATEs
 * (the insert trigger embeds the new product). scent_family is the required recs gate.
 * Returns the product id (the newly-created one on create).
 */
export async function saveProduct(payload: ProductPayload): Promise<SaveResult> {
  const creating = !payload.id;
  if (!payload.name.trim()) return { ok: false, error: "Name is required." };
  if (!payload.brand_id) return { ok: false, error: "Brand is required." };
  if (!payload.scent_family.trim())
    return { ok: false, error: "Scent family is required — it's the gate that lets this product into recommendations." };
  if (creating && payload.variants.length === 0)
    return { ok: false, error: "Add at least one variant (size + price) before creating." };
  for (const v of payload.variants) {
    if (!v.sku.trim()) return { ok: false, error: "Every variant needs a SKU." };
    if (!Number.isFinite(v.size_ml) || v.size_ml <= 0) return { ok: false, error: "Variant size must be a positive number of ml." };
    if (!Number.isFinite(v.price_minor) || v.price_minor < 0) return { ok: false, error: "Variant price can't be negative." };
  }

  const { data, error } = await createAdminClient().rpc("fn_save_product", { payload });
  if (error) return { ok: false, error: error.message };
  const id = (data as string) ?? payload.id;
  revalidateProduct(id);
  return { ok: true, id };
}

/** Receive units into stock (qty_on_hand += qty) via fn_receive_stock, attributed to staff. */
export async function receiveStock(input: {
  variantId: string;
  qty: number;
  productId: string;
  reason?: string;
}): Promise<ActionResult> {
  if (!Number.isFinite(input.qty) || input.qty <= 0) return { ok: false, error: "Enter a positive quantity." };
  const { error } = await createAdminClient().rpc("fn_receive_stock", {
    p_variant: input.variantId,
    p_qty: Math.floor(input.qty),
    p_actor: await currentStaffId(),
    p_reason: input.reason?.trim() || "Received via admin",
  });
  if (error) return { ok: false, error: error.message };
  revalidateProduct(input.productId);
  return { ok: true };
}

/** Correct stock by a signed delta (qty_on_hand += delta) via fn_adjust_stock, attributed to staff. */
export async function adjustStock(input: {
  variantId: string;
  delta: number;
  productId: string;
  reason?: string;
}): Promise<ActionResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) return { ok: false, error: "Enter a non-zero whole number (e.g. -2 or 3)." };
  const { error } = await createAdminClient().rpc("fn_adjust_stock", {
    p_variant: input.variantId,
    p_delta: input.delta,
    p_actor: await currentStaffId(),
    p_reason: input.reason?.trim() || "Adjusted via admin",
  });
  if (error) return { ok: false, error: error.message };
  revalidateProduct(input.productId);
  return { ok: true };
}

/**
 * Moderate a review: publish or reject it. The review-rollup trigger recomputes the
 * product's avg_rating + review_count (only 'published' rows count), so nothing else to do.
 */
export async function setReviewStatus(input: {
  reviewId: string;
  status: "published" | "rejected" | "pending";
  productId: string;
}): Promise<ActionResult> {
  const { error } = await createAdminClient().from("review").update({ status: input.status }).eq("id", input.reviewId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/products/${input.productId}`);
  return { ok: true };
}

/** Set on-hand to an absolute counted number via fn_stocktake, attributed to staff. */
export async function stocktake(input: {
  variantId: string;
  count: number;
  productId: string;
  reason?: string;
}): Promise<ActionResult> {
  if (!Number.isInteger(input.count) || input.count < 0) return { ok: false, error: "Enter the counted quantity (0 or more)." };
  const { error } = await createAdminClient().rpc("fn_stocktake", {
    p_variant: input.variantId,
    p_count: input.count,
    p_actor: await currentStaffId(),
    p_reason: input.reason?.trim() || "Stocktake",
  });
  if (error) return { ok: false, error: error.message };
  revalidateProduct(input.productId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Product images — Storage writes go through the service-role client (the admin is
// staff-gated at the route level); the public 'product-images' bucket serves them via CDN.
// ---------------------------------------------------------------------------

/** Upload an image file to Storage and attach it as a product_image (first one is primary). */
export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  if (!productId) return { ok: false, error: "Missing product." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file isn't an image." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Image is over 8 MB — please use a smaller file." };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const key = `${productId}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(IMAGES_BUCKET).upload(key, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: existing } = await admin.from("product_image").select("sort_order").eq("product_id", productId);
  const rows = existing ?? [];
  const isPrimary = rows.length === 0;
  const nextSort = rows.reduce((m, r) => Math.max(m, (r.sort_order as number) ?? 0), -1) + 1;

  const { error: insErr } = await admin
    .from("product_image")
    .insert({ product_id: productId, storage_path: key, is_primary: isPrimary, sort_order: nextSort });
  if (insErr) {
    await admin.storage.from(IMAGES_BUCKET).remove([key]); // don't orphan the object
    return { ok: false, error: insErr.message };
  }
  revalidateProduct(productId);
  return { ok: true };
}

/** Make one image the product's primary (clears the old primary first — one-primary index). */
export async function setPrimaryImage(input: { imageId: string; productId: string }): Promise<ActionResult> {
  const admin = createAdminClient();
  await admin.from("product_image").update({ is_primary: false }).eq("product_id", input.productId).eq("is_primary", true);
  const { error } = await admin.from("product_image").update({ is_primary: true }).eq("id", input.imageId);
  if (error) return { ok: false, error: error.message };
  revalidateProduct(input.productId);
  return { ok: true };
}

/** Persist a new display order (sort_order = position in the list). */
export async function reorderImages(input: { productId: string; orderedIds: string[] }): Promise<ActionResult> {
  const admin = createAdminClient();
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await admin
      .from("product_image")
      .update({ sort_order: i })
      .eq("id", input.orderedIds[i])
      .eq("product_id", input.productId);
    if (error) return { ok: false, error: error.message };
  }
  revalidateProduct(input.productId);
  return { ok: true };
}

/** Delete an image (Storage object + row); if it was primary, promote the next one. */
export async function deleteProductImage(input: { imageId: string; productId: string; storagePath: string }): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: img } = await admin.from("product_image").select("is_primary").eq("id", input.imageId).maybeSingle();
  await admin.storage.from(IMAGES_BUCKET).remove([input.storagePath]);
  const { error } = await admin.from("product_image").delete().eq("id", input.imageId);
  if (error) return { ok: false, error: error.message };
  if (img?.is_primary) {
    const { data: rest } = await admin.from("product_image").select("id").eq("product_id", input.productId).order("sort_order").limit(1);
    if (rest && rest.length) await admin.from("product_image").update({ is_primary: true }).eq("id", rest[0].id as string);
  }
  revalidateProduct(input.productId);
  return { ok: true };
}
