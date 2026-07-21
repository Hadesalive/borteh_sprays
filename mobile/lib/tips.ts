import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

// "How to use Borteh" tips — DB-backed (public.tip) so the owner edits them from the
// admin without a code change. RLS already returns only active, non-deleted rows.

export type Tip = { id: string; title: string; body: string; icon: string | null };

export function useTips() {
  return useQuery<Tip[]>({
    queryKey: ["tips"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tip")
        .select("id, title, body, icon, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((t) => ({ id: t.id, title: t.title, body: t.body, icon: t.icon ?? null }));
    },
  });
}
