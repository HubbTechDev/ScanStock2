import React from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

// 👇 import this from wherever your sidebar provider lives
import { SidebarProvider } from "@/components/ui/sidebar"; 
// If that path errors, tell me and I’ll fix it.

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SidebarProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
