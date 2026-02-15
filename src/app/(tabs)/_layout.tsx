import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DARK_BG = "#0B1220";
const DARK_CARD = "#0F172A";
const DARK_BORDER = "#1F2937";
const TEXT = "#E5E7EB";
const MUTED = "#94A3B8";
const ACCENT = "#10B981";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: DARK_BG },
        headerTitleStyle: { color: TEXT, fontWeight: "700" },
        headerTintColor: TEXT,

        tabBarStyle: {
          backgroundColor: DARK_CARD,
          borderTopColor: DARK_BORDER,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="smart-scan"
        options={{
          title: "Smart Scan",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
