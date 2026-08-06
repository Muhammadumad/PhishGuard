// src/pages/History.jsx
// EASY WIN 1: Delete scan button on every row
// EASY WIN 2: Export as CSV button in header
import { useState, useEffect, useCallback } from "react";
import {
  fetchHistory,
  fetchStats,
  deleteScan,
  fetchAllScans,
} from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";
import GhostButton from "../components/ui/GhostButton";

const PAGE_SIZE = 8;

function statusColor(s) {
  if (s === "phishing" || s === "malicious") return "var(--red)";
  if (s === "suspicious") return "var(--amber)";
  return "var(--green)";
}

function StatusPill({ status }) {
  const label = status === "phishing" ? "malicious" : status;
  return (
    <span
      className={`pg-pill pg-pill-${
        label === "malicious"
          ? "malicious"
          : label === "suspicious"
            ? "suspicious"
            : "clean"
      }`}
    >
      ● {label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[100, 240, 100, 80, 80, 40].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div
            style={{
              width: w,
              height: 10,
              borderRadius: 6,
              background:
                "linear-gradient(90deg,var(--skeleton-base) 25%,var(--skeleton-hi) 50%,var(--skeleton-base) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── EASY WIN 2: CSV export helper ─────────────────────────────────────────────
function downloadCSV(rows) {
  const headers = ["URL", "Status", "Risk Score", "Reason", "Time"];

  const escape = (val) => {
    const str = String(val ?? "").replace(/"/g, '""');
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str}"`
      : str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((item) =>
      [
        escape(item.url),
        escape(item.status),
        escape(item.scan_result?.risk_score ?? 0),
        escape(item.scan_result?.reasons?.[0] ?? "—"),
        escape(item.time ?? "—"),
      ].join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `phishguard-history-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function History() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({
    all: 0,
    phishing: 0,
    suspicious: 0,
    safe: 0,
  });

  // EASY WIN 1: delete state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // EASY WIN 2: export state
  const [exporting, setExporting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const dismissed =
      localStorage.getItem("pg_history_onboarding_dismissed") === "1";
    setShowOnboarding(!dismissed);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchHistory({
        status: filter,
        search: search.trim(),
        sort: sortBy,
        page,
        page_size: PAGE_SIZE,
      });
      setData(res.results || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch {
      setError("Could not load history. Make sure Django is running.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search, sortBy, page]);

  const loadCounts = useCallback(async () => {
    try {
      const stats = await fetchStats();
      setCounts({
        all: stats.total || 0,
        phishing: stats.phishing || 0,
        suspicious: stats.suspicious || 0,
        safe: stats.safe || 0,
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleFilter = (v) => {
    setFilter(v);
    setPage(1);
  };
  const handleSearch = (v) => {
    setSearch(v);
    setPage(1);
  };

  // ── EASY WIN 1: Delete handler ──────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    setDeleteError("");
    setConfirmDeleteId(null);
    try {
      await deleteScan(id);
      // Remove from local state immediately — no need to refetch
      setData((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      // Update tab counts
      await loadCounts();
    } catch (err) {
      setDeleteError(
        err.response?.data?.error || "Could not delete scan. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ── EASY WIN 2: Export handler ──────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchAllScans();
      if (all.length === 0) {
        setDeleteError("No scans to export yet.");
        return;
      }
      downloadCSV(all);
    } catch {
      setDeleteError("Export failed. Make sure Django is running.");
    } finally {
      setExporting(false);
    }
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_history_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  return (
    <main className="pg-main pg-page-history fade-up">
      {total > 0 ? (
        <div
          className="pg-row-wrap"
          style={{ justifyContent: "flex-end", marginBottom: "12px" }}
        >
          <GhostButton onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <span className="spin">⟳</span> Exporting...
              </>
            ) : (
              "↓ Export CSV"
            )}
          </GhostButton>
        </div>
      ) : null}

      {showOnboarding && (
        <div className="pg-onboard">
          <div
            className="pg-row-between"
            style={{ marginBottom: "8px", alignItems: "flex-start" }}
          >
            <div>
              <div className="pg-onboard-title">History Guide</div>
              <div className="pg-onboard-copy">
                Use filters and search to quickly find risky URLs and actions.
              </div>
            </div>
            <button className="pg-btn-ghost" onClick={dismissOnboarding}>
              Hide
            </button>
          </div>
          <div className="pg-onboard-list">
            <div className="pg-onboard-item">
              1. Filter by phishing, suspicious, or safe.
            </div>
            <div className="pg-onboard-item">
              2. Sort by newest or highest risk score.
            </div>
            <div className="pg-onboard-item">
              3. Export CSV for reporting and audit trails.
            </div>
          </div>
        </div>
      )}

      {/* ── Error / delete error banner ─────────────────── */}
      <StatusAlert
        message={error || deleteError}
        onClose={() => {
          setError("");
          setDeleteError("");
        }}
      />

      {/* ── Filter tabs ─────────────────────────────────── */}
      <div className="pg-filter-tabs">
        {[
          { key: "all", label: "All", count: counts.all },
          { key: "phishing", label: "Phishing", count: counts.phishing },
          { key: "suspicious", label: "Suspicious", count: counts.suspicious },
          { key: "safe", label: "Safe", count: counts.safe },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => handleFilter(key)}
            className={`pg-filter-btn${filter === key ? " active" : ""}`}
          >
            {label} <span style={{ opacity: 0.6 }}>({count})</span>
          </button>
        ))}
      </div>

      {/* ── Search + Sort ────────────────────────────────── */}
      <div
        className="pg-row-wrap"
        style={{ marginBottom: "16px", gap: "10px" }}
      >
        <input
          className="pg-input"
          type="text"
          placeholder="Search by URL..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          className="pg-select-control"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="riskHigh">Highest Risk</option>
          <option value="riskLow">Lowest Risk</option>
        </select>
      </div>

      {/* ── Results count ───────────────────────────────── */}
      {!loading && (
        <div className="pg-results-meta">
          {data.length > 0
            ? `Showing ${data.length} of ${total} results`
            : "No results found"}
          {search && (
            <span>
              {" "}
              — search: "
              <span style={{ color: "var(--text-2)" }}>{search}</span>"
            </span>
          )}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────── */}
      <div
        className="pg-card"
        style={{ padding: 0, overflow: "hidden", marginBottom: "20px" }}
      >
        <div className="pg-table-responsive" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="pg-table" style={{ minWidth: "580px" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: "20px" }}>Status</th>
                <th>URL</th>
                <th>Reason</th>
                <th>Risk Score</th>
                <th>Time</th>
                {/* EASY WIN 1: delete column header */}
                <th style={{ paddingRight: "20px", width: "60px" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "56px",
                      color: "var(--text-3)",
                      fontFamily: "var(--mono)",
                      fontSize: "12px",
                    }}
                  >
                    {search
                      ? `No results for "${search}"`
                      : "No scans yet — scan some URLs on the Dashboard"}
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const result = item.scan_result || {};
                  const status = item.status;
                  const score = result.risk_score ?? 0;
                  const reason = result.reasons?.[0] || "—";
                  const isDeleting = deletingId === item.id;
                  const isConfirming = confirmDeleteId === item.id;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        opacity: isDeleting ? 0.4 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <td style={{ paddingLeft: "20px" }}>
                        <StatusPill status={status} />
                      </td>
                      <td style={{ maxWidth: "220px" }}>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text)",
                            fontFamily: "var(--mono)",
                            fontSize: "11px",
                          }}
                          title={item.url}
                        >
                          {item.url}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "10px",
                          color: "var(--text-2)",
                          maxWidth: "160px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {reason}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              maxWidth: "60px",
                              height: "4px",
                              background: "var(--track-bg)",
                              borderRadius: "4px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(score, 100)}%`,
                                background: statusColor(status),
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: "11px",
                              color: statusColor(status),
                              fontWeight: 700,
                            }}
                          >
                            {score}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "10px",
                          color: "var(--text-3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.time || "—"}
                      </td>

                      {/* EASY WIN 1: Delete button cell */}
                      <td style={{ paddingRight: "16px" }}>
                        {isDeleting ? (
                          <span
                            className="spin"
                            style={{ fontSize: "12px", color: "var(--text-3)" }}
                          >
                            ⟳
                          </span>
                        ) : isConfirming ? (
                          /* Confirm / cancel mini-row */
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              alignItems: "center",
                            }}
                          >
                            <button
                              onClick={() => handleDelete(item.id)}
                              style={{
                                padding: "3px 8px",
                                borderRadius: "4px",
                                background: "var(--red-dim)",
                                border: "1px solid rgba(255,59,92,0.3)",
                                color: "var(--red)",
                                fontFamily: "var(--mono)",
                                fontSize: "9px",
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{
                                padding: "3px 8px",
                                borderRadius: "4px",
                                background: "var(--bg-card2)",
                                border: "1px solid var(--border-hi)",
                                color: "var(--text-3)",
                                fontFamily: "var(--mono)",
                                fontSize: "9px",
                                cursor: "pointer",
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(item.id)}
                            title="Delete this scan"
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              background: "transparent",
                              border: "1px solid transparent",
                              color: "var(--text-3)",
                              fontSize: "12px",
                              cursor: "pointer",
                              transition: "all 0.15s",
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = "var(--red-dim)";
                              e.target.style.borderColor =
                                "rgba(255,59,92,0.2)";
                              e.target.style.color = "var(--red)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = "transparent";
                              e.target.style.borderColor = "transparent";
                              e.target.style.color = "var(--text-3)";
                            }}
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="pg-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="pg-page-btn"
          >
            ← Prev
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`pg-page-btn dot${page === p ? " active" : ""}`}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="pg-page-btn"
          >
            Next →
          </button>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </main>
  );
}
