"use server";

import { createAuthServerClient } from "@/lib/supabase/auth-server";

export type SendNoticeResult = { ok: true; recipients: number } | { ok: false; error: string };

/** Broadcast a notice to customers. The DB function re-checks is_staff() against
 *  the caller's session, so this runs on the AUTH client — not the admin client. */
export async function sendNotice(input: {
  title: string;
  body: string;
  kind: "system" | "promo";
  audience: "all" | "marketing";
}): Promise<SendNoticeResult> {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await auth.rpc("fn_broadcast_notice", {
    p_title: input.title,
    p_body: input.body,
    p_kind: input.kind,
    p_audience: input.audience,
  });
  if (error) {
    const msg = /not_authorized/.test(error.message)
      ? "Only staff can send notices."
      : /title_and_body_required/.test(error.message)
        ? "Add a title and a message."
        : error.message;
    return { ok: false, error: msg };
  }
  return { ok: true, recipients: (data as number) ?? 0 };
}
