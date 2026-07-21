import { StyleSheet, View } from "react-native";
import { colors, font } from "@/lib/theme";
import { Guilloche } from "./Guilloche";
import { AppText } from "./Text";

// A small engraved roundel — the maison's guilloche on an ink ground with a serif monogram, the
// same texture as the loyalty card at a size where the line-work actually reads. A letterhead
// mark for auth and other "front door" screens, so they feel pressed rather than templated.
export function EngravedCrest({ size = 76, letter = "B" }: { size?: number; letter?: string }) {
  return (
    <View style={[s.crest, { width: size, height: size, borderRadius: size / 2 }]}>
      <Guilloche
        w={size}
        h={size}
        origin="topRight"
        ringGap={8}
        start={4}
        base="rgba(250,248,245,0.14)"
        accent="rgba(138,83,39,0.55)"
      />
      <AppText style={[s.letter, { fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5) }]} maxFontSizeMultiplier={1}>
        {letter}
      </AppText>
    </View>
  );
}

const s = StyleSheet.create({
  crest: {
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,245,0.2)",
  },
  letter: { fontFamily: font.serif, color: colors.paper },
});
