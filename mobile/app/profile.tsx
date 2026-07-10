import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BellRinging, Coins, Heart, Lightbulb, MegaphoneSimple, PencilSimple, Receipt, Sparkle, Ticket, Trophy, User, UsersThree, WhatsappLogo } from "phosphor-react-native";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { useLoyalty, useMyCoupons, useStorePhone } from "@/lib/account";
import { signOut, useAuthReady, useSession } from "@/lib/auth";
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

            <View>
              <ListRow icon={<Coins size={20} color={colors.ink} weight="regular" />} title="Points" value={String(loyalty?.points ?? 0)} onPress={() => router.push("/points")} />
              <ListRow icon={<Trophy size={20} color={colors.ink} weight="regular" />} title="Leaderboard" onPress={() => router.push("/leaderboard")} />
              <ListRow icon={<Receipt size={20} color={colors.ink} weight="regular" />} title="Orders" value={orderCount ? String(orderCount) : undefined} onPress={() => router.push("/orders")} />
              <ListRow icon={<Heart size={20} color={colors.ink} weight="regular" />} title="Saved fragrances" value={saved.length ? String(saved.length) : undefined} onPress={() => router.push("/wishlist")} />
              <ListRow icon={<Ticket size={20} color={colors.ink} weight="regular" />} title="Coupons" value={coupons?.length ? String(coupons.length) : undefined} onPress={() => router.push("/coupons")} />
              <ListRow icon={<MegaphoneSimple size={20} color={colors.ink} weight="regular" />} title="Notices" onPress={() => router.push("/notices")} />
              <ListRow icon={<UsersThree size={20} color={colors.ink} weight="regular" />} title="Invite friends" onPress={() => router.push("/invite")} />
              <ListRow icon={<Sparkle size={20} color={colors.ink} weight="regular" />} title="Scent preferences" onPress={() => router.push("/scent-preferences")} />
              <ListRow icon={<Lightbulb size={20} color={colors.ink} weight="regular" />} title="How to use Borteh" onPress={() => router.push("/tips")} />
              <ListRow icon={<BellRinging size={20} color={colors.ink} weight="regular" />} title="Notification settings" onPress={() => router.push("/preferences")} />
              <ListRow icon={<PencilSimple size={20} color={colors.ink} weight="regular" />} title="Edit profile" onPress={() => router.push("/edit-profile")} />
              {storePhone ? <ListRow icon={<WhatsappLogo size={20} color={colors.ink} weight="regular" />} title="Message us on WhatsApp" onPress={whatsapp} /> : null}
            </View>

            <Button
              title="Sign out"
              variant="secondary"
              tone="destructive"
              onPress={() => {
                Haptics.selectionAsync();
                signOut();
              }}
              style={{ marginTop: space["3xl"] }}
            />
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
  guest: { alignItems: "center", paddingTop: space["4xl"] },
  guestBody: { textAlign: "center", marginTop: space.sm, maxWidth: 300 },
  altRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl },
});
