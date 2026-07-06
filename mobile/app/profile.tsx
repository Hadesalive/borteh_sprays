import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Heart, MegaphoneSimple, PencilSimple, Receipt, User } from "phosphor-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/Button";
import { ListRow } from "@/components/ListRow";
import { AppText } from "@/components/Text";
import { LinkLabel } from "@/components/ui";
import { signOut, useAuthReady, useSession } from "@/lib/auth";
import { useOrders } from "@/lib/orders";
import { useWishlist } from "@/lib/wishlist";
import { colors, space } from "@/lib/theme";

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
  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space["3xl"], paddingHorizontal: space.gutter }}>
        <BackButton onPress={() => router.back()} />
        <AppText variant="heading" style={{ marginTop: space.lg }}>Account</AppText>

        {!ready ? null : session ? (
          <>
            <View style={s.identity}>
              <AppText variant="display" numberOfLines={1}>{name}</AppText>
              <AppText variant="bodySoft" style={{ marginTop: space.xs }}>
                {[phone, memberSince ? `member since ${memberSince}` : null].filter(Boolean).join(" · ")}
              </AppText>
            </View>

            <View>
              <ListRow icon={<Receipt size={20} color={colors.ink} weight="regular" />} title="Orders" value={orderCount ? String(orderCount) : undefined} onPress={() => router.push("/orders")} />
              <ListRow icon={<Heart size={20} color={colors.ink} weight="regular" />} title="Saved fragrances" value={saved.length ? String(saved.length) : undefined} onPress={() => router.push("/wishlist")} />
              <ListRow icon={<MegaphoneSimple size={20} color={colors.ink} weight="regular" />} title="Notices" onPress={() => router.push("/notices")} />
              <ListRow icon={<PencilSimple size={20} color={colors.ink} weight="regular" />} title="Edit profile" onPress={() => router.push("/edit-profile")} />
            </View>

            <View style={{ marginTop: space["3xl"] }}>
              <LinkLabel label="Sign out" color={colors.error} onPress={() => { Haptics.selectionAsync(); signOut(); }} />
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
  identity: { marginTop: space["2xl"], paddingVertical: space["2xl"], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  guest: { alignItems: "center", paddingTop: space["4xl"] },
  guestBody: { textAlign: "center", marginTop: space.sm, maxWidth: 300 },
  altRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl },
});
