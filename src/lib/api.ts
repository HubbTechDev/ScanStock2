// src/lib/api.ts

import { BACKEND_URL } from "./config";

/**
 * Simple centralized API client
 * No vibecode dependency
 * No circular imports
 */

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
};

async function request<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const url = `${BACKEND_URL}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API ${response.status}: ${text}`);
    }

    // Handle empty response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    return response.text() as unknown as T;
  } catch (error: any) {
    console.log("[api.ts] Error:", error?.message || error);
    throw error;
  }
}

/**
 * Public API helpers
 */
export const api = {
  get: <T = any>(path: string) =>
    request<T>(path, { method: "GET" }),

  post: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body }),

  put: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "PUT", body }),

  patch: <T = any>(path: string, body?: any) =>
    request<T>(path, { method: "PATCH", body }),

  delete: <T = any>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export { BACKEND_URL };
