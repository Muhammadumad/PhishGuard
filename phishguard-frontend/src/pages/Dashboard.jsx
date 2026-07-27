// src/pages/Dashboard.jsx
// EASY WIN 3: Report URL button + modal on scan result card
import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { fetchStats, fetchHistory, reportURL } from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";

function statusColor(s) {
  if (s === "phishing" || s === "malicious") return "var(--red)";
  if (s === "suspicious") return "var(--amber)";
  return "var(--green)";
}

function getAnchoredPopoverPosition(target) {
  if (!target || typeof window === "undefined") {
    return { top: 96, left: 16, width: 760, above: false };
  }

  const rect = target.getBoundingClientRect();
  const width = Math.min(760, window.innerWidth - 32);
  const estimatedHeight = 420;
  const margin = 16;

  let left = Math.max(
    margin,
    Math.min(rect.left, window.innerWidth - width - margin),
  );
  let top = rect.bottom + 12;
  let above = false;

  if (top + estimatedHeight > window.innerHeight - margin) {
    const aboveTop = rect.top - 12;
    if (aboveTop - estimatedHeight >= margin) {
      top = aboveTop;
      above = true;
    } else {
      top = Math.max(margin, window.innerHeight - estimatedHeight - margin);
    }
  }

  return { top, left, width, above };
}

