import { ComboForm } from "@/components/admin/combo-form";
import { loadVariantOptions } from "../variant-options";

export const dynamic = "force-dynamic";

export default async function NewComboPage() {
  const variants = await loadVariantOptions();
  return <ComboForm variants={variants} />;
}
