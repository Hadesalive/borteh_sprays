const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Public URL for an object key in the product-images bucket (e.g. "home/hero/oud.jpg"). */
export function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${BASE}/storage/v1/object/public/product-images/${path}`;
}