function ScoreRing({ score, verdict }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const safeScore = Math.min(Math.max(Math.round(score || 0), 0), 100);
  const pct = (safeScore / 100) * c;
  const color =
    verdict === "phishing" || verdict === "malicious"
      ? "#ff3b5c"
      : verdict === "suspicious"
        ? "#f59e0b"
        : "#10b981";
  const glow =
    verdict === "phishing" || verdict === "malicious"
      ? "rgba(255,59,92,0.4)"
      : verdict === "suspicious"
        ? "rgba(245,158,11,0.4)"
        : "rgba(16,185,129,0.4)";
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth="7"
      />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={`${pct} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{
          transition: "stroke-dasharray 0.6s ease",
          filter: `drop-shadow(0 0 4px ${glow})`,
        }}
      />
      <text
        x="48"
        y="46"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "16px" }}
      >
        {safeScore}
      </text>
      <text
        x="48"
        y="61"
        textAnchor="middle"
        fill="rgba(232,236,244,0.28)"
        style={{ fontFamily: "var(--mono)", fontSize: "9px" }}
      >
        /100
      </text>
    </svg>
  );
}

function URLHoverInfo({ item, children }) {
  const status = item?.status || "unknown";
  const normalizedStatus = status === "malicious" ? "phishing" : status;
  const statusClass =
    normalizedStatus === "phishing"
      ? "pg-url-status-malicious"
      : normalizedStatus === "suspicious"
        ? "pg-url-status-suspicious"
        : normalizedStatus === "safe"
          ? "pg-url-status-safe"
          : "pg-url-status-unknown";
  const score = item?.scan_result?.risk_score ?? "—";
  const reason = item?.scan_result?.reasons?.[0] || "No reason provided";
  const time = item?.time || "just now";

  return (
    <span className="pg-url-hover-wrap" tabIndex={0}>
      <span className="pg-url-hover-trigger">{children}</span>
      <span className="pg-url-hover-card" role="tooltip" aria-live="polite">
        <span className="pg-url-hover-title">URL Intelligence</span>
        <span className="pg-url-hover-row">
          <strong>Status:</strong>{" "}
          <span className={`pg-url-status-pill ${statusClass}`}>
            {normalizedStatus.toUpperCase()}
          </span>
        </span>
        <span className="pg-url-hover-row">
          <strong>Risk:</strong> {score}/100
        </span>
        <span className="pg-url-hover-row">
          <strong>Reason:</strong> {reason}
        </span>
        <span className="pg-url-hover-row">
          <strong>Time:</strong> {time}
        </span>
      </span>
    </span>
  );
}

function ScanDetailModal({
  scan,
  getRiskBand,
  getRecommendation,
  onClose,
  position,
}) {
  if (!scan) return null;

  const verdict = scan.status || "safe";
  const score = scan.scan_result?.risk_score ?? 0;
  const confidence = scan.scan_result?.confidence_score ?? "N/A";
  const reasons = scan.scan_result?.reasons || [];

  return (
    <div
      className="pg-modal-overlay"
      onClick={onClose}
      style={{
        background: "rgba(0,0,0,0.16)",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        padding: 0,
      }}
    >
      <div
        className="pg-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "760px",
          width: position?.width
            ? `${position.width}px`
            : "min(760px, calc(100vw - 32px))",
          position: "fixed",
          top: position?.top ?? "96px",
          left: position?.left ?? "16px",
          transform: position?.above ? "translateY(-100%)" : "none",
          zIndex: 201,
        }}
      >
        <div
          className="pg-row-between"
          style={{ marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}
        >
          <div>
            <div className="pg-section-title" style={{ margin: 0 }}>
              Full URL Details
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10px",
                color: "var(--text-3)",
                marginTop: "4px",
              }}
            >
              Clicked URL details from the dashboard result card
            </div>
          </div>
          <div className="pg-row-wrap">
            <span
              className={`pg-pill pg-pill-${
                verdict === "phishing"
                  ? "malicious"
                  : verdict === "safe"
                    ? "clean"
                    : "suspicious"
              }`}
            >
              ● {verdict}
            </span>
            <button className="pg-btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <div className="pg-explain">
            <div className="pg-explain-row">
              <span className="pg-explain-key">URL</span>
              <span
                className="pg-explain-val"
                style={{ wordBreak: "break-all", textAlign: "right" }}
              >
                {scan.url || "—"}
              </span>
            </div>
            <div className="pg-explain-row">
              <span className="pg-explain-key">Risk Score</span>
              <span
                className="pg-explain-val"
                style={{ color: statusColor(verdict) }}
              >
                {score}/100
              </span>
            </div>
            <div className="pg-explain-row">
              <span className="pg-explain-key">Confidence</span>
              <span className="pg-explain-val">{confidence}/100</span>
            </div>
            <div className="pg-explain-row">
              <span className="pg-explain-key">Risk Band</span>
              <span className="pg-explain-val">{getRiskBand(score)}</span>
            </div>
          </div>

          <div className="pg-explain">
            <div
              className="pg-explain-row"
              style={{ alignItems: "flex-start" }}
            >
              <span className="pg-explain-key">Recommended Action</span>
              <span
                className="pg-explain-val"
                style={{ textAlign: "right", maxWidth: "72%" }}
              >
                {getRecommendation(verdict)}
              </span>
            </div>
            <div className="pg-explain-row">
              <span className="pg-explain-key">Time</span>
              <span className="pg-explain-val">{scan.time || "—"}</span>
            </div>
            <div className="pg-explain-row">
              <span className="pg-explain-key">Stored As</span>
              <span className="pg-explain-val">{scan.id || "latest"}</span>
            </div>
          </div>
        </div>

        {reasons.length > 0 && (
          <div className="pg-explain" style={{ marginTop: "12px" }}>
            <div className="pg-explain-key" style={{ marginBottom: "8px" }}>
              Reasons
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              {reasons.map((reason, index) => (
                <div
                  key={index}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{ color: statusColor(verdict), marginRight: "6px" }}
                  >
                    ›
                  </span>
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EASY WIN 3: Report Modal component ───────────────────────────────────────
function ReportModal({ scanResult, onClose }) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("Please describe why this URL is suspicious.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Description must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await reportURL(scanResult.id, description);
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not submit report. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Overlay */
    <div onClick={onClose} className="pg-modal-overlay">
      {/* Modal card — stop click propagation so overlay click doesn't close while submitting */}
      <div onClick={(e) => e.stopPropagation()} className="pg-modal-card">
        {submitted ? (
          /* Success state */
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "36px", marginBottom: "14px" }}>✅</div>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: "18px",
                color: "var(--text)",
                marginBottom: "8px",
              }}
            >
              Report Submitted
            </div>
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: "11px",
                color: "var(--text-3)",
                marginBottom: "20px",
                lineHeight: 1.6,
              }}
            >
              Thank you. An admin will review this URL and confirm or dismiss
              the report. Confirmed reports are automatically added to the
              blacklist.
            </p>
            <button
              onClick={onClose}
              className="pg-btn-primary"
              style={{ width: "100%" }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="pg-modal-header">
              <div>
                <div className="pg-modal-title">Report Phishing URL</div>
                <div className="pg-modal-subtitle">
                  Flagged URLs are reviewed by admins and blacklisted if
                  confirmed
                </div>
              </div>
              <button onClick={onClose} className="pg-modal-close">
                ✕
              </button>
            </div>

            {/* URL preview */}
            <div className="pg-modal-muted-box">
              <div className="pg-label-tiny">URL</div>
              <div className="pg-copy-mono" style={{ wordBreak: "break-all" }}>
                {scanResult.url}
              </div>
            </div>

            {/* Description field */}
            <div style={{ marginBottom: "16px" }}>
              <label className="pg-label-tiny" style={{ marginBottom: "8px" }}>
                Why is this URL suspicious?
              </label>
              <textarea
                className="pg-input"
                rows={4}
                placeholder="e.g. This looks like a fake PayPal login page asking for my credentials..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setError("");
                }}
                style={{
                  resize: "vertical",
                  lineHeight: 1.6,
                  minHeight: "100px",
                }}
              />
              <div className="pg-row-between" style={{ marginTop: "5px" }}>
                <span
                  className={
                    description.length < 10
                      ? "pg-text-xs-danger"
                      : "pg-text-xs-muted"
                  }
                >
                  {description.trim().length} chars{" "}
                  {description.trim().length < 10 ? `(min 10)` : "✓"}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: "14px",
                  background: "var(--red-dim)",
                  border: "1px solid rgba(255,59,92,0.2)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--red)",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={onClose}
                className="pg-btn-ghost"
                style={{ flex: 1, fontSize: "12px", padding: "11px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || description.trim().length < 10}
                className="pg-btn-primary"
                style={{
                  flex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {submitting ? (
                  <>
                    <span className="spin">⟳</span> Submitting...
                  </>
                ) : (
                  "Submit Report →"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [currentResult, setCurrentResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    phishing: 0,
    suspicious: 0,
    safe: 0,
  });

  // EASY WIN 3: report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [selectedDashboardScan, setSelectedDashboardScan] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalPosition, setDetailModalPosition] = useState(null);

  useEffect(() => {
    loadHistory();
    loadStats();
    const dismissed =
      localStorage.getItem("pg_dashboard_onboarding_dismissed") === "1";
    setShowOnboarding(!dismissed);
  }, []);

  useEffect(() => {
    setShowExplain(false);
  }, [currentResult]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetchHistory({
        sort: "newest",
        page: 1,
        page_size: 10,
      });
      setHistory(res.results || []);
    } catch (_) {
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (_) {}
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setScanning(true);
    setCurrentResult(null);
    setApiError("");
    setShowReportModal(false);
    try {
      const res = await api.post("/scan/", { url: urlInput.trim() });
      setCurrentResult({ ...res.data, time: "just now" });
      setUrlInput("");
      await loadHistory();
      await loadStats();
    } catch (err) {
      if (!err.response)
        setApiError(
          "Cannot connect to Django. Make sure the server is running.",
        );
      else if (err.response?.status === 401)
        setApiError("Session expired. Please log in again.");
      else
        setApiError(
          err.response?.data?.error || "Scan failed. Please try again.",
        );
    } finally {
      setScanning(false);
    }
  };

  const getRiskBand = (score) => {
    if (score >= 81) return "Critical";
    if (score >= 61) return "High";
    if (score >= 41) return "Moderate";
    if (score >= 21) return "Low";
    return "Minimal";
  };

  const getRecommendation = (status) => {
    if (status === "phishing" || status === "malicious")
      return "Do not open this URL. Block and report it immediately.";
    if (status === "suspicious")
      return "Avoid entering credentials. Verify domain ownership before proceeding.";
    return "No obvious phishing signals. Continue with standard caution.";
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_dashboard_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  return (
    <main className="pg-main pg-page-dashboard fade-up">
      {showOnboarding && (
        <div className="pg-onboard">
          <div
            className="pg-row-between"
            style={{ marginBottom: "8px", alignItems: "flex-start" }}
          >
            <div>
              <div className="pg-onboard-title">Quick Start Guide</div>
              <div className="pg-onboard-copy">
                Use this once to understand the workflow, then hide it anytime.
              </div>
            </div>
            <button className="pg-btn-ghost" onClick={dismissOnboarding}>
              Hide
            </button>
          </div>
          <div className="pg-onboard-list">
            <div className="pg-onboard-item">1. Paste a URL and scan it.</div>
            <div className="pg-onboard-item">
              2. Check risk score, verdict, and reasons.
            </div>
            <div className="pg-onboard-item">
              3. Use report action for suspicious or phishing links.
            </div>
          </div>
          <div className="pg-row-wrap" style={{ marginTop: "12px" }}>
            <button
              className="pg-btn-ghost"
              onClick={() => setUrlInput("paypa1-security-check.com")}
            >
              Try suspicious sample
            </button>
            <button
              className="pg-btn-ghost"
              onClick={() => setUrlInput("github.com")}
            >
              Try safe sample
            </button>
          </div>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────── */}
      <div className="pg-stats" style={{ marginBottom: "24px" }}>
        {[
          {
            label: "Total Scans",
            value: stats.total || 0,
            sub: "all time",
            color: "var(--text)",
          },
          {
            label: "Phishing",
            value: stats.phishing || 0,
            sub: "threats found",
            color: "var(--red)",
          },
          {
            label: "Suspicious",
            value: stats.suspicious || 0,
            sub: "needs review",
            color: "var(--amber)",
          },
          {
            label: "Safe",
            value: stats.safe || 0,
            sub: "clean URLs",
            color: "var(--green)",
          },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="pg-stat">
            <div className="pg-stat-label">{label}</div>
            <div className="pg-stat-value" style={{ color }}>
              {value}
            </div>
            <div className="pg-stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Scan input ─────────────────────────────────── */}
      <div className="pg-card" style={{ marginBottom: "24px" }}>
        <div className="pg-section-title">Scan a URL</div>
        <form onSubmit={handleScan} style={{ display: "flex", gap: "10px" }}>
          <input
            className="pg-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter the URL to check..."
            disabled={scanning}
          />
          <button
            type="submit"
            className="pg-btn-primary"
            disabled={scanning || !urlInput.trim()}
            style={{
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {scanning ? (
              <>
                <span className="spin">⟳</span> Scanning...
              </>
            ) : (
              "Scan →"
            )}
          </button>
        </form>

        {/* Quick examples */}
        {/* <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--text-3)", letterSpacing: "1px", textTransform: "uppercase" }}>Try:</span>
          {["paypa1.com", "github.com", "bit.ly/test", "secure-bank-login.xyz", "google.com.fake-login.xyz"].map(ex => (
            <button key={ex} onClick={() => setUrlInput(ex)} style={{
              background: "var(--bg-card2)", border: "1px solid var(--border-hi)",
              borderRadius: "6px", padding: "4px 10px",
              fontFamily: "var(--mono)", fontSize: "10px",
              color: "var(--text-2)", cursor: "pointer",
            }}>{ex}</button>
          ))}
        </div> */}

        {/* API error */}
        <div style={{ marginTop: apiError ? "14px" : 0 }}>
          <StatusAlert message={apiError} onClose={() => setApiError("")} />
        </div>
      </div>

      {/* ── Scan result ────────────────────────────────── */}
      {currentResult && (
        <div
          className="pg-card fade-up"
          style={{
            marginBottom: "24px",
            borderColor: statusColor(currentResult.status) + "44",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <div className="pg-section-title" style={{ margin: 0 }}>
              Latest Result
            </div>

            {/* EASY WIN 3: Report button — only show for phishing/suspicious */}
            {(currentResult.status === "phishing" ||
              currentResult.status === "suspicious") && (
              <button
                onClick={() => setShowReportModal(true)}
                style={{
                  padding: "6px 14px",
                  background: "var(--red-dim)",
                  border: "1px solid rgba(255,59,92,0.25)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--red)",
                  fontFamily: "var(--mono)",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                }}
              >
                ⚑ Report URL
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "24px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <ScoreRing
              score={currentResult.scan_result?.risk_score ?? 0}
              verdict={currentResult.status}
            />
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <span
                  className={`pg-pill pg-pill-${
                    currentResult.status === "phishing"
                      ? "malicious"
                      : currentResult.status === "safe"
                        ? "clean"
                        : "suspicious"
                  }`}
                >
                  ● {currentResult.status}
                </span>
              </div>
              <div style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  className="pg-url-row-btn"
                  onClick={(event) => {
                    setSelectedDashboardScan(currentResult);
                    setDetailModalPosition(
                      getAnchoredPopoverPosition(event.currentTarget),
                    );
                    setShowDetailModal(true);
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "12px",
                      color: "var(--text)",
                      wordBreak: "break-all",
                    }}
                  >
                    {currentResult.url}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "10px",
                      color: "var(--text-3)",
                      flexShrink: 0,
                    }}
                  >
                    Open details
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDashboardScan && showDetailModal && (
        <ScanDetailModal
          scan={selectedDashboardScan}
          getRiskBand={getRiskBand}
          getRecommendation={getRecommendation}
          position={detailModalPosition}
          onClose={() => {
            setShowDetailModal(false);
            setDetailModalPosition(null);
          }}
        />
      )}

      {/* ── Recent scans ───────────────────────────────── */}
      <div className="pg-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div className="pg-section-title" style={{ margin: 0 }}>
            Recent Scans
          </div>
          {loadingHistory && (
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10px",
                color: "var(--text-3)",
              }}
            >
              <span className="spin">⟳</span> Loading...
            </span>
          )}
        </div>

        {loadingHistory ? (
          <table className="pg-table">
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[200, 80, 60, 70].map((w, j) => (
                    <td key={j} style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          width: w,
                          height: 10,
                          borderRadius: 6,
                          background: "var(--skeleton-base)",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : history.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              fontFamily: "var(--mono)",
              fontSize: "12px",
              color: "var(--text-3)",
            }}
          >
            No scans yet — enter a URL above to get started
          </div>
        ) : (
          <table className="pg-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Risk Score</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((h, i) => {
                const score = h.scan_result?.risk_score ?? 0;
                const status = h.status;
                const reason = h.scan_result?.reasons?.[0] || "—";
                return (
                  <tr key={h.id || i}>
                    <td
                      style={{
                        maxWidth: "220px",
                        overflow: "visible",
                        whiteSpace: "nowrap",
                        color: "var(--text)",
                      }}
                    >
                      <button
                        type="button"
                        className="pg-url-row-btn"
                        onClick={(event) => {
                          setSelectedDashboardScan(h);
                          setDetailModalPosition(
                            getAnchoredPopoverPosition(event.currentTarget),
                          );
                          setShowDetailModal(true);
                        }}
                        style={{ justifyContent: "flex-start" }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            maxWidth: "220px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            verticalAlign: "middle",
                            fontFamily: "var(--mono)",
                            fontSize: "11px",
                            color: "var(--text)",
                          }}
                        >
                          {h.url}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "10px",
                            color: "var(--text-3)",
                            marginLeft: "8px",
                            flexShrink: 0,
                          }}
                        >
                          Open details
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`pg-pill pg-pill-${
                          status === "phishing"
                            ? "malicious"
                            : status === "safe"
                              ? "clean"
                              : "suspicious"
                        }`}
                      >
                        ● {status}
                      </span>
                    </td>
                    <td>
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
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "10px",
                          color: "var(--text-3)",
                        }}
                      >
                        /100
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
                    <td
                      style={{
                        color: "var(--text-3)",
                        fontSize: "10px",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {h.time || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* EASY WIN 3: Report modal */}
      {showReportModal && currentResult && (
        <ReportModal
          scanResult={currentResult}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </main>
  );
}
