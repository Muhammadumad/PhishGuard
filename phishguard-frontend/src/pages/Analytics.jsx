// src/pages/Analytics.jsx
// UX improvements:
//  + Refresh button — no more full page reload to see new data
//  + Empty state — clear message when user has 0 scans
//  + Fixed score subtitle — "0-100 scale" not "0-200"
//  + Avg risk score stat card — API already returns it
//  + Last updated timestamp shown in header
//  + Proper stat card skeletons instead of "—"
//  + Top threats pill uses actual verdict not hardcoded "phishing"
//  + Detection rate color coded (red/amber/green by value)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart, registerables } from "chart.js";
import {
  Activity,
  ArrowClockwise,
  BarChartLine,
  Calendar3,
  ChevronRight,
  GraphUp,
  LightningCharge,
  ShieldCheck,
  ShieldExclamation,
} from "react-bootstrap-icons";
import { fetchAnalytics, fetchHistory } from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";
import GhostButton from "../components/ui/GhostButton";
import useThemeStore from "../store/ThemeStore";
Chart.register(...registerables);

const RANGE_OPTIONS = [7, 14, 30];

function getChartTheme(theme) {
  const isLight = theme === "light";
  return {
    tooltip: {
      backgroundColor: isLight ? "#e6edf8" : "#0d1220",
      borderColor: isLight ? "rgba(16,37,63,0.12)" : "rgba(255,255,255,0.08)",
      borderWidth: 1,
      titleColor: isLight ? "#10253f" : "#e8ecf4",
      bodyColor: isLight ? "rgba(16,37,63,0.68)" : "rgba(232,236,244,0.55)",
      titleFont: { family: "JetBrains Mono", size: 11 },
      bodyFont: { family: "JetBrains Mono", size: 10 },
      padding: 10,
    },
    ticks: {
      color: isLight ? "rgba(11,28,49,0.6)" : "rgba(232,236,244,0.3)",
      font: { family: "JetBrains Mono", size: 10 },
    },
    grid: isLight ? "rgba(11,28,49,0.1)" : "rgba(255,255,255,0.04)",
    legend: isLight ? "rgba(11,28,49,0.8)" : "rgba(232,236,244,0.5)",
    donutBorder: isLight ? "#d4deec" : "#0d1220",
    donutFallback: isLight ? "rgba(16,37,63,0.14)" : "rgba(255,255,255,0.05)",
  };
}

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US").format(value ?? 0);

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAnchoredPopoverPosition(target) {
  if (!target || typeof target.getBoundingClientRect !== "function") {
    return null;
  }

  const rect = target.getBoundingClientRect();
  const width = Math.min(760, Math.max(360, window.innerWidth - 32));
  const left = Math.min(
    Math.max(16, rect.left),
    Math.max(16, window.innerWidth - width - 16),
  );
  const spaceBelow = window.innerHeight - rect.bottom;
  const heightEstimate = 420;
  const above = spaceBelow < heightEstimate && rect.top > heightEstimate;

  return {
    left,
    top: above ? rect.top : rect.bottom + 12,
    width,
    above,
  };
}

