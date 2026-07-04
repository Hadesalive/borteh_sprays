import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CaretRight, Heart, PencilSimple, Receipt, SignOut, User } from "phosphor-react-native";
import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { signOut, useAuthReady, useSession } from "@/lib/auth";
import { useOrders } from "@/lib/orders";
import { useWishlist } from "@/lib/wishlist";
import { colors, font, radius, space } from "@/lib/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const ready = useAuthReady();
  const { data: orders } = useOrders();
  const saved = useWishlist();

  const name = (session?.user.user_metadata?.display_name as string) || "Your account";
  const phone = (session?.user.user_metadata?.phone as string) || "";
  const orderCount = orders?.length ?? 0;

  return (
    <View style={s.fill}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.xl }}>
        <BackButton onPress={() => router.back()} style={{ marginBottom: space.sm }} />

        {!ready ? null : session ? (
          <>
            <View style={s.identity}>
              <View style={s.avatar}>
                <AppText style={s.avatarTxt}>{name.trim().charAt(0).toUpperCase()}</AppText>
              </View>
              <AppText style={s.name} numberOfLines={1}>
                {name}
              </AppText>
              {phone ? <AppText style={s.phone}>{phone}</AppText> : null}
            </View>

            <View style={s.menu}>
              <Row icon={<Receipt size={19} color={colors.ink} weight="regular" />} label="Your orders" value={orderCount ? String(orderCount) : undefined} onPress={() => router.push("/orders")} />
              <View style={s.sep} />
              <Row icon={<Heart size={19} color={colors.ink} weight="regular" />} label="Saved fragrances" value={saved.length ? String(saved.length) : undefined} onPress={() => router.replace("/wishlist")} />
              <View style={s.sep} />
              <Row icon={<PencilSimple size={19} color={colors.ink} weight="regular" />} label="Edit profile" onPress={() => router.push("/edit-profile")} />
            </View>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                signOut();
              }}
              style={({ pressed }) => [s.signout, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <SignOut size={18} color={colors.badge} weight="bold" />
              <AppText style={s.signoutTxt}>Sign out</AppText>
            </Pressable>
          </>
        ) : (
          <View style={s.guest}>
            <View style={s.guestIcon}>
              <User size={34} color={colors.inkMute} weight="regular" />
            </View>
            <AppText style={s.guestTitle}>Your account</AppText>
            <AppText style={s.guestBody}>Sign in to track orders and save your delivery details.</AppText>

            <Button title="Sign in" onPress={() => router.push("/login")} style={{ marginTop: space["2xl"], marginHorizontal: space.sm }} />
            <Pressable onPress={() => router.push("/signup")} style={s.altRow} hitSlop={8} accessibilityRole="button">
              <AppText style={s.altTxt}>New to Borteh? </AppText>
              <AppText style={s.altLink}>Create an account</AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, onPress }: { icon: ReactNode; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={s.rowIcon}>{icon}</View>
      <AppText style={s.rowLabel}>{label}</AppText>
      {value ? <AppText style={s.rowValue}>{value}</AppText> : null}
      <CaretRight size={17} color={colors.inkMute} weight="bold" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  back: { width: 44, height: 44, justifyContent: "center", marginLeft: -10, marginBottom: space.sm },
  identity: { alignItems: "center", marginTop: space.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontFamily: font.bold, fontSize: 30, color: colors.accentInk },
  name: { fontFamily: font.bold, fontSize: 23, color: colors.ink, letterSpacing: -0.4, marginTop: space.lg },
  phone: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginTop: 3 },
  menu: { marginTop: space["3xl"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingVertical: space.lg },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.plinth, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.ink },
  rowValue: { fontFamily: font.semibold, fontSize: 14, color: colors.inkSoft, marginRight: space.xs },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: 56 },
  signout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 52, borderRadius: radius.pill, backgroundColor: colors.field, marginTop: space["3xl"] },
  signoutTxt: { fontFamily: font.bold, fontSize: 15, color: colors.badge },
  guest: { alignItems: "center", paddingTop: space["4xl"] },
  guestIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" },
  guestTitle: { fontFamily: font.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.4, marginTop: space.xl },
  guestBody: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: "center", marginTop: space.sm, paddingHorizontal: space.xl },
  cta: { height: 56, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginTop: space["2xl"], alignSelf: "stretch", marginHorizontal: space.sm },
  ctaTxt: { fontFamily: font.bold, fontSize: 16, color: colors.onAccent, letterSpacing: 0.2 },
  altRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: space.xl },
  altTxt: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft },
  altLink: { fontFamily: font.bold, fontSize: 14, color: colors.accentInk },
});
