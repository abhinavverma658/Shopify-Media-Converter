import React, { useState, useEffect } from "react";
import "./Dashboard.css";

function StatCard({ label, value, sub, color = "accent", icon }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [s, q] = await Promise.all([
          fetch("/api/conversion/stats").then((r) => r.json()),
          fetch("/api/conversion/queue-stats").then((r) => r.json()),
        ]);
        if (s.success) setStats(s.data);
        if (q.success) setQueueStats(q.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Bulk convert Shopify product images & videos to modern formats</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("convert")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          Start Converting
        </button>
      </header>

      {/* Format explainer */}
      <div className="format-cards">
        <div className="format-card">
          <div className="format-header">
            <span className="format-label from">Input Formats</span>
          </div>
          <div className="format-types">
            <span className="ftype jpg">.JPG</span>
            <span className="ftype png">.PNG</span>
            <span className="ftype mp4">.MP4</span>
          </div>
        </div>
        <div className="format-arrow">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span className="format-arrow-label">converted to</span>
        </div>
        <div className="format-card format-card--output">
          <div className="format-header">
            <span className="format-label to">Output Formats</span>
          </div>
          <div className="format-types">
            <span className="ftype webp">.WebP</span>
            <span className="ftype webm">.WebM</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Converted"
          value={loading ? "—" : (stats?.total_converted || 0).toLocaleString()}
          sub="files processed"
          color="accent"
          icon="◈"
        />
        <StatCard
          label="Storage Saved"
          value={loading ? "—" : formatBytes(stats?.total_saved_bytes)}
          sub="bandwidth reduction"
          color="success"
          icon="▽"
        />
        <StatCard
          label="Images"
          value={loading ? "—" : (stats?.images_converted || 0).toLocaleString()}
          sub="JPG/PNG → WebP"
          color="blue"
          icon="◫"
        />
        <StatCard
          label="Videos"
          value={loading ? "—" : (stats?.videos_converted || 0).toLocaleString()}
          sub="MP4 → WebM"
          color="purple"
          icon="▷"
        />
        <StatCard
          label="Avg. Compression"
          value={loading ? "—" : `${(stats?.avg_compression || 0).toFixed(1)}%`}
          sub="size reduction"
          color="orange"
          icon="⊛"
        />
      </div>

      {/* Live queue status */}
      {queueStats?.available && (
        <div className="queue-panel">
          <h3 className="section-title">
            <span className="pulse-dot" />
            Live Queue
          </h3>
          <div className="queue-stats">
            <div className="queue-stat">
              <span className="qs-num">{queueStats.waiting}</span>
              <span className="qs-label">waiting</span>
            </div>
            <div className="queue-stat qs-active">
              <span className="qs-num">{queueStats.active}</span>
              <span className="qs-label">active</span>
            </div>
            <div className="queue-stat qs-done">
              <span className="qs-num">{queueStats.completed}</span>
              <span className="qs-label">done</span>
            </div>
            <div className="queue-stat qs-failed">
              <span className="qs-num">{queueStats.failed}</span>
              <span className="qs-label">failed</span>
            </div>
          </div>
        </div>
      )}

      {/* Feature highlights */}
      <div className="features-grid">
        {[
          { icon: "⚡", title: "Bulk Processing", desc: "Convert 200+ product images simultaneously with parallel processing queues" },
          { icon: "🎯", title: "Smart Quality", desc: "Choose high, balanced, or low quality presets to control file size vs clarity" },
          { icon: "🔄", title: "Auto-Update", desc: "Converted files are automatically uploaded and linked to your Shopify products" },
          { icon: "📊", title: "Savings Tracker", desc: "Track exactly how much storage and bandwidth you're saving per conversion run" },
        ].map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h4 className="feature-title">{f.title}</h4>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
