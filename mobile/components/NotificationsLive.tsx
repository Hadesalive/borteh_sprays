import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useSession } from "@/lib/auth";
import { normalizeNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { showNotificationToast } from "./NotificationToast";

// Live inbox. The notification table has been in the supabase_realtime publication
// since the day-one schema — this subscribes to the signed-in user's rows and
// invalidates the shared query, so the bell dot and list update the moment a
// notification lands (no waiting on the 90s polling fallback). Returning to the
// foreground also refetches: online-first, no offline sync (ADR).
export function NotificationsLive() {
  const qc = useQueryClient();
  const session = useSession();
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification", filter: `user_id=eq.${uid}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications", uid] });
          showNotificationToast(normalizeNotification(payload.new)); // in-app banner
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notification", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", uid] }),
      )
      .subscribe();

    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") qc.invalidateQueries({ queryKey: ["notifications", uid] });
    });

    return () => {
      supabase.removeChannel(channel);
      appState.remove();
    };
  }, [uid, qc]);

  return null;
}
