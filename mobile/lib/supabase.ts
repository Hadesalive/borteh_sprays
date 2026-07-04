import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Fail loud in dev so a missing .env is obvious.
  console.warn("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check mobile/.env");
}

// React Native ships a global WebSocket + fetch, so no polyfills beyond url-polyfill are needed.
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const PRODUCT_BUCKET = "product-images";

/** Public CDN URL for a product image object key (e.g. "asad.png"). */
export function imageUrl(storagePath?: string | null): string | null {
  if (!storagePath) return null;
  return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
