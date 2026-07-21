"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/auth-server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SlideInput = { title: string; body: string };

const PATH = "/content/onboarding";

/** Append a new slide after the current last one. */
export async function createSlide(input: SlideInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!input.title.trim() || !input.body.trim()) return { ok: false, error: "Title and body are required." };

  const db = createAdminClient();
  const { data: last } = await db
    .from("onboarding_slide")
    .select("sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1);
  const next = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 10;

  const { error } = await db.from("onboarding_slide").insert({
    title: input.title.trim(),
    body: input.body.trim(),
    sort_order: next,
    updated_by: staff.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateSlide(id: string, input: SlideInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!input.title.trim() || !input.body.trim()) return { ok: false, error: "Title and body are required." };
  const { error } = await createAdminClient()
    .from("onboarding_slide")
    .update({ title: input.title.trim(), body: input.body.trim(), updated_by: staff.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function setSlideActive(id: string, active: boolean): Promise<ActionResult> {
  const staff = await requireStaff();
  const { error } = await createAdminClient()
    .from("onboarding_slide")
    .update({ is_active: active, updated_by: staff.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Soft delete — keeps history; the partial index only counts non-deleted rows. */
export async function deleteSlide(id: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const { error } = await createAdminClient()
    .from("onboarding_slide")
    .update({ deleted_at: new Date().toISOString(), is_active: false, updated_by: staff.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Rewrite the whole order from a reordered list of ids (10, 20, 30 …). */
export async function reorderSlides(ids: string[]): Promise<ActionResult> {
  const staff = await requireStaff();
  const db = createAdminClient();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db
      .from("onboarding_slide")
      .update({ sort_order: (i + 1) * 10, updated_by: staff.id })
      .eq("id", ids[i]);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(PATH);
  return { ok: true };
}
