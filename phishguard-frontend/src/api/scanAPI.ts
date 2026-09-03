// src/api/scanAPI.ts
import api from "./axiosInstance";

interface HistoryOptions {
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

function isGuestSession() {
  const hasToken = typeof localStorage !== "undefined" && Boolean(localStorage.getItem("pg_access"));
  const isExplicitGuest = typeof sessionStorage !== "undefined" && sessionStorage.getItem("pg_is_guest") === "true";
  return !hasToken || isExplicitGuest;
}

function getGuestHistory() {
  try {
    return JSON.parse(sessionStorage.getItem("pg_guest_history") || "[]");
  } catch {
    return [];
  }
}

function saveGuestHistory(list) {
  try {
    sessionStorage.setItem("pg_guest_history", JSON.stringify(list));
  } catch {}
}

function computeGuestHistory(options: HistoryOptions = {}) {
  const { status, search, sort, page = 1, page_size = 10 } = options;
  let items = getGuestHistory();
  if (status && status !== "all") {
    items = items.filter((x) => (x.status || x.scan_result?.verdict) === status);
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter((x) => (x.url || "").toLowerCase().includes(q));
  }
  if (sort === "oldest") {
    items.sort((a, b) => new Date(a.date_submitted).getTime() - new Date(b.date_submitted).getTime());
  } else {
    items.sort((a, b) => new Date(b.date_submitted).getTime() - new Date(a.date_submitted).getTime());
  }

  const start = (page - 1) * page_size;
  const paginated = items.slice(start, start + page_size);

  return {
    results: paginated,
    total: items.length,
    page,
    page_size,
    total_pages: Math.ceil(items.length / page_size) || 1,
  };
}

function computeGuestStats() {
  const items = getGuestHistory();
  const total = items.length;
  const phishing = items.filter((x) => (x.status || x.scan_result?.verdict) === "phishing").length;
  const suspicious = items.filter((x) => (x.status || x.scan_result?.verdict) === "suspicious").length;
  const safe = items.filter((x) => (x.status || x.scan_result?.verdict) === "safe").length;
  const threatCount = phishing + suspicious;

  return {
    total,
    phishing,
    suspicious,
    safe,
    threat_count: threatCount,
    threat_rate: Math.round((threatCount / Math.max(total, 1)) * 100),
  };
}

// ── GET /api/history/ ─────────────────────────────────────────────────────────
export async function fetchHistory(options: HistoryOptions = {}) {
  if (isGuestSession()) {
    return computeGuestHistory(options);
  }

  try {
    const { status, search, sort, page = 1, page_size = 10 } = options as HistoryOptions;
    const params = new URLSearchParams();
    if (status && status !== "all") params.append("status", status);
    if (search) params.append("search", search);
    if (sort) params.append("sort", sort);
    if (page) params.append("page", String(page));
    if (page_size) params.append("page_size", String(page_size));
    const { data } = await api.get(`/history/?${params.toString()}`);
    return data;
  } catch (err) {
    if (err.response?.status === 401) {
      return computeGuestHistory(options);
    }
    throw err;
  }
}

// ── GET /api/stats/ ───────────────────────────────────────────────────────────
export async function fetchStats() {
  if (isGuestSession()) {
    return computeGuestStats();
  }

  try {
    const { data } = await api.get("/stats/");
    return data;
  } catch (err) {
    if (err.response?.status === 401) {
      return computeGuestStats();
    }
    throw err;
  }
}

// ── GET /api/analytics/ ───────────────────────────────────────────────────────
export async function fetchAnalytics() {
  if (isGuestSession()) {
    const items = getGuestHistory();
    const total = items.length;
    const phishing = items.filter((x) => (x.status || x.scan_result?.verdict) === "phishing").length;
    const suspicious = items.filter((x) => (x.status || x.scan_result?.verdict) === "suspicious").length;
    const safe = items.filter((x) => (x.status || x.scan_result?.verdict) === "safe").length;

    return {
      daily: [{ date: new Date().toISOString().split("T")[0], total_scans: total, threats: phishing + suspicious }],
      by_verdict: [
        { verdict: "phishing", count: phishing },
        { verdict: "suspicious", count: suspicious },
        { verdict: "safe", count: safe },
      ],
      score_dist: [
        { range: "0-20 (Safe)", count: safe },
        { range: "21-69 (Suspicious)", count: suspicious },
        { range: "70-100 (Phishing)", count: phishing },
      ],
      top_threats: items.filter((x) => (x.status || x.scan_result?.verdict) === "phishing").map((x) => ({ url: x.url, verdict: "phishing" })),
      summary: {
        total_scans: total,
        phishing_count: phishing,
        suspicious_count: suspicious,
        safe_count: safe,
        avg_risk_score: total ? Math.round(items.reduce((acc, cur) => acc + (cur.scan_result?.risk_score || 0), 0) / total) : 0,
      },
    };
  }

  try {
    const { data } = await api.get("/analytics/");
    return data;
  } catch (err) {
    if (err.response?.status === 401) {
      return fetchAnalytics(); // fallback to guest calculation
    }
    throw err;
  }
}

// ── POST /api/scan/ ───────────────────────────────────────────────────────────
export async function scanURL(url) {
  const { data } = await api.post("/scan/", { url });

  if (isGuestSession()) {
    const current = getGuestHistory();
    const newItem = {
      id: data.id || `guest-${Date.now()}`,
      url: data.url || data.input_url || url,
      normalized_url: data.normalized_url || url,
      status: data.status || data.verdict || "safe",
      date_submitted: data.date_submitted || new Date().toISOString(),
      scan_result: data.scan_result || {
        verdict: data.verdict || "safe",
        confidence_score: data.confidence_score || 90,
        risk_score: data.risk_score || 10,
        reasons: data.reasons || [],
      },
      is_guest: true,
    };
    saveGuestHistory([newItem, ...current]);
  }

  return data;
}

// ── POST /api/scan/async/ ─────────────────────────────────────────────────────
export async function scanURLAsync(url, useLiveSignals = false) {
  const { data } = await api.post("/scan/async/", {
    url,
    use_live_signals: useLiveSignals,
  });
  return data;
}

// ── GET /api/scan/task-status/<task_id>/ ──────────────────────────────────────
export async function fetchTaskStatus(taskId) {
  const { data } = await api.get(`/scan/task-status/${taskId}/`);
  return data;
}

// ── DELETE /api/scan/<id>/delete/ ─────────────────────────────────────────────
export async function deleteScan(id) {
  if (isGuestSession()) {
    const current = getGuestHistory();
    const updated = current.filter((x) => String(x.id) !== String(id));
    saveGuestHistory(updated);
    return { deleted: true };
  }

  const { data } = await api.delete(`/scan/${id}/delete/`);
  return data;
}

// ── POST /api/reports/ ────────────────────────────────────────────────────────
export async function reportURL(urlId, description) {
  if (isGuestSession()) {
    return { id: `report-${Date.now()}`, description, status: "submitted" };
  }

  const { data } = await api.post("/reports/", {
    url_id: urlId,
    description: description.trim(),
  });
  return data;
}

// ── GET /api/history/ for CSV export ─────────────────────────────────────────
export async function fetchAllScans() {
  if (isGuestSession()) {
    return getGuestHistory();
  }

  const { data } = await api.get("/history/?page=1&page_size=1000&sort=newest");
  return data.results || [];
}