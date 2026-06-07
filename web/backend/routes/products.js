// web/backend/routes/products.js
import express from "express";
import { fetchAllProductsWithMedia, fetchProductMedia } from "../services/shopifyService.js";

const router = express.Router();

// GET /api/products — List all products with media info
router.get("/", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const products = await fetchAllProductsWithMedia(session.shop, session.accessToken);

    // Enrich with media summary
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

// GET /api/products/:id/media — Get video media for a product
router.get("/:id/media", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const media = await fetchProductMedia(session.shop, session.accessToken, req.params.id);
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
