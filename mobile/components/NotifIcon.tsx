import { BellRinging, CheckCircle, Info, Moped, Package, Tag, XCircle } from "phosphor-react-native";
import type { ComponentType } from "react";
import type { AppNotification } from "@/lib/notifications";
import { Colors } from "@/lib/theme";
import { useTheme } from "@/lib/theme-context";

type Glyph = ComponentType<{ size?: number; color?: string; weight?: any }>;

/** The one glyph+color map for a notification. Order rows refine by the title
 *  keywords our trigger writes (fn_notify_order_status owns that copy — keep the
 *  two in step). `chip` is the semantic bed color the toast paints behind it. */
export function notifGlyph(n: AppNotification, colors: Colors): { Icon: Glyph; chip: string } {
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

/** Inbox-list glyph — always its real semantic color (success/error/accent),
 *  not just while unread. Read/unread already has its own signal (the leading
 *  dot + bold title) — collapsing every icon to flat grey once read meant a
 *  list of read notifications lost all visual meaning: a cancelled order and
 *  a delivered one looked identical, and a screen full of the same event type
 *  (e.g. several cancellations) read as an undifferentiated wall of grey. */
export function NotifIcon({ n }: { n: AppNotification }) {
  const { colors } = useTheme();
  const { Icon, chip } = notifGlyph(n, colors);
  return <Icon size={22} color={chip} weight="regular" />;
}
