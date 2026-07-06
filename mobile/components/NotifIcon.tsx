import { BellRinging, CheckCircle, Info, Moped, Package, Tag, XCircle } from "phosphor-react-native";
import type { ComponentType } from "react";
import type { AppNotification } from "@/lib/notifications";
import { colors } from "@/lib/theme";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;

/** The one glyph+color map for a notification. Order rows refine by the title
 *  keywords our trigger writes (fn_notify_order_status owns that copy — keep the
 *  two in step). `chip` is the semantic bed color the toast paints behind it. */
export function notifGlyph(n: AppNotification): { Icon: Glyph; chip: string } {
  const t = (n.title ?? "").toLowerCase();
  if (n.type === "order_status" || n.type === "delivery") {
    if (t.includes("confirmed")) return { Icon: CheckCircle, chip: colors.success };
    if (t.includes("on the way")) return { Icon: Moped, chip: colors.accent };
    if (t.includes("arrived") || t.includes("delivered")) return { Icon: Package, chip: colors.success };
    if (t.includes("cancelled")) return { Icon: XCircle, chip: colors.error };
    return { Icon: Package, chip: colors.accent };
  }
  if (n.type === "restock_available") return { Icon: BellRinging, chip: colors.accent };
  if (n.type === "promo") return { Icon: Tag, chip: colors.accent };
  return { Icon: Info, chip: colors.ink60 };
}

/** Inbox-list glyph — quiet ink/ink40, error tint only while an unread cancellation. */
export function NotifIcon({ n, unread }: { n: AppNotification; unread: boolean }) {
  const { Icon, chip } = notifGlyph(n);
  const tint = unread ? (chip === colors.error ? colors.error : colors.ink) : colors.ink40;
  return <Icon size={22} color={tint} weight="regular" />;
}
