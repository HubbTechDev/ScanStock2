import React from "react";
import { View, ViewProps } from "react-native";
import { colors } from "./Screen";

export function Card({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
        },
        style,
      ]}
    />
  );
}
