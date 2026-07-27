// src/api/scanAPI.js
// FIXED: renamed from ScanAPI.js → scanAPI.js (matches Dashboard import)
// ADDED: deleteScan, reportURL, fetchScanById
import api from "./axiosInstance";

// ── GET /api/history/ ─────────────────────────────────────────────────────────
export async function fetchHistory({ status, search, sort, page, page_size } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status",    status);
  if (search)                     params.append("search",    search);
  if (sort)                       params.append("sort",      sort);
  if (page)                       params.append("page",      page);
  if (page_size)                  params.append("page_size", page_size);
  const { data } = await api.get(`/history/?${params.toString()}`);
  return data; // { results, total, page, page_size, total_pages }
}

// ── GET /api/stats/ ───────────────────────────────────────────────────────────
export async function fetchStats() {
  const { data } = await api.get("/stats/");
  return data; // { total, phishing, suspicious, safe, threat_count }
}

// ── GET /api/analytics/ ───────────────────────────────────────────────────────
export async function fetchAnalytics() {
  const { data } = await api.get("/analytics/");
  return data; // { daily, by_verdict, score_dist, top_threats, summary }
}

// ── POST /api/scan/ ───────────────────────────────────────────────────────────
export async function scanURL(url) {
  const { data } = await api.post("/scan/", { url });
  return data;
}

// ── DELETE /api/scan/<id>/delete/ ─────────────────────────────────────────────
// EASY WIN 1: wired to delete button in History.jsx
export async function deleteScan(id) {
  const { data } = await api.delete(`/scan/${id}/delete/`);
  return data; // { deleted: true }
}

// ── POST /api/reports/ ────────────────────────────────────────────────────────
// EASY WIN 3: wired to Report URL button in Dashboard.jsx
export async function reportURL(urlId, description) {
  const { data } = await api.post("/reports/", {
    url_id:      urlId,
    description: description.trim(),
  });
  return data; // { id, url, url_text, reported_by, description, status, ... }
}

// ── GET /api/history/ with large page for CSV export ─────────────────────────
// EASY WIN 2: fetches all scans for CSV download
export async function fetchAllScans() {
  const { data } = await api.get("/history/?page=1&page_size=1000&sort=newest");
  return data.results || [];
}