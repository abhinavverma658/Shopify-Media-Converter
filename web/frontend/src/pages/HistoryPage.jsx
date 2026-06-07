import React, { useState, useEffect } from "react";
import "./HistoryPage.css";

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function formatDate(dt) {
  return new Date(dt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function BatchRow({ batch, onExpand, expanded }) {
  const done = batch.completed_jobs || 0;
  const failed = (batch.total_jobs || 0) - done;
  const pct = batch.total_jobs > 0 ? Math.round((done / batch.total_jobs) * 100) : 0;
  const settings = batch.settings ? JSON.parse(batch.settings) : {};

  return (
    <div className={`batch-row ${expanded ? "expanded" : ""}`}>
      <div className="batch-main" onClick={onExpand}>
        <div className="batch-status-dot" data-status={done === batch.total_jobs ? "done" : "partial"} />
        <div className="batch-info">
          <span className="batch-date">{formatDate(batch.created_at)}</span>
          <span className="batch-detail">{batch.total_jobs} files · {settings.quality || "balanced"} quality</span>
        </div>
        <div className="batch-progress-mini">
          <div className="bpm-bar">
            <div className="bpm-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="bpm-pct">{pct}%</span>
        </div>
        <div className="batch-stats">
          <span className="bs-done">{done} ✓</span>
          {failed > 0 && <span className="bs-fail">{failed} ✗</span>}
        </div>
        <div className="batch-saved">{formatBytes(batch.total_saved_bytes)}</div>
        <div className="batch-chevron">{expanded ? "▲" : "▼"}</div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [h, s] = await Promise.all([
          fetch("/api/conversion/history").then((r) => r.json()),
          fetch("/api/conversion/stats").then((r) => r.json()),
        ]);
        if (h.success) setBatches(h.data);
        if (s.success) setStats(s.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="history-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">All previous conversion runs and their results</p>
        </div>
      </header>

      {stats && (
        <div className="history-stats">
          <div className="hs-card">
            <span className="hs-value">{(stats.total_converted || 0).toLocaleString()}</span>
            <span className="hs-label">Total files converted</span>
          </div>
          <div className="hs-card hs-card--green">
            <span className="hs-value">{formatBytes(stats.total_saved_bytes)}</span>
            <span className="hs-label">Total storage saved</span>
          </div>
          <div className="hs-card">
            <span className="hs-value">{stats.images_converted || 0}</span>
            <span className="hs-label">Images (JPG/PNG → WebP)</span>
          </div>
          <div className="hs-card">
            <span className="hs-value">{stats.videos_converted || 0}</span>
            <span className="hs-label">Videos (MP4 → WebM)</span>
          </div>
          <div className="hs-card">
            <span className="hs-value">{(stats.avg_compression || 0).toFixed(1)}%</span>
            <span className="hs-label">Avg. size reduction</span>
          </div>
        </div>
      )}

      <div className="history-table">
        <div className="table-header">
          <span>Run</span>
          <span>Progress</span>
          <span>Results</span>
          <span>Saved</span>
          <span />
        </div>

        {loading ? (
          <div className="history-empty">Loading history...</div>
        ) : batches.length === 0 ? (
          <div className="history-empty">
            <span style={{ fontSize: 40 }}>◷</span>
            <p>No conversion runs yet. Start converting your media to see history here.</p>
          </div>
        ) : (
          batches.map((b) => (
            <BatchRow
              key={b.id}
              batch={b}
              expanded={expanded === b.id}
              onExpand={() => setExpanded(expanded === b.id ? null : b.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
