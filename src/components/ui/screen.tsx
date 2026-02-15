import React from "react";
import { View, ViewProps } from "react-native";

export const colors = {
  bg: "#0B1220",
  card: "#0F172A",
  border: "#1F2937",
  text: "#E5E7EB",
  muted: "#94A3B8",
  accent: "#10B981",
  danger: "#EF4444",
};

export function Screen({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          flex: 1,
          backgroundColor: colors.bg,
          padding: 16,
        },
        style,
      ]}
    />
  );
}
