# 🖼️ Shopify Media Converter

Bulk convert **200+ product images** (JPG/PNG → WebP) and **videos** (MP4 → WebM) directly in your Shopify store. Integrated background processing, live progress tracking, and automatic product image replacement.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Bulk Image Conversion** | JPG/PNG → WebP with Sharp (lossless/lossy, ~75–90% smaller) |
| **Bulk Video Conversion** | MP4 → WebM with FFmpeg VP9 + Opus codec |
| **Background Queue** | Bull + Redis — process 200+ files without timeouts |
| **Auto-Update Products** | Converted files uploaded to Shopify Files API & linked back |
| **Quality Presets** | High / Balanced / Max Compress |
| **Live Progress** | Real-time per-file progress bars, job status |
| **Savings Tracker** | See exactly how much storage & bandwidth is saved |
| **Pagination Support** | Handles Shopify cursor-based pagination for large stores |

---

## 🏗️ Architecture

```
shopify-media-converter/
├── shopify.app.toml          # Shopify CLI config
├── web/
│   ├── backend/
│   │   ├── index.js          # Express server + Shopify auth
│   │   ├── routes/
│   │   │   ├── conversion.js # Scan, start, batch status endpoints
│   │   │   └── products.js   # Product listing with media
│   │   ├── queue/
│   │   │   └── conversionQueue.js  # Bull queue, Sharp + FFmpeg workers
│   │   ├── services/
│   │   │   └── shopifyService.js   # Shopify API (REST + GraphQL)
│   │   └── db/
│   │       └── jobsDb.js     # SQLite job tracking
│   └── frontend/
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.jsx   # Stats overview
│           │   ├── ConvertPage.jsx # Scan + start conversion
│           │   └── HistoryPage.jsx # Past runs
│           └── components/
│               └── Sidebar.jsx
└── .env.example
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Redis** (for the job queue)
- **FFmpeg** installed system-wide
- **Shopify Partner account** + app created

### 1. Clone & Install

```bash
git clone <repo>
cd shopify-media-converter
cp .env.example .env
# Fill in your SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST
```

### 2. Install Dependencies

```bash
# Root
npm install

# Backend
cd web && npm install

# Frontend
cd web/frontend && npm install
```

### 3. Install System Dependencies

```bash
# FFmpeg (required for video conversion)
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Redis (required for job queue)
# macOS
brew install redis && brew services start redis

# Ubuntu
sudo apt install redis-server && sudo systemctl start redis
```

### 4. Start Development

```bash
# Option A: Shopify CLI (recommended)
npm run dev

# Option B: Manual
cd web && npm run dev
cd web/frontend && npm run dev
```

The Shopify CLI will:
- Start your backend on port 3000
- Start the frontend dev server on port 3001
- Create an ngrok tunnel automatically
- Open your dev store for installation

---

## 🔧 Configuration

### Conversion Quality Presets

| Preset | WebP Quality | VP9 CRF | Typical Size Reduction |
|---|---|---|---|
| High | 85 | 28 | ~65–75% |
| Balanced (default) | 80 | 33 | ~75–82% |
| Max Compress | 70 | 38 | ~85–92% |

### Queue Concurrency

Edit `web/backend/queue/conversionQueue.js`:

```js
conversionQueue.process("image", 5, processImageJob); // 5 concurrent
conversionQueue.process("video", 2, processVideoJob); // 2 concurrent
```

Increase `image` concurrency for faster processing on capable servers.

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/conversion/scan` | GET | Scan all products for convertible media |
| `/api/conversion/start` | POST | Start a bulk conversion batch |
| `/api/conversion/batch/:id` | GET | Get batch progress & job details |
| `/api/conversion/history` | GET | List recent batches for this shop |
| `/api/conversion/stats` | GET | Aggregate lifetime stats |
| `/api/conversion/queue-stats` | GET | Live queue counters |
| `/api/products` | GET | List products with image metadata |
| `/api/products/:id/media` | GET | Get video media for a product |

### Start Conversion Request Body

```json
{
  "items": [
    {
      "type": "image",
      "productId": "123456",
      "productTitle": "Blue T-Shirt",
      "imageId": "789",
      "sourceUrl": "https://cdn.shopify.com/..."
    }
  ],
  "quality": "balanced",
  "convertImages": true,
  "convertVideos": true
}
```

---

## 🛡️ Shopify Permissions Required

```
read_products    - Fetch product & image data
write_products   - Update product image URLs
read_files       - Access Shopify Files API
write_files      - Upload converted files
```

---

## 🚀 Deployment

### Deploy to Fly.io

```bash
fly launch
fly secrets set SHOPIFY_API_KEY=xxx SHOPIFY_API_SECRET=xxx REDIS_URL=redis://...
fly deploy
```

### Deploy to Railway

1. Connect your GitHub repo
2. Add `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `REDIS_URL` env vars
3. Add a Redis plugin
4. Deploy

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a managed Redis (Railway, Upstash, Redis Cloud)
- [ ] Set `HOST` to your production URL in `.env`
- [ ] Update `shopify.app.toml` with production URLs
- [ ] Run `shopify app deploy` to push to Shopify Partners

---

## 🧪 Testing Conversion Locally

Without a real Shopify store, you can test the conversion core directly:

```bash
node -e "
const sharp = require('sharp');
sharp('test.jpg').webp({ quality: 80 }).toFile('out.webp').then(i => console.log(i));
"
```

```bash
ffmpeg -i test.mp4 -c:v libvpx-vp9 -crf 33 -b:v 0 -c:a libopus out.webm
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, `@shopify/shopify-app-express` |
| Image Processing | **Sharp** (libvips) |
| Video Processing | **FFmpeg** (VP9/libopus) |
| Job Queue | **Bull** + **Redis** |
| Database | SQLite (via better-sqlite3) |
| Frontend | React 18, Vite |
| Shopify | REST Admin API 2024-01, GraphQL Files API |

---

## 🤝 Contributing

PRs welcome! Areas for improvement:

- [ ] WebP animated image support (GIF → WebP)
- [ ] AVIF output option
- [ ] Email notifications on batch completion
- [ ] Retry UI for failed jobs
- [ ] Per-product conversion exclusions
