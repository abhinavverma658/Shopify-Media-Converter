// web/backend/index.js
import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { ApiVersion } from "@shopify/shopify-api";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import conversionRouter from "./routes/conversion.js";
import productsRouter from "./routes/products.js";
import webhookRouter from "./routes/webhooks.js";
import { setupQueue } from "./queue/conversionQueue.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const STATIC_PATH = path.join(__dirname, "../frontend/dist");

// Validate required env vars
const required = ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "HOST"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

console.log("✅ Env vars OK");
console.log(`   HOST: ${process.env.HOST}`);
console.log(`   PORT: ${PORT}`);

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    appUrl: process.env.HOST,
    apiVersion: ApiVersion.October24,
    scopes: ["read_products", "write_products", "read_files", "write_files"],
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: new MemorySessionStorage(),
});

const app = express();
app.use(cors());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Shopify auth
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

// Webhooks
app.post(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  shopify.processWebhooks({ webhookHandlers: {} })
);

app.use(express.json());

// Protected API routes
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use("/api/conversion", conversionRouter);
app.use("/api/products", productsRouter);
app.use("/api/webhooks-manage", webhookRouter);

// Serve frontend
app.use(shopify.cspHeaders());
app.use(express.static(STATIC_PATH, { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  res.sendFile(path.join(STATIC_PATH, "index.html"));
});

// Queue
try {
  setupQueue();
  console.log("✅ Queue ready");
} catch (err) {
  console.warn("⚠️ Queue setup failed:", err.message);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
