import { Component, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/Button";
import { AppText } from "@/components/Text";
import { lightColors, space } from "@/lib/theme";

/**
 * Last line of defence around the whole app.
 *
 * Without it, a render error anywhere unmounts the tree and leaves a blank
 * screen — which is both a bad experience and one of the most common reasons
 * App Review fails a build (Guideline 2.1). "Try again" remounts the subtree,
 * which recovers anything transient (a bad response, a momentarily undefined
 * field) without the customer force-quitting.
 *
 * Deliberately a class component: React only supports error catching via
 * componentDidCatch/getDerivedStateFromError, which have no hook equivalent.
 * It also can't depend on ThemeProvider — the provider may be the thing that
 * failed — so it uses the light palette directly rather than theme context.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // No crash reporter is wired up; at least surface it in dev/device logs.
    console.warn("Unhandled render error", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.screen}>
        <AppText variant="heading" style={styles.title}>
          Something went wrong
        </AppText>
        <AppText variant="bodySoft" style={styles.body}>
          Sorry — that wasn&apos;t supposed to happen. Try again, and if it keeps happening, message us
          on WhatsApp and we&apos;ll sort it out.
        </AppText>
        <Button title="Try again" onPress={this.reset} full={false} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.gutter,
    backgroundColor: lightColors.paper,
  },
  title: { textAlign: "center" },
  body: { textAlign: "center", marginTop: space.sm, marginBottom: space["2xl"] },
});
