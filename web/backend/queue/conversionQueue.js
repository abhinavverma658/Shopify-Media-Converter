// web/backend/queue/conversionQueue.js
import Bull from "bull";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { updateJobStatus } from "../db/jobsDb.js";
import { uploadFileToShopify, replaceProductImage } from "../services/shopifyService.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let conversionQueue;

export function setupQueue() {
  conversionQueue = new Bull("media-conversion", REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });

  conversionQueue.process("image", 5, processImageJob);
  conversionQueue.process("video", 2, processVideoJob);

  conversionQueue.on("completed", async (job, result) => {
    console.log(`✅ Job ${job.id} completed — saved ${result?.savedBytes} bytes`);
    await updateJobStatus(job.data.jobId, "completed", {
      outputUrl: result?.outputUrl,
      savedBytes: result?.savedBytes,
    });
  });

  conversionQueue.on("failed", async (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
    await updateJobStatus(job.data.jobId, "failed", { error: err.message });
  });

  console.log("📦 Conversion queue ready");
  return conversionQueue;
}

export function getQueue() {
  return conversionQueue;
}

// ─── Image Job: JPG/PNG → WebP, then auto-replace on Shopify ─────────────────
async function processImageJob(job) {
  const { imageUrl, productId, imageId, imageAlt, imagePosition, shop, accessToken, jobId, quality } = job.data;
  const tmpInput  = path.join(os.tmpdir(), `${uuidv4()}-input`);
  const tmpOutput = path.join(os.tmpdir(), `${uuidv4()}-output.webp`);

  try {
    job.progress(5);

    // 1. Download original image
    const download = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 30000 });
    fs.writeFileSync(tmpInput, download.data);
    const originalSize = download.data.byteLength;

    job.progress(25);

    // 2. Convert to WebP with Sharp
    const webpQuality = quality === "high" ? 85 : quality === "low" ? 65 : 75;
    await sharp(tmpInput)
      .webp({ quality: webpQuality, effort: 4 })
      .toFile(tmpOutput);

    job.progress(50);

    const convertedSize = fs.statSync(tmpOutput).size;
    const savedBytes    = originalSize - convertedSize;

    // 3. Upload WebP to Shopify CDN
    const filename   = `product-${productId}-${imageId}-${Date.now()}.webp`;
    const cdnUrl     = await uploadFileToShopify(shop, accessToken, tmpOutput, filename);

    job.progress(75);

    // 4. AUTO-REPLACE: create new WebP image on the product, delete old JPG/PNG
    //    The product in Shopify admin will now show the WebP automatically.
    const newImage = await replaceProductImage(shop, accessToken, productId, imageId, cdnUrl, {
      alt: imageAlt || "",
      position: imagePosition || 1,
    });

    job.progress(100);

    return {
      outputUrl: newImage?.src || cdnUrl,
      originalSize,
      convertedSize,
      savedBytes,
      compressionRatio: ((savedBytes / originalSize) * 100).toFixed(1),
    };
  } finally {
    for (const f of [tmpInput, tmpOutput]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

// ─── Video Job: MP4 → WebM, then auto-replace on Shopify ─────────────────────
async function processVideoJob(job) {
  const { videoUrl, productId, shop, accessToken, jobId, quality } = job.data;
  const tmpInput  = path.join(os.tmpdir(), `${uuidv4()}-input.mp4`);
  const tmpOutput = path.join(os.tmpdir(), `${uuidv4()}-output.webm`);

  try {
    job.progress(5);

    // 1. Download original video
    const download = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 120000 });
    fs.writeFileSync(tmpInput, download.data);
    const originalSize = download.data.byteLength;

    job.progress(10);

    // 2. Convert to WebM (VP9 + Opus)
    const crf = quality === "high" ? 28 : quality === "low" ? 38 : 33;
    await new Promise((resolve, reject) => {
      ffmpeg(tmpInput)
        .outputOptions([
          "-c:v libvpx-vp9",
          `-crf ${crf}`,
          "-b:v 0",
          "-c:a libopus",
          "-b:a 128k",
          "-row-mt 1",
          "-threads 4",
        ])
        .output(tmpOutput)
        .on("progress", (p) => job.progress(10 + Math.round((p.percent || 0) * 0.65)))
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    job.progress(80);

    const convertedSize = fs.statSync(tmpOutput).size;
    const savedBytes    = originalSize - convertedSize;

    // 3. Upload WebM to Shopify CDN
    const filename = `product-${productId}-video-${Date.now()}.webm`;
    const cdnUrl   = await uploadFileToShopify(shop, accessToken, tmpOutput, filename);

    // Note: Shopify video replacement via GraphQL productUpdateMedia would go here.
    // The WebM is uploaded and available in Files; full video swap requires
    // productDeleteMedia + productAppendMedia via GraphQL mutations.

    job.progress(100);

    return {
      outputUrl: cdnUrl,
      originalSize,
      convertedSize,
      savedBytes,
      compressionRatio: ((savedBytes / originalSize) * 100).toFixed(1),
    };
  } finally {
    for (const f of [tmpInput, tmpOutput]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}
