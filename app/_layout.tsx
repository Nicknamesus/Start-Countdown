// Expo Router version — place these two files under the `app/` directory
// 1) app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useColorScheme, Platform } from "react-native";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";

export default function RootLayout() {
  // Force dark theme; if you prefer to follow system, swap to const scheme = useColorScheme();
  const scheme: "dark" = "dark";
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.select({
            ios: "default",
            android: "fade_from_bottom",
          }),
          contentStyle: { backgroundColor: "#0B0F14" },
        }}
      />
    </ThemeProvider>
  );
}