function buildTimelineSeries(dailyRows, rangeDays) {
  const byDate = new Map();
  const validRows = [...(dailyRows || [])].filter((entry) => {
    const dateStr = String(entry?.date || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  });

  validRows.forEach((entry) => {
    const key = entry.date;
    const current = byDate.get(key) || { phishing: 0, suspicious: 0, safe: 0 };
    current.phishing += entry.phishing || 0;
    current.suspicious += entry.suspicious || 0;
    current.safe += entry.safe || 0;
    byDate.set(key, current);
  });

  const latestDate = validRows.length
    ? new Date(
        validRows
          .map((entry) => entry.date)
          .sort()
          .at(-1),
      )
    : new Date();
  latestDate.setHours(0, 0, 0, 0);

  const buildWindow = (offsetDays) => {
    const points = [];
    for (let index = rangeDays - 1; index >= 0; index -= 1) {
      const day = new Date(latestDate);
      day.setDate(day.getDate() - offsetDays - index);
      const key = toDateKey(day);
      const item = byDate.get(key) || { phishing: 0, suspicious: 0, safe: 0 };
      const total = item.phishing + item.suspicious + item.safe;
      points.push({
        label: day.toLocaleDateString([], { month: "short", day: "numeric" }),
        date: day,
        phishing: item.phishing,
        suspicious: item.suspicious,
        safe: item.safe,
        total,
      });
    }
    return points;
  };

  const points = buildWindow(0);
  const previousPoints = buildWindow(rangeDays);
  const total = points.reduce((sum, point) => sum + point.total, 0);
  const previousTotal = previousPoints.reduce(
    (sum, point) => sum + point.total,
    0,
  );
  const peakPoint = points.reduce(
    (best, point) => (!best || point.total > best.total ? point : best),
    null,
  );

  return { points, total, previousTotal, peakPoint };
}

function getVerdictTone(verdict) {
  if (verdict === "phishing") return "var(--red)";
  if (verdict === "suspicious") return "var(--amber)";
  return "var(--green)";
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Skeleton({ height = 220, width = "100%", style = {} }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: "8px",
        background:
          "linear-gradient(90deg,var(--skeleton-base) 25%,var(--skeleton-hi) 50%,var(--skeleton-base) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading, icon, accent }) {
  return (
    <div
      className="pg-stat"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div className="pg-stat-label">{label}</div>
        {icon && (
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              background: accent || "rgba(38, 198, 255, 0.1)",
              color: color || "var(--cyan)",
              border: "1px solid var(--border)",
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton height={28} width="70px" style={{ margin: "2px 0" }} />
      ) : (
        <div className="pg-stat-value" style={{ color }}>
          {value}
        </div>
      )}
      <div className="pg-stat-sub">{sub}</div>
    </div>
  );
}

function InsightCard({ label, value, sub, icon, color }) {
  return (
    <div
      style={{
        background: "linear-gradient(170deg, var(--bg-card), var(--bg-card2))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "9px",
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {label}
        </div>
        <div style={{ color, opacity: 0.95 }}>{icon}</div>
      </div>
      <div
        style={{
          fontFamily: "var(--display)",
          fontSize: "24px",
          fontWeight: 800,
          lineHeight: 1,
          color: color || "var(--text)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "10px",
          color: "var(--text-3)",
          lineHeight: 1.6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, height = 230, loading, children }) {
  return (
    <div
      className="pg-card"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: "15px",
            color: "var(--text)",
            marginBottom: "3px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "10px",
            color: "var(--text-3)",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ height, position: "relative", flex: 1 }}>
        {loading ? <Skeleton height={height} /> : children}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.25 }}>
        ◎
      </div>
      <div
        style={{
          fontFamily: "var(--display)",
          fontWeight: 700,
          fontSize: "20px",
          color: "var(--text)",
          marginBottom: "10px",
        }}
      >
        No analytics yet
      </div>
      <p
        style={{
          fontFamily: "var(--mono)",
          fontSize: "11px",
          color: "var(--text-3)",
          lineHeight: 1.7,
          maxWidth: "340px",
          margin: "0 auto",
        }}
      >
        Scan some URLs on the Dashboard first. Analytics will appear here once
        you have at least one scan saved.
      </p>
    </div>
  );
}

function RecentScanRow({ item, index, onSelect }) {
  const verdict =
    item?.status === "phishing" ? "phishing" : item?.status || "safe";
  const score = item?.scan_result?.risk_score ?? 0;
  const scoreColor = getVerdictTone(verdict);
  const timeLabel = item?.time || item?.created_at || item?.createdAt || "—";

  return (
    <tr>
      <td
        style={{
          paddingLeft: "20px",
          fontFamily: "var(--mono)",
          fontSize: "10px",
          color: "var(--text-3)",
        }}
      >
        {index + 1}
      </td>
      <td>
        <button
          type="button"
          className="pg-url-row-btn"
          onClick={(event) => onSelect?.(item, event.currentTarget)}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: "var(--text)",
              display: "block",
              maxWidth: "280px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item?.url || item?.url_text || item?.url_display || "—"}
          </span>
          <ChevronRight
            size={12}
            style={{ color: "var(--text-3)", flexShrink: 0 }}
          />
        </button>
      </td>
      <td>
        <span
          className={
            verdict === "phishing"
              ? "pg-pill pg-pill-malicious"
              : verdict === "suspicious"
                ? "pg-pill pg-pill-suspicious"
                : "pg-pill pg-pill-clean"
          }
        >
          ● {verdict}
        </span>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              flex: 1,
              maxWidth: "70px",
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
                background: scoreColor,
                borderRadius: "4px",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: scoreColor,
              fontWeight: 700,
              minWidth: "30px",
            }}
          >
            {score}
          </span>
        </div>
      </td>
      <td
        style={{
          paddingRight: "20px",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          color: "var(--text-2)",
        }}
      >
        {timeLabel}
      </td>
    </tr>
  );
}

