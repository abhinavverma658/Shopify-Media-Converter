// web/backend/db/jobsDb.js
// Uses lowdb (pure JS, no native compilation needed — works on Windows without Visual Studio)
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "../../../jobs.json");

// Singleton db instance
let db;

async function getDb() {
  if (!db) {
    const adapter = new JSONFile(DB_PATH);
    db = new Low(adapter, { batches: [], jobs: [] });
    await db.read();
    // Ensure default structure exists
    db.data ||= { batches: [], jobs: [] };
    db.data.batches ||= [];
    db.data.jobs ||= [];
  }
  return db;
}

function now() {
  return new Date().toISOString();
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export async function createBatch(shop, totalJobs, settings = {}) {
  const db = await getDb();
  const id = uuidv4();
  db.data.batches.push({
    id,
    shop,
    status: "running",
    total_jobs: totalJobs,
    completed_jobs: 0,
    failed_jobs: 0,
    settings: JSON.stringify(settings),
    created_at: now(),
    updated_at: now(),
  });
  await db.write();
  return id;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function createJob(data) {
  const db = await getDb();
  const id = uuidv4();
  db.data.jobs.push({
    id,
    batch_id: data.batchId,
    shop: data.shop,
    type: data.type,
    status: "queued",
    product_id: data.productId,
    product_title: data.productTitle,
    image_id: data.imageId || null,
    source_url: data.sourceUrl,
    output_url: null,
    original_size: null,
    converted_size: null,
    saved_bytes: null,
    compression_ratio: null,
    progress: 0,
    error: null,
    queue_job_id: null,
    created_at: now(),
    updated_at: now(),
  });
  await db.write();
  return id;
}

export async function updateJobStatus(jobId, status, extra = {}) {
  const db = await getDb();
  const job = db.data.jobs.find((j) => j.id === jobId);
  if (!job) return;

  job.status = status;
  job.updated_at = now();

  if (extra.progress !== undefined) job.progress = extra.progress;
  if (extra.outputUrl) job.output_url = extra.outputUrl;
  if (extra.savedBytes !== undefined) job.saved_bytes = extra.savedBytes;
  if (extra.error) job.error = extra.error;
  if (extra.queueJobId) job.queue_job_id = String(extra.queueJobId);

  // Update batch counters
  if (status === "completed" || status === "failed") {
    const batch = db.data.batches.find((b) => b.id === job.batch_id);
    if (batch) {
      if (status === "completed") batch.completed_jobs += 1;
      else batch.failed_jobs += 1;
      batch.updated_at = now();
    }
  }

  await db.write();
}

export async function getJobById(jobId) {
  const db = await getDb();
  return db.data.jobs.find((j) => j.id === jobId) || null;
}

export async function getBatchStats(batchId) {
  const db = await getDb();
  const batch = db.data.batches.find((b) => b.id === batchId) || null;
  const jobs = db.data.jobs.filter((j) => j.batch_id === batchId);
  return { batch, jobs };
}

export async function getRecentBatches(shop, limit = 10) {
  const db = await getDb();
  const shopBatches = db.data.batches
    .filter((b) => b.shop === shop)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);

  return shopBatches.map((batch) => {
    const jobs = db.data.jobs.filter((j) => j.batch_id === batch.id && j.status === "completed");
    const total_saved_bytes = jobs.reduce((sum, j) => sum + (j.saved_bytes || 0), 0);
    const done_count = jobs.length;
    return { ...batch, total_saved_bytes, done_count };
  });
}

export async function getShopStats(shop) {
  const db = await getDb();
  const jobs = db.data.jobs.filter((j) => j.shop === shop);
  const completed = jobs.filter((j) => j.status === "completed");

  const total_converted = completed.length;
  const total_saved_bytes = completed.reduce((s, j) => s + (j.saved_bytes || 0), 0);
  const images_converted = completed.filter((j) => j.type === "image").length;
  const videos_converted = completed.filter((j) => j.type === "video").length;
  const compressions = completed.map((j) => j.compression_ratio).filter(Boolean);
  const avg_compression = compressions.length
    ? compressions.reduce((a, b) => a + b, 0) / compressions.length
    : 0;

  return { total_converted, total_saved_bytes, images_converted, videos_converted, avg_compression };
}
