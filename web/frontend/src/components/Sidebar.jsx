import React from "react";
import "./Sidebar.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "convert", label: "Convert Media", icon: "⟳" },
  { id: "history", label: "History", icon: "◷" },
];

export default function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="logo-text">
          <span className="logo-name">MediaConvert</span>
          <span className="logo-tagline">for Shopify</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {currentPage === item.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="format-badge">
          <span className="badge-from">JPG/PNG/MP4</span>
          <span className="badge-arrow">→</span>
          <span className="badge-to">WebP/WebM</span>
        </div>
        <p className="sidebar-version">v1.0.0</p>
      </div>
    </aside>
  );
}
