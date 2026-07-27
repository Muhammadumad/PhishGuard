// src/pages/BulkScanner.jsx
// UX improvements:
//  + Live summary cards update in real-time DURING scan (not just after)
//  + Error rows visually distinct with red background tint
//  + Re-scan failed URLs only button after scan completes
//  + Smoother progress bar with CSS transition
//  + Scan speed shown (URLs/sec)
//  + Result table visible immediately when first result arrives
import { useEffect, useState, useRef } from "react";
import api from "../api/axiosInstance";
import StatusAlert from "../components/ui/StatusAlert";
import GhostButton from "../components/ui/GhostButton";

const MAX_CONCURRENT_SCANS = 4;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 350;

function statusColor(s) {
  if (s === "phishing" || s === "malicious") return "var(--red)";
  if (s === "suspicious") return "var(--amber)";
  if (s === "error") return "var(--text-3)";
  return "var(--green)";
}

function pillClass(s) {
  if (s === "phishing" || s === "malicious") return "pg-pill pg-pill-malicious";
  if (s === "suspicious") return "pg-pill pg-pill-suspicious";
  if (s === "error") return "pg-pill";
  return "pg-pill pg-pill-clean";
}

function SkeletonRow() {
  return (
    <tr>
      {[40, 240, 90, 110, 80].map((w, i) => (
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

export default function BulkScanner() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [scanRate, setScanRate] = useState(null); // URLs/sec
  const [showOnboarding, setShowOnboarding] = useState(false);
  const scanStartRef = useRef(null);
  const abortRef = useRef(false);
  const controllersRef = useRef(new Set());

  useEffect(() => {
    const dismissed =
      localStorage.getItem("pg_bulk_onboarding_dismissed") === "1";
    setShowOnboarding(!dismissed);
  }, []);

  const parseURLs = (text) =>
    text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getRetryDelay = (attempt) => {
    const jitter = Math.floor(Math.random() * 120);
    return RETRY_BASE_MS * 2 ** attempt + jitter;
  };

  const shouldRetry = (err) => {
    if (!err.response) return true;
    const status = err.response.status;
    return status >= 500;
  };

  const buildSuccessResult = (data, url, index) => ({
    id: data.id || `scan-${Date.now()}-${index}`,
    url: data.url || url,
    status: data.status,
    verdict: data.scan_result?.verdict || data.status,
    risk_score: data.scan_result?.risk_score ?? 0,
    confidence: data.scan_result?.confidence_score ?? 0,
    reason: data.scan_result?.reasons?.[0] || "—",
    time: data.time || "just now",
    error: null,
  });

  const buildErrorResult = (url, index, errMsg) => ({
    id: `scan-error-${Date.now()}-${index}`,
    url,
    status: "error",
    verdict: "error",
    risk_score: 0,
    confidence: 0,
    reason: errMsg,
    time: "—",
    error: errMsg,
  });

  const scanOneUrl = async (url, index) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (abortRef.current) {
        throw new Error("ABORTED");
      }

      const controller = new AbortController();
      controllersRef.current.add(controller);

      try {
        const res = await api.post(
          "/scan/",
          { url: url.trim() },
          { signal: controller.signal },
        );
        return buildSuccessResult(res.data, url, index);
      } catch (err) {
        if (controller.signal.aborted || abortRef.current) {
          throw new Error("ABORTED");
        }

        if (err.response?.status === 401) {
          const authError = new Error("AUTH_EXPIRED");
          authError.code = "AUTH_EXPIRED";
          throw authError;
        }

        const canRetry = shouldRetry(err) && attempt < MAX_RETRIES;
        if (canRetry) {
          await sleep(getRetryDelay(attempt));
          continue;
        }

        const errMsg =
          err.response?.data?.error || err.message || "Scan failed";
        return buildErrorResult(url, index, errMsg);
      } finally {
        controllersRef.current.delete(controller);
      }
    }

    return buildErrorResult(url, index, "Scan failed");
  };

  const urlCount = parseURLs(input).length;

  const handleScan = async (urlsToScan = null) => {
    setError("");
    setApiError("");
    const urls = urlsToScan || parseURLs(input);
    if (urls.length === 0) {
      setError("Please enter at least one URL.");
      return;
    }
    if (urls.length > 50) {
      setError("Maximum 50 URLs per bulk scan.");
      return;
    }

    setScanning(true);
    if (!urlsToScan) setResults([]);
    setProgress({ done: 0, total: urls.length });
    setScanRate(null);
    abortRef.current = false;
    scanStartRef.current = Date.now();

    const base = urlsToScan
      ? [...results.filter((r) => r.status !== "error")]
      : [];
    const batch = new Array(urls.length).fill(null);
    let done = 0;
    let pointer = 0;
    let fatalError = "";

    const updateLiveStats = () => {
      const elapsed = (Date.now() - scanStartRef.current) / 1000;
      if (elapsed > 0) setScanRate((done / elapsed).toFixed(1));
      setProgress({ done, total: urls.length });
      setResults([...base, ...batch.filter(Boolean)]);
    };

    const cancelAllRequests = () => {
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    };

    const worker = async () => {
      while (!abortRef.current) {
        const current = pointer;
        pointer += 1;

        if (current >= urls.length) {
          return;
        }

        try {
          batch[current] = await scanOneUrl(urls[current], current);
        } catch (err) {
          if (err.code === "AUTH_EXPIRED") {
            fatalError = "Session expired. Please log in again.";
            abortRef.current = true;
            cancelAllRequests();
            return;
          }

          if (err.message === "ABORTED") {
            return;
          }

          batch[current] = buildErrorResult(
            urls[current],
            current,
            "Unexpected scan error",
          );
        } finally {
          done += 1;
          updateLiveStats();
        }
      }
    };

    const workerCount = Math.min(MAX_CONCURRENT_SCANS, urls.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (fatalError) {
      setApiError(fatalError);
    } else if (!abortRef.current && done < urls.length) {
      setApiError("Scan stopped before all URLs were processed.");
    }

    setScanning(false);
  };

  const handleStop = () => {
    abortRef.current = true;
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
  };

  const handleClear = () => {
    setInput("");
    setResults([]);
    setError("");
    setApiError("");
    setProgress({ done: 0, total: 0 });
    setScanRate(null);
  };

  const loadExample = () => {
    setInput(
      "paypa1.com\ngithub.com\nsecure-bank-login.xyz\nbit.ly/xK9mP2\ngoogle.com\nfree-iphone-winner.com\nanthropic.com\nmalware-drop.ru",
    );
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_bulk_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  // Re-scan failed URLs only
  const failedURLs = results
    .filter((r) => r.status === "error")
    .map((r) => r.url);
  const handleRescanFailed = () => handleScan(failedURLs);

  // Live summary counts (update during scan)
  const summary = {
    phishing: results.filter((r) => r.status === "phishing").length,
    suspicious: results.filter((r) => r.status === "suspicious").length,
    safe: results.filter((r) => r.status === "safe").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const pendingRows = scanning
    ? Math.min(progress.total - progress.done, 3)
    : 0;

  return (
    <main className="pg-main pg-page-bulk fade-up">
      {showOnboarding && (
        <div className="pg-onboard">
          <div
            className="pg-row-between"
            style={{ marginBottom: "8px", alignItems: "flex-start" }}
          >
            <div>
              <div className="pg-onboard-title">Bulk Scan Tips</div>
              <div className="pg-onboard-copy">
                Process many URLs quickly and review threats in one table.
              </div>
            </div>
            <button className="pg-btn-ghost" onClick={dismissOnboarding}>
              Hide
            </button>
          </div>
          <div className="pg-onboard-list">
            <div className="pg-onboard-item">
              1. Paste up to 50 URLs separated by new lines.
            </div>
            <div className="pg-onboard-item">
              2. Track progress and scan speed in real time.
            </div>
            <div className="pg-onboard-item">
              3. Re-scan failed rows after network/API issues.
            </div>
          </div>
          <div className="pg-row-wrap" style={{ marginTop: "12px" }}>
            <button className="pg-btn-ghost" onClick={loadExample}>
              Load starter list
            </button>
          </div>
        </div>
      )}

      {/* ── API error ────────────────────────────────────── */}
      <StatusAlert message={apiError} onClose={() => setApiError("")} />

      {/* ── Input card ───────────────────────────────────── */}
      <div className="pg-card" style={{ marginBottom: "20px" }}>
        <div className="pg-row-between" style={{ marginBottom: "14px" }}>
          <div className="pg-section-title" style={{ margin: 0 }}>
            Enter URLs
          </div>
          <div className="pg-row-wrap">
            <GhostButton onClick={loadExample} disabled={scanning}>
              Load example
            </GhostButton>
            <GhostButton onClick={handleClear} disabled={scanning}>
              Clear
            </GhostButton>
          </div>
        </div>

        <textarea
          className="pg-input"
          rows={6}
          placeholder={
            "https://example.com\nhttps://another-site.org\nsuspicious-domain.xyz\n..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={scanning}
          style={{ resize: "vertical", lineHeight: 1.7, minHeight: "120px" }}
        />

        <div
          className="pg-row-between"
          style={{ marginTop: "10px", flexWrap: "wrap", gap: "8px" }}
        >
          <span
            className={urlCount > 50 ? "pg-text-xs-danger" : "pg-text-xs-muted"}
          >
            {urlCount} / 50 URLs
          </span>
          {error && <span className="pg-text-xs-danger">⚠ {error}</span>}
        </div>

        {/* Scan button + stop button + progress */}
        <div className="pg-row-wrap" style={{ marginTop: "16px", gap: "12px" }}>
          {scanning ? (
            <button
              onClick={handleStop}
              style={{
                padding: "12px 24px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,59,92,0.3)",
                background: "var(--red-dim)",
                color: "var(--red)",
                fontFamily: "var(--mono)",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ■ Stop
            </button>
          ) : (
            <button
              onClick={() => handleScan()}
              disabled={!input.trim() || urlCount > 50}
              className="pg-btn-primary"
              style={{
                minWidth: "140px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {`Scan ${urlCount > 0 ? urlCount : ""} URL${urlCount !== 1 ? "s" : ""} →`}
            </button>
          )}

          {scanning && (
            <div style={{ flex: 1, minWidth: "160px" }}>
              <div className="pg-row-between" style={{ marginBottom: "6px" }}>
                <span className="pg-text-xs-muted">
                  {progress.done}/{progress.total}
                  {scanRate && (
                    <span style={{ marginLeft: "8px", opacity: 0.6 }}>
                      {scanRate}/s
                    </span>
                  )}
                </span>
                <span className="pg-text-xs-danger" style={{ fontWeight: 700 }}>
                  {pct}%
                </span>
              </div>
              <div className="pg-progress-track">
                <div
                  className="pg-progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Live summary cards — show as soon as first result arrives ── */}
      {results.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {[
            { label: "Phishing", value: summary.phishing, color: "var(--red)" },
            {
              label: "Suspicious",
              value: summary.suspicious,
              color: "var(--amber)",
            },
            { label: "Safe", value: summary.safe, color: "var(--green)" },
            { label: "Scanned", value: results.length, color: "var(--text)" },
            ...(summary.errors > 0
              ? [
                  {
                    label: "Errors",
                    value: summary.errors,
                    color: "var(--text-3)",
                  },
                ]
              : []),
          ].map(({ label, value, color }) => (
            <div key={label} className="pg-stat">
              <div className="pg-stat-label">{label}</div>
              <div
                className="pg-stat-value"
                style={{ color, fontSize: "26px", transition: "all 0.3s" }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Re-scan failed button — shows after scan if there were errors ── */}
      {!scanning && failedURLs.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <GhostButton onClick={handleRescanFailed} className="pg-btn-ghost">
            ⟳ Re-scan {failedURLs.length} failed URL
            {failedURLs.length !== 1 ? "s" : ""}
          </GhostButton>
        </div>
      )}

      {/* ── Results table ────────────────────────────────── */}
      {(results.length > 0 || scanning) && (
        <div className="pg-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="pg-section-title" style={{ margin: 0 }}>
              {scanning
                ? `Scanning... (${progress.done}/${progress.total})`
                : `Results — ${results.length} URLs scanned`}
            </div>
            {!scanning && results.length > 0 && (
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background:
                    summary.phishing > 0
                      ? "var(--red-dim)"
                      : "var(--green-dim)",
                  border: `1px solid ${summary.phishing > 0 ? "rgba(255,59,92,0.2)" : "rgba(16,185,129,0.2)"}`,
                  fontFamily: "var(--mono)",
                  fontSize: "10px",
                  color: summary.phishing > 0 ? "var(--red)" : "var(--green)",
                }}
              >
                {summary.phishing > 0
                  ? `${summary.phishing} threat${summary.phishing > 1 ? "s" : ""} found`
                  : "All clear ✓"}
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ minWidth: "520px" }}>
              <thead>
                <tr>
                  <th style={{ width: "40px", paddingLeft: "20px" }}>#</th>
                  <th>URL</th>
                  <th style={{ width: "110px" }}>Status</th>
                  <th style={{ width: "160px" }}>Reason</th>
                  <th style={{ width: "110px", paddingRight: "20px" }}>
                    Risk score
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{
                      animation: "fadeUp 0.2s ease both",
                      // IMPROVED: error rows have subtle red tint background
                      background: r.error
                        ? "rgba(255,59,92,0.03)"
                        : "transparent",
                    }}
                  >
                    <td
                      style={{
                        paddingLeft: "20px",
                        fontFamily: "var(--mono)",
                        fontSize: "10px",
                        color: "var(--text-3)",
                      }}
                    >
                      {i + 1}
                    </td>
                    <td style={{ maxWidth: "240px" }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--mono)",
                          fontSize: "11px",
                          color: r.error ? "var(--text-3)" : "var(--text)",
                        }}
                        title={r.url}
                      >
                        {r.url}
                      </span>
                    </td>
                    <td>
                      {r.error ? (
                        <span
                          className="pg-pill"
                          style={{
                            background: "rgba(255,59,92,0.08)",
                            color: "var(--red)",
                            border: "1px solid rgba(255,59,92,0.15)",
                          }}
                        >
                          ● error
                        </span>
                      ) : (
                        <span className={pillClass(r.status)}>
                          ● {r.status}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: "10px",
                        color: r.error ? "var(--red)" : "var(--text-2)",
                        maxWidth: "180px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.reason}
                    </td>
                    <td style={{ paddingRight: "20px" }}>
                      {r.error ? (
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: "10px",
                            color: "var(--text-3)",
                          }}
                        >
                          —
                        </span>
                      ) : (
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
                              maxWidth: "50px",
                              height: "4px",
                              background: "var(--track-bg)",
                              borderRadius: "4px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(r.confidence ?? r.risk_score ?? 0, 100)}%`,
                                background: statusColor(r.status),
                                borderRadius: "4px",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: "10px",
                              color: statusColor(r.status),
                              fontWeight: 700,
                              minWidth: "24px",
                            }}
                          >
                            {r.confidence || r.risk_score}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {pendingRows > 0 &&
                  Array.from({ length: pendingRows }).map((_, i) => (
                    <SkeletonRow key={`sk-${i}`} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {!scanning && results.length === 0 && !input.trim() && (
        <div className="pg-empty-state">
          <div
            style={{ fontSize: "42px", marginBottom: "16px", opacity: 0.25 }}
          >
            ⊞
          </div>
          <div
            style={{
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: "18px",
              color: "var(--text)",
              marginBottom: "8px",
            }}
          >
            No URLs entered yet
          </div>
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: "var(--text-3)",
              marginBottom: "20px",
            }}
          >
            Paste up to 50 URLs above and click Scan — results save to MySQL
            automatically
          </p>
          <GhostButton onClick={loadExample}>Load example URLs</GhostButton>
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
