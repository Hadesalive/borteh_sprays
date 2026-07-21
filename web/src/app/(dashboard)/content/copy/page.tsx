import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { CopyEditor, type CopyValues } from "@/components/admin/copy-editor";
import { contentKeys } from "@/lib/content-registry";

export const dynamic = "force-dynamic";

export default async function CopyContentPage() {
  const db = createServerClient();
  const { data } = await db
    .from("app_content")
    .select("key, value_text")
    .in("key", contentKeys);

  const values: CopyValues = {};
  for (const row of data ?? []) {
    values[row.key as string] = (row.value_text as string | null) ?? null;
  }

  return (
    <>
      <PageHeader
        title="App copy"
        description="One-off strings across the app — titles, buttons, helper lines. Leave a field blank to use the app's built-in wording."
      />
      <CopyEditor values={values} />
    </>
  );
}
