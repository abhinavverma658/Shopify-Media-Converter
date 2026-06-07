import React, { useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import ConvertPage from "./pages/ConvertPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import Sidebar from "./components/Sidebar.jsx";
import "./App.css";

export default function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="app-main">
        {page === "dashboard" && <Dashboard onNavigate={setPage} />}
        {page === "convert" && <ConvertPage />}
        {page === "history" && <HistoryPage />}
      </main>
    </div>
  );
}
