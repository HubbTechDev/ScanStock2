import React from "react";
import { Stack } from "expo-router";
import { SidebarProvider } from "@/lib/sidebarContext";

export default function RootLayout() {
  return (
    <SidebarProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SidebarProvider>
  );
}
