import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BellRinging, Coins, Heart, Lightbulb, MegaphoneSimple, PencilSimple, Receipt, SignOut, Sparkle, Ticket, Trash, Trophy, User, UsersThree, WhatsappLogo } from "phosphor-react-native";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useLoyalty, useMyCoupons, useStorePhone } from "@/lib/account";
import { deleteAccount, signOut, useAuthReady, useSession } from "@/lib/auth";
import { useOrders } from "@/lib/orders";
import { useWishlist } from "@/lib/wishlist";
import { colors, font, space } from "@/lib/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const ready = useAuthReady();
  const { data: orders } = useOrders();
  const saved = useWishlist();
  const { data: loyalty } = useLoyalty();
  const { data: coupons } = useMyCoupons();
  const { data: storePhone } = useStorePhone();
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    Haptics.selectionAsync();
    // Two-tap destructive confirm (Apple 5.1.1(v)). RN Alert is the platform-native pattern.
    Alert.alert(
      "Delete account?",
      "This permanently deletes your Borteh account and personal details. Order records may be kept, without your name, for our records. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await deleteAccount();
              router.replace("/(tabs)");
            } catch {
              setDeleting(false);
              Alert.alert("Couldn't delete account", "Something went wrong. Please try again, or contact us on WhatsApp.");
            }
          },
        },
      ],
    );
  };

  const whatsapp = () => {
    if (!storePhone) return;
    Haptics.selectionAsync();
    Linking.openURL(`https://wa.me/${storePhone.replace(/[^\d]/g, "")}`).catch(() => {});
  };

  const name = (session?.user.user_metadata?.display_name as string) || "Your account";
  const phone = (session?.user.user_metadata?.phone as string) || "";
  const orderCount = orders?.length ?? 0;
  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => router.back()} />

        {!ready ? null : session ? (
          <>
            {/* the person IS the header — no "Account" label above them */}
            <View style={s.identity}>
              {/* monogram avatar — serif initial, the maison's mark for its member */}
              <View style={s.avatar}>
                <AppText style={s.avatarTxt} maxFontSizeMultiplier={1}>
                  {name.trim().charAt(0).toUpperCase() || "B"}
                </AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="heading" numberOfLines={1}>{name}</AppText>
                <AppText variant="bodySoft" numberOfLines={2} style={{ marginTop: space.xs }}>
                  {[phone, memberSince ? `member since ${memberSince}` : null].filter(Boolean).join(" · ")}
                </AppText>
              </View>
            </View>

            <View style={s.group}>
              <AppText variant="label" style={s.groupLabel}>Activity</AppText>
              <ListRow icon={<Receipt size={20} color={colors.ink} weight="regular" />} title="Orders" value={orderCount ? String(orderCount) : undefined} onPress={() => router.push("/orders")} />
              <ListRow icon={<Heart size={20} color={colors.ink} weight="regular" />} title="Saved fragrances" value={saved.length ? String(saved.length) : undefined} onPress={() => router.push("/wishlist")} />
              <ListRow icon={<Coins size={20} color={colors.ink} weight="regular" />} title="Points" value={String(loyalty?.points ?? 0)} onPress={() => router.push("/points")} />
              <ListRow icon={<Trophy size={20} color={colors.ink} weight="regular" />} title="Leaderboard" onPress={() => router.push("/leaderboard")} />
            </View>

            <View style={s.group}>
              <AppText variant="label" style={s.groupLabel}>Rewards</AppText>
              <ListRow icon={<Ticket size={20} color={colors.ink} weight="regular" />} title="Coupons" value={coupons?.length ? String(coupons.length) : undefined} onPress={() => router.push("/coupons")} />
              <ListRow icon={<UsersThree size={20} color={colors.ink} weight="regular" />} title="Invite friends" onPress={() => router.push("/invite")} />
            </View>

            <View style={s.group}>
              <AppText variant="label" style={s.groupLabel}>For you</AppText>
              <ListRow icon={<Sparkle size={20} color={colors.ink} weight="regular" />} title="Scent preferences" onPress={() => router.push("/scent-preferences")} />
              <ListRow icon={<MegaphoneSimple size={20} color={colors.ink} weight="regular" />} title="Notices" onPress={() => router.push("/notices")} />
            </View>

            <View style={s.group}>
              <AppText variant="label" style={s.groupLabel}>Settings</AppText>
              <ListRow icon={<BellRinging size={20} color={colors.ink} weight="regular" />} title="Notification settings" onPress={() => router.push("/preferences")} />
              <ListRow icon={<PencilSimple size={20} color={colors.ink} weight="regular" />} title="Edit profile" onPress={() => router.push("/edit-profile")} />
            </View>

            <View style={s.group}>
              <AppText variant="label" style={s.groupLabel}>Help</AppText>
              <ListRow icon={<Lightbulb size={20} color={colors.ink} weight="regular" />} title="How to use Borteh" onPress={() => router.push("/tips")} />
              {storePhone ? <ListRow icon={<WhatsappLogo size={20} color={colors.ink} weight="regular" />} title="Message us on WhatsApp" onPress={whatsapp} /> : null}
            </View>

            <View style={s.account}>
              <AppText variant="label" style={s.groupLabel}>Account</AppText>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); signOut(); }}
                style={s.acctBtn}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <SignOut size={18} color={colors.ink} weight="regular" />
                <AppText variant="label" style={{ color: colors.ink }}>Sign out</AppText>
              </Pressable>
              <Pressable
                onPress={deleting ? undefined : confirmDelete}
                style={[s.acctBtn, s.acctBtnDanger]}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <Trash size={18} color={colors.error} weight="regular" />
                <AppText variant="label" style={{ color: colors.error }}>{deleting ? "Deleting…" : "Delete account"}</AppText>
              </Pressable>
              <AppText variant="caption" style={s.acctNote}>
                Deleting is permanent — it removes your account and personal details.
              </AppText>
            </View>
          </>
        ) : (
          <View style={s.guest}>
            <User size={32} color={colors.ink40} weight="regular" />
            <AppText variant="display" style={{ textAlign: "center", marginTop: space.lg }}>Your account.</AppText>
            <AppText variant="bodySoft" style={s.guestBody}>Sign in to track orders and keep your delivery details.</AppText>
            <View style={{ alignSelf: "stretch", marginTop: space["2xl"] }}>
              <Button title="Sign in" onPress={() => router.push("/login")} />
            </View>
            <View style={s.altRow}>
              <AppText variant="bodySoft">New to Borteh?</AppText>
              <LinkLabel label="Create an account" onPress={() => router.push("/signup")} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  identity: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.lg, paddingBottom: space["2xl"], borderBottomWidth: 1, borderColor: colors.line },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontFamily: font.serif, fontSize: 30, lineHeight: 36, color: colors.paper },
  group: { marginTop: space["2xl"] },
  groupLabel: { color: colors.ink40, marginBottom: space.xs },
  account: { marginTop: space["3xl"], paddingTop: space.xl, borderTopWidth: 1, borderColor: colors.line, gap: space.md },
  acctBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, height: 52, borderWidth: 1, borderColor: colors.line },
  acctBtnDanger: { borderColor: "rgba(166,58,43,0.4)" },
  acctNote: { textAlign: "center", color: colors.ink40, marginTop: space.xs },
  guest: { alignItems: "center", paddingTop: space["4xl"] },
  guestBody: { textAlign: "center", marginTop: space.sm, maxWidth: 300 },
  altRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl },
});
