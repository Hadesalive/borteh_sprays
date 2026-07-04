import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { StoreForm } from "@/components/admin/store-form";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const db = createServerClient();
  const { data } = await db
    .from("store_location")
    .select("id, name, code, address_text, type")
    .eq("is_default", true)
    .maybeSingle();

  const store = data as {
    id: string;
    name: string | null;
    code: string | null;
    address_text: string | null;
    type: string | null;
  } | null;

  return (
    <>
      <div className="border-b border-border px-6 py-5 lg:px-10">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Store profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your store name and pickup address, shown across the app.</p>
      </div>

      {store ? (
        <StoreForm
          initial={{
            id: store.id,
            name: store.name ?? "",
            code: store.code ?? "",
            address: store.address_text ?? "",
          }}
        />
      ) : (
        <p className="mx-auto max-w-2xl px-6 py-10 text-center text-sm text-muted-foreground lg:px-10">
          No default store found yet.
        </p>
      )}
    </>
  );
}
