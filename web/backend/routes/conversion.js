// web/backend/routes/conversion.js
import express from "express";
import { getQueue } from "../queue/conversionQueue.js";
import { scanProductsForConversion } from "../services/shopifyService.js";
import {
  createBatch,
  createJob,
  updateJobStatus,
  getBatchStats,
  getRecentBatches,
  getShopStats,
} from "../db/jobsDb.js";

const router = express.Router();

// GET /api/conversion/scan
router.get("/scan", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const summary = await scanProductsForConversion(session.shop, session.accessToken);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error("Scan error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/conversion/start
router.post("/start", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const {
      items = [],
      quality = "balanced",
      convertImages = true,
      convertVideos = true,
    } = req.body;

    if (!items.length) {
      return res.status(400).json({ success: false, error: "No items to convert" });
    }

    const queue = getQueue();
    if (!queue) {
      return res.status(503).json({ success: false, error: "Queue not available. Is Redis running?" });
    }

    const toProcess = items.filter(
      (i) => (i.type === "image" && convertImages) || (i.type === "video" && convertVideos)
    );

    const batchId = await createBatch(session.shop, toProcess.length, { quality, convertImages, convertVideos });

    const enqueuedJobs = [];
    for (const item of toProcess) {
      const jobId = await createJob({
        batchId,
        shop: session.shop,
        type: item.type,
        productId: item.productId,
        productTitle: item.productTitle,
        imageId: item.imageId,
        sourceUrl: item.sourceUrl,
      });

      const queueJob = await queue.add(
        item.type,
        {
          jobId,
          batchId,
          shop: session.shop,
          accessToken: session.accessToken,
          imageUrl: item.type === "image" ? item.sourceUrl : undefined,
          videoUrl: item.type === "video" ? item.sourceUrl : undefined,
          productId: item.productId,
          imageId: item.imageId,
          imageAlt: item.alt || "",
          imagePosition: item.position || 1,
          quality,
        },
        { priority: item.type === "image" ? 10 : 5 }
      );

      await updateJobStatus(jobId, "queued", { queueJobId: String(queueJob.id) });
      enqueuedJobs.push({ jobId, queueJobId: queueJob.id });
    }

    res.json({ success: true, batchId, totalJobs: toProcess.length, jobs: enqueuedJobs });
  } catch (err) {
    console.error("Start conversion error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/conversion/batch/:batchId
router.get("/batch/:batchId", async (req, res) => {
  try {
    const data = await getBatchStats(req.params.batchId);
    if (!data.batch) return res.status(404).json({ success: false, error: "Batch not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/conversion/history
router.get("/history", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const batches = await getRecentBatches(session.shop);
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/conversion/stats
router.get("/stats", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const stats = await getShopStats(session.shop);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/conversion/queue-stats
router.get("/queue-stats", async (req, res) => {
  try {
    const queue = getQueue();
    if (!queue) return res.json({ success: true, data: { available: false } });

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.json({ success: true, data: { available: true, waiting, active, completed, failed, delayed } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
