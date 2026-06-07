// web/backend/routes/products.js
import express from "express";
import axios from "axios";
import { fetchAllProductsWithMedia } from "../services/shopifyService.js";

const router = express.Router();

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const products = await fetchAllProductsWithMedia(session.shop, session.accessToken);

    const enriched = products.map((p) => ({
      id: p.id,
      title: p.title,
      imageCount: p.images?.length || 0,
      images: (p.images || []).map((img) => ({
        id: img.id,
        src: img.src,
        width: img.width,
        height: img.height,
        ext: img.src?.split("?")[0].split(".").pop()?.toLowerCase(),
      })),
    }));

    res.json({ success: true, data: enriched, total: enriched.length });
  } catch (err) {
    console.error("Products fetch error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id/media — fetch video media via GraphQL
router.get("/:id/media", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const query = `
      query GetProductMedia($id: ID!) {
        product(id: $id) {
          media(first: 20) {
            nodes {
              id
              mediaContentType
              status
              ... on Video {
                id
                sources { url mimeType fileSize }
                originalSource { url mimeType fileSize }
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      `https://${session.shop}/admin/api/2024-01/graphql.json`,
      { query, variables: { id: `gid://shopify/Product/${req.params.id}` } },
      { headers: { "X-Shopify-Access-Token": session.accessToken, "Content-Type": "application/json" } }
    );

    const media = response.data?.data?.product?.media?.nodes || [];
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
