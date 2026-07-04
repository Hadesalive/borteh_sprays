// Official brand logos are the brands' trademarked assets — you, as a stockist, can use the
// official files. Drop a transparent PNG (dark logo on transparent works best) into
// assets/brands/<slug>.png, then UNCOMMENT its line below. The brand tile shows the logo when
// present, otherwise a monogram + wordmark.
const LOGOS: Record<string, number> = {
  lattafa: require("../assets/brands/lattafa.png"),
  armaf: require("../assets/brands/armaf.png"),
  "maison-alhambra": require("../assets/brands/maison-alhambra.png"),
  "al-haramain": require("../assets/brands/al-haramain.png"),
  rasasi: require("../assets/brands/rasasi.png"),
  afnan: require("../assets/brands/afnan.png"),
  "swiss-arabian": require("../assets/brands/swiss-arabian.png"),
  "paris-corner": require("../assets/brands/paris-corner.png"),
  "ard-al-zaafaran": require("../assets/brands/ard-al-zaafaran.png"),
  "french-avenue": require("../assets/brands/french-avenue.png"),
};

export function brandLogo(slug: string): number | undefined {
  return LOGOS[slug];
}