function DetailRow({ label, value, tone = "var(--text-2)" }) {
  return (
    <div className="pg-explain-row" style={{ marginBottom: "6px" }}>
      <span className="pg-explain-key">{label}</span>
      <span
        className="pg-explain-val"
        style={{
          color: tone,
          maxWidth: "70%",
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function AnalyticsDetailModal({ item, type, onClose, position }) {
  if (!item) return null;

  const url =
    type === "threat"
      ? item.url__url || item.url_display || "—"
      : item.url || item.url_text || item.url_display || "—";
  const verdict =
    type === "threat" ? item.verdict || "phishing" : item.status || "safe";
  const score =
    type === "threat"
      ? item.risk_score || 0
      : (item.scan_result?.risk_score ?? 0);
  const confidence =
    type === "threat" ? "N/A" : (item.scan_result?.confidence_score ?? "N/A");
  const reasons = type === "threat" ? [] : item.scan_result?.reasons || [];
  const hits = type === "threat" ? item.hits || 1 : null;
  const timeLabel =
    type === "threat"
      ? null
      : item.time || item.created_at || item.createdAt || "—";

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
              URL Details
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10px",
                color: "var(--text-3)",
                marginTop: "4px",
              }}
            >
              Clicked URL details from Analytics
            </div>
          </div>
          <div className="pg-row-wrap">
            <span
              className={
                verdict === "phishing"
                  ? "pg-pill pg-pill-malicious"
                  : verdict === "suspicious"
                    ? "pg-pill pg-pill-suspicious"
                    : "pg-pill pg-pill-clean"
              }
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
            <DetailRow label="URL" value={url} />
            <DetailRow
              label="Risk Score"
              value={`${score}/100`}
              tone={getVerdictTone(verdict)}
            />
            <DetailRow
              label="Confidence"
              value={confidence === "N/A" ? "N/A" : `${confidence}/100`}
            />
            <DetailRow
              label="Verdict"
              value={String(verdict).toUpperCase()}
              tone={getVerdictTone(verdict)}
            />
          </div>

          <div className="pg-explain">
            {type === "threat" ? (
              <>
                <DetailRow label="Hits" value={`${hits}×`} />
                <DetailRow label="Source Type" value="Top threat source" />
                <DetailRow
                  label="Stored As"
                  value={item.id || item.url__url || "domain"}
                />
              </>
            ) : (
              <>
                <DetailRow label="Stored At" value={timeLabel} />
                <DetailRow
                  label="Risk Band"
                  value={
                    item?.scan_result
                      ? `${score >= 81 ? "Critical" : score >= 61 ? "High" : score >= 41 ? "Moderate" : score >= 21 ? "Low" : "Minimal"}`
                      : "—"
                  }
                />
                <DetailRow label="Stored As" value={item.id || "latest"} />
              </>
            )}
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
                    style={{
                      color: getVerdictTone(verdict),
                      marginRight: "6px",
                    }}
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

export default function Analytics() {
  const { theme } = useThemeStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeDays, setRangeDays] = useState(7);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [recentScanTotal, setRecentScanTotal] = useState(0);
  const [selectedAnalyticsItem, setSelectedAnalyticsItem] = useState(null);
  const [analyticsDetailPosition, setAnalyticsDetailPosition] = useState(null);

  const lineChartRef = useRef(null);
  const donutChartRef = useRef(null);
  const barChartRef = useRef(null);
  const lineCanvasRef = useRef(null);
  const donutCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);

  const summary = data?.summary || {};
  const scanTotal = summary.total ?? 0;
  const verdictBreakdown = useMemo(
    () =>
      (data?.by_verdict || []).reduce((acc, entry) => {
        acc[entry.verdict || "unknown"] = entry.count || 0;
        return acc;
      }, {}),
    [data],
  );
  const dominantVerdict = useMemo(() => {
    const verdicts = data?.by_verdict || [];
    if (!verdicts.length) return { verdict: "safe", count: 0 };
    return verdicts.reduce(
      (best, entry) => ((entry.count || 0) > (best.count || 0) ? entry : best),
      verdicts[0],
    );
  }, [data]);
  const timeline = useMemo(
    () => buildTimelineSeries(data?.daily || [], rangeDays),
    [data, rangeDays],
  );
  const summaryTotals = {
    phishing: summary.phishing ?? verdictBreakdown.phishing ?? 0,
    suspicious: summary.suspicious ?? verdictBreakdown.suspicious ?? 0,
    safe: summary.safe ?? verdictBreakdown.safe ?? 0,
  };
  const threatTotal =
    summary.threats ?? summaryTotals.phishing + summaryTotals.suspicious;
  const threatRate = scanTotal > 0 ? (threatTotal / scanTotal) * 100 : 0;
  const safeRate = scanTotal > 0 ? (summaryTotals.safe / scanTotal) * 100 : 0;
  const highRiskTotal =
    (data?.score_dist?.["61-80"] || 0) + (data?.score_dist?.["81-100"] || 0);
  const highRiskRate = scanTotal > 0 ? (highRiskTotal / scanTotal) * 100 : 0;
  const trendDelta =
    timeline.previousTotal > 0
      ? ((timeline.total - timeline.previousTotal) / timeline.previousTotal) *
        100
      : null;
  const trendDirection =
    trendDelta == null
      ? "steady"
      : trendDelta > 0
        ? "up"
        : trendDelta < 0
          ? "down"
          : "steady";
  const peakLabel = timeline.peakPoint
    ? `${timeline.peakPoint.label} · ${timeline.peakPoint.total} scans`
    : "No activity yet";

  const destroyCharts = () => {
    if (lineChartRef.current) {
      lineChartRef.current.destroy();
      lineChartRef.current = null;
    }
    if (donutChartRef.current) {
      donutChartRef.current.destroy();
      donutChartRef.current = null;
    }
    if (barChartRef.current) {
      barChartRef.current.destroy();
      barChartRef.current = null;
    }
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [d, history] = await Promise.all([
        fetchAnalytics(),
        fetchHistory({ page: 1, page_size: 5, sort: "newest" }),
      ]);
      setData(d);
      setRecentScans(history?.results || []);
      setRecentScanTotal(history?.total || 0);
      setLastUpdated(new Date());
    } catch {
      setError("Could not load analytics. Make sure Django is running.");
      setRecentScans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const dismissed =
      localStorage.getItem("pg_analytics_onboarding_dismissed") === "1";
    setShowOnboarding(!dismissed);
  }, []);

  // ── Build charts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || loading) {
      destroyCharts();
      return;
    }
    destroyCharts();
    const chartTheme = getChartTheme(theme);

    if (scanTotal === 0) return;

    // ── Line chart — daily trends ────────────────────────────────────────
    if (lineCanvasRef.current) {
      const selectedDays = timeline.points;
      lineChartRef.current = new Chart(lineCanvasRef.current, {
        type: "line",
        data: {
          labels: selectedDays.map((point) => point.label),
          datasets: [
            {
              label: "Phishing",
              data: selectedDays.map((point) => point.phishing),
              borderColor: "#ff3b5c",
              backgroundColor: "rgba(255,59,92,0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#ff3b5c",
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
            },
            {
              label: "Suspicious",
              data: selectedDays.map((point) => point.suspicious),
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245,158,11,0.08)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#f59e0b",
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
            },
            {
              label: "Safe",
              data: selectedDays.map((point) => point.safe),
              borderColor: "#10b981",
              backgroundColor: "rgba(16,185,129,0.07)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#10b981",
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              labels: {
                color: chartTheme.legend,
                font: { family: "JetBrains Mono", size: 10 },
                boxWidth: 12,
                padding: 16,
              },
            },
            tooltip: chartTheme.tooltip,
          },
          scales: {
            x: {
              grid: { color: chartTheme.grid },
              ticks: chartTheme.ticks,
              border: { color: chartTheme.grid },
            },
            y: {
              grid: { color: chartTheme.grid },
              ticks: { ...chartTheme.ticks, stepSize: 1 },
              border: { color: chartTheme.grid },
              beginAtZero: true,
            },
          },
        },
      });
    }

    // ── Donut chart — verdict breakdown ──────────────────────────────────
    if (donutCanvasRef.current) {
      const verdicts = data.by_verdict || [];
      const labels = verdicts.map((v) => v.verdict || "Unknown");
      const values = verdicts.map((v) => v.count || 0);
      const colors = labels.map((l) =>
        l === "phishing"
          ? "#ff3b5c"
          : l === "suspicious"
            ? "#f59e0b"
            : l === "safe"
              ? "#10b981"
              : "#60a5fa",
      );
      donutChartRef.current = new Chart(donutCanvasRef.current, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values.length ? values : [1],
              backgroundColor: values.length
                ? colors
                : [chartTheme.donutFallback],
              borderColor: chartTheme.donutBorder,
              borderWidth: 3,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: {
              position: "right",
              labels: {
                color: chartTheme.legend,
                font: { family: "JetBrains Mono", size: 10 },
                boxWidth: 10,
                padding: 12,
              },
            },
            tooltip: values.length ? chartTheme.tooltip : { enabled: false },
          },
        },
      });
    }

    // ── Bar chart — risk score distribution ──────────────────────────────
    if (barCanvasRef.current) {
      const dist = data.score_dist || {};
      const labels = ["0–20", "21–40", "41–60", "61–80", "81–100"];
      const values = ["0-20", "21-40", "41-60", "61-80", "81-100"].map(
        (k) => dist[k] || 0,
      );
      barChartRef.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "URLs",
              data: values,
              backgroundColor: [
                "rgba(16,185,129,0.75)",
                "rgba(16,185,129,0.45)",
                "rgba(245,158,11,0.65)",
                "rgba(255,59,92,0.55)",
                "rgba(255,59,92,0.9)",
              ],
              borderColor: [
                "#10b981",
                "#10b981",
                "#f59e0b",
                "#ff3b5c",
                "#ff3b5c",
              ],
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...chartTheme.tooltip,
              callbacks: {
                label: (ctx) => ` ${ctx.raw} URL${ctx.raw !== 1 ? "s" : ""}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: chartTheme.ticks,
              border: { color: chartTheme.grid },
            },
            y: {
              grid: { color: chartTheme.grid },
              ticks: { ...chartTheme.ticks, stepSize: 1 },
              border: { color: chartTheme.grid },
              beginAtZero: true,
            },
          },
        },
      });
    }

    return () => destroyCharts();
  }, [data, loading, scanTotal, timeline.points, theme]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isEmpty = !loading && scanTotal === 0;

  const detectionRate = summary.detection_rate ?? 0;
  const detectionColor =
    detectionRate >= 50
      ? "var(--red)"
      : detectionRate >= 20
        ? "var(--amber)"
        : "var(--green)";

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const rangeSubtitle = `Selected window: last ${rangeDays} day${rangeDays !== 1 ? "s" : ""}`;
  const trendSubtitle =
    trendDelta == null
      ? `Compared with the prior ${rangeDays}-day window when available`
      : `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}% vs prior ${rangeDays}-day window`;
  const lineHasActivity = timeline.points.some((point) => point.total > 0);

  // verdict pill class helper — uses actual verdict not hardcoded
  const pillClass = (verdict) => {
    if (verdict === "phishing") return "pg-pill pg-pill-malicious";
    if (verdict === "suspicious") return "pg-pill pg-pill-suspicious";
    return "pg-pill pg-pill-clean";
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_analytics_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  const loadRecentScans = useCallback(async () => {
    try {
      const history = await fetchHistory({
        page: 1,
        page_size: 5,
        sort: "newest",
      });
      setRecentScans(history?.results || []);
      setRecentScanTotal(history?.total || 0);
    } catch {
      setRecentScans([]);
    }
  }, []);

  useEffect(() => {
    loadRecentScans();

    const refreshRecent = window.setInterval(() => {
      if (document.hidden) return;
      loadRecentScans();
    }, 15000);

    return () => window.clearInterval(refreshRecent);
  }, [loadRecentScans]);

  return (
    <main className="pg-main pg-page-analytics fade-up">
      <div
        className="pg-row-wrap"
        style={{ justifyContent: "flex-end", marginBottom: "14px" }}
      >
        {RANGE_OPTIONS.map((option) => (
          <GhostButton
            key={option}
            onClick={() => setRangeDays(option)}
            className={option === rangeDays ? "active" : ""}
          >
            {option}d
          </GhostButton>
        ))}
        <GhostButton
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          <ArrowClockwise size={13} className={refreshing ? "spin" : ""} />{" "}
          {refreshing ? "Refreshing..." : "Refresh"}
        </GhostButton>
      </div>

      {showOnboarding && (
        <div className="pg-onboard">
          <div
            className="pg-row-between"
            style={{ marginBottom: "8px", alignItems: "flex-start" }}
          >
            <div>
              <div className="pg-onboard-title">Analytics Guide</div>
              <div className="pg-onboard-copy">
                Understand threat trends and react quickly to rising risk.
              </div>
            </div>
            <button className="pg-btn-ghost" onClick={dismissOnboarding}>
              Hide
            </button>
          </div>
          <div className="pg-onboard-list">
            <div className="pg-onboard-item">
              1. Switch between 7d, 14d, and 30d ranges.
            </div>
            <div className="pg-onboard-item">
              2. Track threat ratio and high-risk share.
            </div>
            <div className="pg-onboard-item">
              3. Use top threat sources to prioritize actions.
            </div>
          </div>
        </div>
      )}

      <div
        className="pg-card"
        style={{
          marginBottom: "20px",
          padding: "20px",
          background:
            "linear-gradient(165deg, var(--bg-card), var(--bg-card2))",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
          }}
        >
          <InsightCard
            label="Threat ratio"
            value={`${threatRate.toFixed(1)}%`}
            sub={`${formatNumber(threatTotal)} of ${formatNumber(scanTotal)} scans flagged as phishing or suspicious`}
            icon={<ShieldExclamation size={18} />}
            color="var(--red)"
          />
          <InsightCard
            label="Safe coverage"
            value={`${safeRate.toFixed(1)}%`}
            sub={`${formatNumber(summaryTotals.safe)} safe URLs recorded in the selected window`}
            icon={<ShieldCheck size={18} />}
            color="var(--green)"
          />
          <InsightCard
            label="High-risk share"
            value={`${highRiskRate.toFixed(1)}%`}
            sub={`${formatNumber(highRiskTotal)} URLs scored above 60 risk in the full dataset`}
            icon={<LightningCharge size={18} />}
            color="var(--amber)"
          />
          <InsightCard
            label="Peak activity"
            value={peakLabel}
            sub={`Window trend is ${trendDirection === "up" ? "rising" : trendDirection === "down" ? "cooling" : "stable"}`}
            icon={<Calendar3 size={18} />}
            color="var(--cyan)"
          />
        </div>
        <div
          className="pg-row-between"
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: "620px" }}>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--text)",
                marginBottom: "4px",
              }}
            >
              {trendDelta == null
                ? "Trend comparison is waiting on more history"
                : trendDelta > 0
                  ? "Threat activity is trending up"
                  : trendDelta < 0
                    ? "Threat activity has eased"
                    : "Threat activity is unchanged"}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10px",
                color: "var(--text-3)",
                lineHeight: 1.7,
              }}
            >
              {trendSubtitle} · dominant verdict:{" "}
              {dominantVerdict.verdict || "safe"} (
              {formatNumber(dominantVerdict.count || 0)} events)
            </div>
          </div>
          <div className="pg-row-wrap" style={{ justifyContent: "flex-end" }}>
            <span className="pg-pill pg-pill-clean">
              <GraphUp size={11} /> {formatNumber(timeline.total)} window scans
            </span>
            <span className="pg-pill pg-pill-suspicious">
              <BarChartLine size={11} /> {formatNumber(summary.avg_risk ?? 0)}{" "}
              avg risk
            </span>
          </div>
        </div>
      </div>

      {/* ── Recent stored scans ────────────────────────── */}
      <div
        className="pg-card"
        style={{ padding: 0, overflow: "hidden", marginBottom: "16px" }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: "15px",
                color: "var(--text)",
                marginBottom: "2px",
              }}
            >
              Recent stored scans
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: "10px",
              color: "var(--text-3)",
            }}
          >
            {recentScanTotal > 0
              ? `${recentScanTotal} stored scan${recentScanTotal !== 1 ? "s" : ""}`
              : "No stored scans yet"}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pg-table" style={{ minWidth: "520px" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: "20px", width: "40px" }}>#</th>
                <th>URL</th>
                <th style={{ width: "110px" }}>Verdict</th>
                <th style={{ width: "140px" }}>Risk score</th>
                <th style={{ paddingRight: "20px", width: "150px" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[40, 280, 90, 110, 150].map((w, j) => (
                      <td key={j} style={{ padding: "14px 16px" }}>
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
                ))
              ) : recentScans.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "var(--text-3)",
                      fontFamily: "var(--mono)",
                      fontSize: "12px",
                    }}
                  >
                    Scan a URL on the Dashboard to store the latest result here
                  </td>
                </tr>
              ) : (
                recentScans.map((item, i) => (
                  <RecentScanRow
                    key={item?.id || i}
                    item={item}
                    index={i}
                    onSelect={(row, target) => {
                      setSelectedAnalyticsItem({ type: "scan", item: row });
                      setAnalyticsDetailPosition(
                        getAnchoredPopoverPosition(target),
                      );
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAnalyticsItem && (
        <AnalyticsDetailModal
          type={selectedAnalyticsItem.type}
          item={selectedAnalyticsItem.item}
          position={analyticsDetailPosition}
          onClose={() => {
            setSelectedAnalyticsItem(null);
            setAnalyticsDetailPosition(null);
          }}
        />
      )}

      {/* ── Error ───────────────────────────────────────── */}
      <StatusAlert message={error} onClose={() => load(true)} />

      {/* ── Stat cards — 5 cards including avg risk ──────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          label="Total Scanned"
          value={formatNumber(summary.total ?? 0)}
          sub="all time"
          color="var(--text)"
          loading={loading}
          icon={<Activity size={14} />}
          accent="rgba(38,198,255,0.12)"
        />
        <StatCard
          label="Threats Found"
          value={formatNumber(summary.threats ?? 0)}
          sub="phishing + suspicious"
          color="var(--red)"
          loading={loading}
          icon={<ShieldExclamation size={14} />}
          accent="rgba(255,59,92,0.12)"
        />
        <StatCard
          label="Detection Rate"
          value={`${summary.detection_rate ?? 0}%`}
          sub="of all scans"
          color={loading ? "var(--text)" : detectionColor}
          loading={loading}
          icon={<LightningCharge size={14} />}
          accent="rgba(245,158,11,0.12)"
        />
        <StatCard
          label="Avg Risk Score"
          value={formatNumber(summary.avg_risk ?? 0)}
          sub="across all scans"
          color="var(--amber)"
          loading={loading}
          icon={<BarChartLine size={14} />}
          accent="rgba(245,158,11,0.12)"
        />
        <StatCard
          label="Unique Threats"
          value={formatNumber(data?.top_threats?.length ?? 0)}
          sub="distinct domains"
          color="var(--green)"
          loading={loading}
          icon={<ShieldCheck size={14} />}
          accent="rgba(25,211,139,0.12)"
        />
      </div>

      {/* ── Empty state ─────────────────────────────────── */}
      {isEmpty && !error && <EmptyState />}

      {/* ── Charts — only show when data exists ─────────── */}
      {!isEmpty && (
        <>
          {/* Line chart — full width */}
          <div style={{ marginBottom: "20px" }}>
            <ChartCard
              title="Daily scan trends"
              subtitle={`Last ${rangeDays} days — phishing, suspicious and safe verdicts`}
              height={240}
              loading={loading}
            >
              <div style={{ position: "relative", height: "100%" }}>
                <canvas ref={lineCanvasRef} />
                {!loading && lineHasActivity === false && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      background: "rgba(7, 12, 21, 0.28)",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text)",
                          marginBottom: "4px",
                        }}
                      >
                        No activity in this range
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: "10px",
                          color: "var(--text-3)",
                          lineHeight: 1.7,
                        }}
                      >
                        Try switching to 14d or 30d, or refresh after new scans
                        are added.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ChartCard>
          </div>

          {/* Donut + Bar — side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginBottom: "20px",
            }}
          >
            <ChartCard
              title="Verdict breakdown"
              subtitle="Distribution of all scan verdicts"
              height={220}
              loading={loading}
            >
              <canvas ref={donutCanvasRef} />
            </ChartCard>
            {/* FIXED subtitle: 0-100 scale not 0-200 */}
            <ChartCard
              title="Risk score distribution"
              subtitle="URLs grouped by risk band (0–100 scale)"
              height={220}
              loading={loading}
            >
              <canvas ref={barCanvasRef} />
            </ChartCard>
          </div>

          {/* Top threats table */}
          <div
            className="pg-card"
            style={{ padding: 0, overflow: "hidden", marginBottom: "16px" }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 700,
                    fontSize: "15px",
                    color: "var(--text)",
                    marginBottom: "2px",
                  }}
                >
                  Top threat sources
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--text-3)",
                  }}
                >
                  Highest risk phishing domains from your scan history
                </div>
              </div>
              {!loading && data?.top_threats?.length > 0 && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    color: "var(--text-3)",
                  }}
                >
                  {data.top_threats.length} domain
                  {data.top_threats.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="pg-table" style={{ minWidth: "480px" }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: "20px", width: "40px" }}>#</th>
                    <th>Domain</th>
                    <th style={{ width: "110px" }}>Verdict</th>
                    <th style={{ width: "140px" }}>Risk score</th>
                    <th style={{ paddingRight: "20px", width: "70px" }}>
                      Hits
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        {[40, 220, 90, 110, 50].map((w, j) => (
                          <td key={j} style={{ padding: "14px 16px" }}>
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
                    ))
                  ) : !data?.top_threats?.length ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          padding: "40px",
                          color: "var(--text-3)",
                          fontFamily: "var(--mono)",
                          fontSize: "12px",
                        }}
                      >
                        No phishing threats detected yet — scan some URLs to see
                        data here
                      </td>
                    </tr>
                  ) : (
                    data.top_threats.map((row, i) => {
                      // FIXED: use actual verdict from row, not hardcoded "phishing"
                      const verdict = row.verdict || "phishing";
                      const score = row.risk_score || 0;
                      const scoreColor = getVerdictTone(verdict);

                      return (
                        <tr key={i}>
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
                          <td>
                            <button
                              type="button"
                              className="pg-url-row-btn"
                              onClick={(event) => {
                                setSelectedAnalyticsItem({
                                  type: "threat",
                                  item: row,
                                });
                                setAnalyticsDetailPosition(
                                  getAnchoredPopoverPosition(
                                    event.currentTarget,
                                  ),
                                );
                              }}
                              style={{ justifyContent: "flex-start" }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontSize: "11px",
                                  color: "var(--text)",
                                  display: "block",
                                  maxWidth: "260px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.url__url || row.url_display || "—"}
                              </span>
                              <ChevronRight
                                size={12}
                                style={{
                                  color: "var(--text-3)",
                                  flexShrink: 0,
                                }}
                              />
                            </button>
                          </td>
                          <td>
                            {/* FIXED: uses actual verdict not hardcoded */}
                            <span className={pillClass(verdict)}>
                              ● {verdict}
                            </span>
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
                                  maxWidth: "70px",
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
                                    background: scoreColor,
                                    borderRadius: "4px",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontSize: "11px",
                                  color: scoreColor,
                                  fontWeight: 700,
                                  minWidth: "30px",
                                }}
                              >
                                {score}
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              paddingRight: "20px",
                              fontFamily: "var(--mono)",
                              fontSize: "11px",
                              color: "var(--text-2)",
                            }}
                          >
                            {row.hits || 1}×
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <p
        style={{
          textAlign: "center",
          fontFamily: "var(--mono)",
          fontSize: "10px",
          color: "var(--text-3)",
          letterSpacing: "0.5px",
          paddingBottom: "16px",
        }}
      >
        Live data from MySQL · click Refresh to reload
      </p>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </main>
  );
}
