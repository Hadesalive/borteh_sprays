import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useWhatsAppSupport } from "@/lib/account";
import { Colors, space } from "@/lib/theme";
import { useTheme, useThemedStyles } from "@/lib/theme-context";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Fills the dead space on the "waiting on a Monime payment" screens with
 *  what Apple actually does for this moment (Apple Pay, Wallet transit
 *  cards): a native activity indicator + one quiet status line — not a
 *  decorative numbered "how it works" list. Presentational only. */
export function PaymentWaitPanel({ expiresAt }: { expiresAt: string | null }) {
  const { colors } = useTheme();
  const s = useThemedStyles(makeStyles);
  const whatsapp = useWhatsAppSupport();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const msLeft = expiresAt ? new Date(expiresAt).getTime() - now : null;
  const expired = msLeft !== null && msLeft <= 0;

  return (
    <View style={s.wrap}>
      <View style={s.status}>
        {expired ? null : <ActivityIndicator size="small" color={colors.ink60} />}
        <AppText variant="bodySoft">
          {expired ? "This code has expired." : "Waiting for payment confirmation…"}
        </AppText>
      </View>
      {msLeft !== null ? (
        <AppText variant="caption" style={[s.countdown, { color: expired ? colors.error : colors.ink40 }]}>
          {expired ? "Request a new code to continue." : `Expires in ${formatCountdown(msLeft)}`}
        </AppText>
      ) : null}
      {/* only once something's actually gone wrong (expired) — a help link
          while a fresh code is still ticking down would read as "this is
          already broken," undermining the payment that's still working fine */}
      {expired && whatsapp.available ? (
        <View style={{ marginTop: space.xs }}>
          <LinkLabel
            label="Trouble paying? Message us"
            onPress={() => whatsapp.open("Hi, I'm having trouble completing a mobile money payment.")}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { marginTop: space["2xl"], alignItems: "center", gap: space.xs },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm },
  countdown: { fontVariant: ["tabular-nums"] },
});
