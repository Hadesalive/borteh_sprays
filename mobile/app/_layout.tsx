import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts,
} from "@expo-google-fonts/archivo";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NotificationsLive } from "@/components/NotificationsLive";
import { NotificationToast } from "@/components/NotificationToast";
import { QuickPeek } from "@/components/QuickPeek";
import { initPush } from "@/lib/push";
import { initTracking } from "@/lib/track";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const [loaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Boot the event pipeline + push once: queue hydration, flush timer, silent
  // push-token refresh (never prompts), and notification tap routing.
  useEffect(() => {
    initTracking();
    initPush();
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAF8F5" } }}>
          <Stack.Screen name="filter" options={{ presentation: "transparentModal", animation: "fade" }} />
          <Stack.Screen name="review" options={{ presentation: "modal" }} />
        </Stack>
        <QuickPeek />
        <NotificationsLive />
        <NotificationToast />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
