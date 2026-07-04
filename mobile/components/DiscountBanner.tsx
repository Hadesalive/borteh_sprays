import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowRight } from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, font, radius, space } from "@/lib/theme";
import { AppText } from "./Text";

const SALE_BG = require("../assets/home/sale-bg.jpg");

/** Photo-led offer strip — shown only when products are actually on sale. */
export function DiscountBanner({ percent }: { percent: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/shop", params: { sale: "1" } })}
      style={({ pressed }) => [s.banner, pressed && { opacity: 0.96 }]}
      accessibilityRole="button"
      accessibilityLabel={`Up to ${percent} percent off, shop the sale`}
    >
      <Image source={SALE_BG} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={250} />
      <LinearGradient
        colors={["rgba(12,9,5,0.9)", "rgba(12,9,5,0.55)", "rgba(12,9,5,0.2)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.content}>
        <AppText style={s.kicker}>Limited offer</AppText>
        <AppText style={s.headline}>Up to {percent}% off</AppText>
        <View style={s.cta}>
          <AppText style={s.ctaTxt}>Shop the sale</AppText>
          <ArrowRight size={14} color="#FFFFFF" weight="bold" />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  banner: { height: 132, marginHorizontal: space.xl, borderRadius: radius.lg, overflow: "hidden", justifyContent: "center", backgroundColor: "#1A1411" },
  content: { paddingHorizontal: space.xl, gap: 5 },
  kicker: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(255,255,255,0.78)" },
  headline: { fontFamily: font.bold, fontSize: 24, lineHeight: 28, color: "#FFFFFF", letterSpacing: -0.4 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  ctaTxt: { fontFamily: font.semibold, fontSize: 13, color: "#FFFFFF" },
});
