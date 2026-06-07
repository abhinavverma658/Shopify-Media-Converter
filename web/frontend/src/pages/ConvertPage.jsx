import React, { useState, useEffect, useRef } from "react";
import "./ConvertPage.css";

const QUALITY_OPTIONS = [
  { value: "high", label: "High Quality", desc: "~75% size reduction", badge: "best visual" },
  { value: "balanced", label: "Balanced", desc: "~82% size reduction", badge: "recommended" },
  { value: "low", label: "Max Compress", desc: "~90% size reduction", badge: "smallest size" },
];

function formatBytes(bytes) {
  if (!bytes) return "?";
  const units = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(0)} ${units[i]}`;
}

function ScanResult({ data, settings, onSettings, onStart, starting }) {
  const total = data.imagesToConvert.length + data.videosToConvert.length;
  return (
    <div className="scan-result">
      <div className="scan-summary">
        <div className="scan-badge">
          <span className="scan-num">{data.totalProducts}</span>
          <span className="scan-lbl">products scanned</span>
        </div>
        <div className="scan-badge scan-badge--images">
          <span className="scan-num">{data.imagesToConvert.length}</span>
          <span className="scan-lbl">images to convert</span>
        </div>
        <div className="scan-badge scan-badge--videos">
          <span className="scan-num">{data.videosToConvert.length}</span>
          <span className="scan-lbl">videos to convert</span>
        </div>
        <div className="scan-badge scan-badge--done">
          <span className="scan-num">{data.alreadyWebP}</span>
          <span className="scan-lbl">already WebP</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>✓</span>
          <h3>All media already optimized!</h3>
          <p>Your store's images and videos are already in modern formats.</p>
        </div>
      ) : (
        <>
          {/* Settings */}
          <div className="settings-panel">
            <h3 className="settings-title">Conversion Settings</h3>
            <div className="quality-grid">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  className={`quality-card ${settings.quality === q.value ? "selected" : ""}`}
                  onClick={() => onSettings({ ...settings, quality: q.value })}
                >
                  <span className="quality-badge">{q.badge}</span>
                  <span className="quality-label">{q.label}</span>
                  <span className="quality-desc">{q.desc}</span>
                </button>
              ))}
            </div>

            <div className="toggle-row">
              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Convert Images</span>
                  <span className="toggle-desc">JPG/PNG → WebP ({data.imagesToConvert.length} files)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.convertImages}
                  onChange={(e) => onSettings({ ...settings, convertImages: e.target.checked })}
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <span className="toggle-name">Convert Videos</span>
                  <span className="toggle-desc">MP4 → WebM ({data.videosToConvert.length} files)</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.convertVideos}
                  onChange={(e) => onSettings({ ...settings, convertVideos: e.target.checked })}
                />
              </label>
            </div>
          </div>

          {/* Image list preview */}
          {data.imagesToConvert.length > 0 && settings.convertImages && (
            <div className="media-list-panel">
              <div className="media-list-header">
                <h4>Images to Convert</h4>
                <span className="media-count">{data.imagesToConvert.length}</span>
              </div>
              <div className="media-list">
                {data.imagesToConvert.slice(0, 10).map((img, i) => (
                  <div key={i} className="media-item">
                    <img src={img.src} alt={img.productTitle} className="media-thumb" onError={(e) => e.target.style.display = "none"} />
                    <div className="media-info">
                      <span className="media-name">{img.productTitle}</span>
                      <span className="media-ext">.{img.ext} → .webp</span>
                    </div>
                    {img.width && <span className="media-size">{img.width}×{img.height}</span>}
                  </div>
                ))}
                {data.imagesToConvert.length > 10 && (
                  <div className="media-more">+{data.imagesToConvert.length - 10} more images</div>
                )}
              </div>
            </div>
          )}

          <button
            className="btn btn-start"
            disabled={starting || (!settings.convertImages && !settings.convertVideos)}
            onClick={onStart}
          >
            {starting ? (
              <><span className="spinner" /> Starting conversion...</>
            ) : (
              <><span>▶</span> Convert {total} file{total !== 1 ? "s" : ""}</>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function BatchProgress({ batchId, onDone }) {
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`/api/conversion/batch/${batchId}`);
        const json = await r.json();
        if (json.success) {
          setData(json.data);
          const { batch } = json.data;
          const done = batch.completed_jobs + batch.failed_jobs;
          if (done >= batch.total_jobs && batch.total_jobs > 0) {
            clearInterval(intervalRef.current);
            onDone();
          }
        }
      } catch (e) {}
    };
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [batchId]);

  if (!data) return <div className="loading-state">Loading batch status...</div>;

  const { batch, jobs = [] } = data;
  const progress = batch.total_jobs > 0 ? ((batch.completed_jobs + batch.failed_jobs) / batch.total_jobs) * 100 : 0;
  const totalSaved = jobs.reduce((s, j) => s + (j.saved_bytes || 0), 0);

  return (
    <div className="batch-progress">
      <div className="progress-header">
        <h3>Converting media...</h3>
        <span className="progress-pct">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-counters">
        <span className="pc-done">✓ {batch.completed_jobs} done</span>
        <span className="pc-total">of {batch.total_jobs}</span>
        {batch.failed_jobs > 0 && <span className="pc-failed">✗ {batch.failed_jobs} failed</span>}
        {totalSaved > 0 && <span className="pc-saved">↓ {formatBytes(totalSaved)} saved</span>}
      </div>

      {/* Active jobs */}
      <div className="active-jobs">
        {jobs.filter((j) => j.status === "processing").map((j) => (
          <div key={j.id} className="active-job">
            <span className="aj-spinner" />
            <span className="aj-name">{j.product_title}</span>
            <span className="aj-type">{j.type === "image" ? "→ .webp" : "→ .webm"}</span>
            <div className="aj-bar">
              <div className="aj-bar-fill" style={{ width: `${j.progress || 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConvertPage() {
  const [phase, setPhase] = useState("idle"); // idle | scanning | ready | starting | converting | done
  const [scanData, setScanData] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({ quality: "balanced", convertImages: true, convertVideos: true });

  const handleScan = async () => {
    setPhase("scanning");
    setError(null);
    try {
      const r = await fetch("/api/conversion/scan");
      const json = await r.json();
      if (!json.success) throw new Error(json.error);
      setScanData(json.data);
      setPhase("ready");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const handleStart = async () => {
    if (!scanData) return;
    setPhase("starting");
    setError(null);
    try {
      const items = [
        ...(settings.convertImages ? scanData.imagesToConvert.map((i) => ({ ...i, type: "image", sourceUrl: i.src })) : []),
        ...(settings.convertVideos ? scanData.videosToConvert.map((v) => ({ ...v, type: "video", sourceUrl: v.src })) : []),
      ];
      const r = await fetch("/api/conversion/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, ...settings }),
      });
      const json = await r.json();
      if (!json.success) throw new Error(json.error);
      setBatchId(json.batchId);
      setPhase("converting");
    } catch (e) {
      setError(e.message);
      setPhase("ready");
    }
  };

  return (
    <div className="convert-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Convert Media</h1>
          <p className="page-subtitle">Scan your store and bulk convert all product images and videos</p>
        </div>
        {(phase === "ready" || phase === "done") && (
          <button className="btn btn-secondary" onClick={() => { setPhase("idle"); setScanData(null); setBatchId(null); }}>
            ↺ Rescan
          </button>
        )}
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠</span> {error}
        </div>
      )}

      {phase === "idle" && (
        <div className="idle-state">
          <div className="idle-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <h2>Scan your store</h2>
          <p>We'll find all product images and videos that can be converted to modern formats</p>
          <button className="btn btn-primary btn-lg" onClick={handleScan}>
            Scan Store
          </button>
        </div>
      )}

      {phase === "scanning" && (
        <div className="scanning-state">
          <div className="scan-animation">
            <div className="scan-ring" />
            <div className="scan-ring scan-ring--2" />
            <div className="scan-ring scan-ring--3" />
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <h2>Scanning products...</h2>
          <p>Checking all product images and videos for conversion opportunities</p>
        </div>
      )}

      {(phase === "ready" || phase === "starting") && scanData && (
        <ScanResult
          data={scanData}
          settings={settings}
          onSettings={setSettings}
          onStart={handleStart}
          starting={phase === "starting"}
        />
      )}

      {phase === "converting" && batchId && (
        <BatchProgress batchId={batchId} onDone={() => setPhase("done")} />
      )}

      {phase === "done" && (
        <div className="done-state">
          <div className="done-icon">✓</div>
          <h2>Conversion Complete!</h2>
          <p>All files have been processed and updated in your Shopify store.</p>
          <button className="btn btn-primary" onClick={() => window.location.href = "?page=history"}>
            View History
          </button>
        </div>
      )}
    </div>
  );
}
