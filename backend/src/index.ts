import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";

import { auth } from "./auth";
import { env } from "./env";
import { uploadRouter } from "./routes/upload";
import { sampleRouter } from "./routes/sample";
import { inventoryRouter } from "./routes/inventory";
import { importRouter } from "./routes/import";
import { organizationRouter } from "./routes/organization";
import { prepItemsRouter } from "./routes/prep-items";
import { cycleCountsRouter } from "./routes/cycle-counts";
import { vendorsRouter } from "./routes/vendors";
import { ordersRouter } from "./routes/orders";
import remindersRouter from "./routes/reminders";
import { type AppType } from "./types";
import { db } from "./db";

// AppType context adds user and session to the context, will be null if the user or session is null
const app = new Hono<AppType>();

console.log("🔧 Initializing Hono application...");
app.use("*", logger());
app.use(
  "/*",
  cors({
    origin: (origin) => origin || "*", // Allow the requesting origin or fallback to *
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "expo-origin"], // expo-origin is required for Better Auth Expo plugin
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

/** Authentication middleware
 * Extracts session from request headers and attaches user/session to context
 * All routes can access c.get("user") and c.get("session")
 */
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null); // type: typeof auth.$Infer.Session.user | null
  c.set("session", session?.session ?? null); // type: typeof auth.$Infer.Session.session | null
  return next();
});

// Better Auth handler
// Handles all authentication endpoints: /api/auth/sign-in, /api/auth/sign-up, etc.
console.log("🔐 Mounting Better Auth handler at /api/auth/*");
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  const request = c.req.raw;
  // Workaround for Expo/React Native: native apps don't send Origin header,
  // but the expo client plugin sends expo-origin instead. We need to create
  // a new request with the origin header set from expo-origin.
  const expoOrigin = request.headers.get("expo-origin");
  if (!request.headers.get("origin") && expoOrigin) {
    const headers = new Headers(request.headers);
    headers.set("origin", expoOrigin);
    const modifiedRequest = new Request(request, { headers });
    return auth.handler(modifiedRequest);
  }
  return auth.handler(request);
});

// Serve uploaded images statically
// Files in uploads/ directory are accessible at /uploads/* URLs
console.log("📁 Serving static files from uploads/ directory");
app.use("/uploads/*", serveStatic({ root: "./" }));

// Mount route modules
console.log("📤 Mounting upload routes at /api/upload");
app.route("/api/upload", uploadRouter);

console.log("📝 Mounting sample routes at /api/sample");
app.route("/api/sample", sampleRouter);

console.log("📦 Mounting inventory routes at /api/inventory");
app.route("/api/inventory", inventoryRouter);

console.log("📥 Mounting import routes at /api/import");
app.route("/api/import", importRouter);

console.log("🔔 Mounting reminders routes at /api/reminders");
app.route("/api/reminders", remindersRouter);

console.log("🏢 Mounting organization routes at /api/organization");
app.route("/api/organization", organizationRouter);

console.log("📋 Mounting prep items routes at /api/prep-items");
app.route("/api/prep-items", prepItemsRouter);

console.log("📊 Mounting cycle counts routes at /api/cycle-counts");
app.route("/api/cycle-counts", cycleCountsRouter);

console.log("🏪 Mounting vendors routes at /api/vendors");
app.route("/api/vendors", vendorsRouter);

console.log("📋 Mounting orders routes at /api/orders");
app.route("/api/orders", ordersRouter);

// Health check endpoint
// Used by load balancers and monitoring tools to verify service is running
app.get("/health", (c) => {
  console.log("💚 Health check requested");
  return c.json({ status: "ok" });
});

// Start the server
console.log("⚙️  Starting server...");
const server = serve({ fetch: app.fetch, port: Number(env.PORT) }, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🚀 Server is running on port ${env.PORT}`);
  console.log(`🔗 Base URL: http://localhost:${env.PORT}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📚 Available endpoints:");
  console.log("  🔐 Auth:     /api/auth/*");
  console.log("  📤 Upload:   POST /api/upload/image");
  console.log("  📝 Sample:   GET/POST /api/sample");
  console.log("  💚 Health:   GET /health");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down server...");
  await db.$disconnect();
  await db.$connect();
  await db.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  await db.$disconnect();
  console.log("Successfully shutdown server");
  server.close();
  process.exit(0);
};

// Handle SIGINT (ctrl+c).
process.on("SIGINT", async () => {
  console.log("SIGINT received. Cleaning up...");
  await shutdown();
});

// Handle SIGTERM (normal shutdown).
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Cleaning up...");
  await shutdown();
});
