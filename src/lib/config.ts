// src/lib/config.ts
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_BASE ??
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ??
  "http://localhost:3334";