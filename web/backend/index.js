// web/backend/index.js
import "@shopify/shopify-api/adapters/node";
import { shopifyApp } from "@shopify/shopify-app-express";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
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

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);
const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? path.join(__dirname, "../frontend/dist")
    : path.join(__dirname, "../frontend");

const DB_PATH = path.join(__dirname, "../../database.sqlite");

const shopify = shopifyApp({
  api: {
    apiVersion: ApiVersion.January24,
    restResources: {},
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage: new SQLiteSessionStorage(DB_PATH),
});

const app = express();
app.use(cors());

// Shopify auth routes
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

// API Routes (protected)
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

// Setup background job queue
setupQueue();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
