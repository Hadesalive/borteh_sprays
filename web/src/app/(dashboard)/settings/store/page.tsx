import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { StoreForm } from "@/components/admin/store-form";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const db = createServerClient();
  const { data, error } = await db
    .from("store_location")
    .select("id, name, code, address_text, phone, type")
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;

  const store = data as {
    id: string;
    name: string | null;
    code: string | null;
    address_text: string | null;
    phone: string | null;
    type: string | null;
  } | null;

  return (
    <>
      <PageHeader title="Store profile" description="Your store name and pickup address, shown across the app." />

      <div className="px-5 pb-6 pt-2">
        <Link
          href="/settings"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Settings
        </Link>

        {store ? (
          <Card className="mt-4 p-4">
            <StoreForm
              initial={{
                id: store.id,
                name: store.name ?? "",
                code: store.code ?? "",
                address: store.address_text ?? "",
                phone: store.phone ?? "",
              }}
            />
          </Card>
        ) : (
          <Card className="mt-4 overflow-hidden p-0">
            <EmptyState title="No default store found yet." description="One store_location row marked as default is expected." />
          </Card>
        )}
      </div>
    </>
  );
}
