import { Tabs } from "expo-router";
import { TabBar } from "@/components/TabBar";

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="shop" />
      <Tabs.Screen name="wishlist" />
      <Tabs.Screen name="cart" />
    </Tabs>
  );
}
