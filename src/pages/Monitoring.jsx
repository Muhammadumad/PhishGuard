// src/pages/Monitoring.jsx — Admin Real-Time Monitoring Dashboard
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowClockwise,
  Clipboard2Data,
  GeoAlt,
  Laptop,
  People,
  PersonFill,
  Search,
  ShieldExclamation,
  Wifi,
} from "react-bootstrap-icons";
import useAuthStore from "../store/AuthStore";

/* ── API base pointing to Django backend ────────────────────────────────────── */
const BACKEND =
  import.meta.env.VITE_DJANGO_ORIGIN ||
  "https://phishguard-api-g2df.onrender.com";

async function monitoringFetch(path) {
  const token = localStorage.getItem("pg_access");
  const res = await fetch(`${BACKEND}/api/monitoring${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* ── Small helpers ──────────────────────────────────────────────────────────── */
function fmt(n) {
  return (n ?? 0).toLocaleString();
}

function relTime(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function VerdictBadge({ verdict }) {
  const v = (verdict || "").toLowerCase();
  const colors = {
    phishing: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Phishing" },
    suspicious: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", label: "Suspicious" },
    safe: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Safe" },
  };
  const c = colors[v] || { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: verdict || "Unknown" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {c.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "#4f9eff" }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color, opacity: 0.9 }}>
        <Icon size={16} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(200,214,234,0.6)" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#e8ecf4", lineHeight: 1.1 }}>
        {fmt(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: "rgba(200,214,234,0.5)" }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, extra }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4f9eff", fontWeight: 700, fontSize: 14 }}>
          <Icon size={15} />
          {title}
        </div>
        {extra}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function Table({ cols, rows, empty = "No data yet." }) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(200,214,234,0.4)", fontSize: 13 }}>
        {empty}
      </div>
    );
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c.key}
              style={{
                padding: "10px 16px",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(200,214,234,0.5)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {cols.map((c) => (
              <td
                key={c.key}
                style={{ padding: "10px 16px", color: "#c8d6ea", verticalAlign: "middle" }}
              >
                {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "live",     label: "Live Feed", icon: Wifi },
  { id: "searches", label: "URL Searches", icon: Search },
  { id: "visitors", label: "Visitors", icon: People },
  { id: "users",    label: "Users", icon: PersonFill },
  { id: "geo",      label: "Geography", icon: GeoAlt },
];

/* ══════════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════════ */
export default function Monitoring() {
  const { user } = useAuthStore();
  const [tab, setTab]         = useState("overview");
  const [stats, setStats]     = useState(null);
  const [live, setLive]       = useState([]);
  const [searches, setSearches] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [users, setUsers]     = useState([]);
  const [geo, setGeo]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [s, l, sr, v, u, g] = await Promise.all([
        monitoringFetch("/stats/"),
        monitoringFetch("/live/?limit=50"),
        monitoringFetch("/searches/?per_page=50"),
        monitoringFetch("/visitors/?per_page=50"),
        monitoringFetch("/users/?per_page=50"),
        monitoringFetch("/geo/?days=30"),
      ]);
      setStats(s);
      setLive(l.results || []);
      setSearches(sr.results || []);
      setVisitors(v.results || []);
      setUsers(u.results || []);
      setGeo(g.results || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(`Failed to load data: ${e.message}. Make sure you are signed in as Admin.`);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial load + 30s auto-refresh */
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  /* ── Access check ──────────────────────────────────────────────────────── */
  if (user?.role !== "admin") {
    return (
      <main className="pg-main fade-up" style={{ padding: 40, textAlign: "center" }}>
        <ShieldExclamation size={48} color="#ef4444" />
        <h2 style={{ color: "#ef4444", marginTop: 16 }}>Admin Access Only</h2>
        <p style={{ color: "rgba(200,214,234,0.5)", marginTop: 8 }}>
          This page is restricted to administrators.
        </p>
      </main>
    );
  }

  const containerStyle = {
    padding: "20px 24px",
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily: "Inter, sans-serif",
    color: "#e8ecf4",
  };

  /* ── Error state ─────────────────────────────────────────────────────── */
  if (error && !stats) {
    return (
      <main className="pg-main fade-up">
        <div style={containerStyle}>
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12,
              padding: "20px 24px",
              color: "#ef4444",
              marginTop: 20,
            }}
          >
            <strong>⚠ Error:</strong> {error}
            <br />
            <button
              onClick={() => load()}
              style={{
                marginTop: 12,
                padding: "8px 16px",
                background: "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 8,
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── Header ─────────────────────────────────────────────────────────── */
  return (
    <main className="pg-main fade-up">
      <div style={containerStyle}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                background: "linear-gradient(135deg, #4f9eff, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🛡️ PhishGuard Monitoring
            </h1>
            <p style={{ margin: "4px 0 0", color: "rgba(200,214,234,0.5)", fontSize: 13 }}>
              Real-time visitor analytics &amp; scan monitoring
              {lastRefresh && ` · Updated ${relTime(lastRefresh)}`}
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "rgba(79,158,255,0.15)",
              border: "1px solid rgba(79,158,255,0.3)",
              borderRadius: 8,
              color: "#4f9eff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <ArrowClockwise size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexWrap: "wrap",
          }}
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: tab === id ? "2px solid #4f9eff" : "2px solid transparent",
                color: tab === id ? "#4f9eff" : "rgba(200,214,234,0.5)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: tab === id ? 700 : 500,
                transition: "all 0.15s",
                marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && !stats && (
          <div style={{ color: "rgba(200,214,234,0.4)", textAlign: "center", padding: 60, fontSize: 14 }}>
            Loading monitoring data…
          </div>
        )}

        {/* ── Overview ─────────────────────────────────────────────────── */}
        {tab === "overview" && stats && (
          <>
            {/* Stat cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 14,
                marginBottom: 24,
              }}
            >
              <StatCard icon={Wifi}     label="Total Visits"   value={stats.visits?.total}       sub="All time" color="#4f9eff" />
              <StatCard icon={Wifi}     label="Visits (24h)"   value={stats.visits?.last_24h}    sub="Last 24 hours" color="#60a5fa" />
              <StatCard icon={People}   label="Unique IPs"     value={stats.visits?.unique_ips}  sub="24h window" color="#a78bfa" />
              <StatCard icon={Search}   label="Total Scans"    value={stats.scans?.total}        sub="All time" color="#34d399" />
              <StatCard icon={ShieldExclamation} label="Phishing" value={stats.scans?.phishing} sub="Detected" color="#ef4444" />
              <StatCard icon={Clipboard2Data}    label="Users"    value={stats.users?.total}      sub="Registered" color="#f59e0b" />
            </div>

            {/* Geo + device rows */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <SectionCard title="Top Countries" icon={GeoAlt}>
                <div style={{ padding: "12px 16px" }}>
                  {geo.slice(0, 8).map((g, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#c8d6ea" }}>{g.country || "Unknown"}</span>
                      <span
                        style={{
                          background: "rgba(79,158,255,0.15)",
                          color: "#4f9eff",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {fmt(g.visits)}
                      </span>
                    </div>
                  ))}
                  {geo.length === 0 && (
                    <div style={{ color: "rgba(200,214,234,0.4)", fontSize: 13, padding: "12px 0" }}>
                      No geo data yet. Geo data populates as users visit from different countries.
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Verdict Breakdown" icon={ShieldExclamation}>
                <div style={{ padding: "12px 16px" }}>
                  {[
                    { label: "Phishing", val: stats.scans?.phishing, color: "#ef4444" },
                    { label: "Suspicious", val: stats.scans?.suspicious, color: "#f59e0b" },
                    { label: "Safe", val: stats.scans?.safe, color: "#22c55e" },
                  ].map(({ label, val, color }) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: "#c8d6ea" }}>{label}</span>
                      <span style={{ color, fontWeight: 700, fontSize: 18 }}>{fmt(val)}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      fontSize: 13,
                      color: "rgba(200,214,234,0.5)",
                    }}
                  >
                    <span>Total Scans</span>
                    <span style={{ fontWeight: 700, color: "#e8ecf4" }}>{fmt(stats.scans?.total)}</span>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {/* ── Live Feed ─────────────────────────────────────────────────── */}
        {tab === "live" && (
          <SectionCard
            title="Live Visitor Feed"
            icon={Wifi}
            extra={
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "#22c55e",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "pulse 2s infinite",
                  }}
                />
                Auto-refreshes every 30s
              </span>
            }
          >
            <Table
              cols={[
                { key: "timestamp", label: "Time", render: (v) => relTime(v) },
                { key: "user_display", label: "User" },
                { key: "ip_address", label: "IP" },
                { key: "path", label: "Path" },
                { key: "method", label: "Method" },
                { key: "status_code", label: "Status", render: (v) => (
                  <span style={{ color: v >= 400 ? "#ef4444" : v >= 300 ? "#f59e0b" : "#22c55e", fontWeight: 700 }}>
                    {v}
                  </span>
                )},
                { key: "browser", label: "Browser" },
                { key: "country", label: "Country" },
              ]}
              rows={live}
              empty="No recent activity. Activity appears here as users visit the site."
            />
          </SectionCard>
        )}

        {/* ── URL Searches ───────────────────────────────────────────────── */}
        {tab === "searches" && (
          <SectionCard title="URL Scan History" icon={Search}>
            <Table
              cols={[
                { key: "date_submitted", label: "Date", render: (v) => relTime(v) },
                { key: "url", label: "URL", render: (v) => (
                  <span
                    style={{
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                      verticalAlign: "middle",
                    }}
                    title={v}
                  >
                    {v}
                  </span>
                )},
                { key: "submitted_by_email", label: "User" },
                { key: "verdict", label: "Verdict", render: (v) => <VerdictBadge verdict={v} /> },
                { key: "confidence_score", label: "Score", render: (v) => v != null ? `${v}%` : "—" },
              ]}
              rows={searches}
              empty="No URL scans yet."
            />
          </SectionCard>
        )}

        {/* ── Visitors ─────────────────────────────────────────────────── */}
        {tab === "visitors" && (
          <SectionCard title="Visitor Log" icon={People}>
            <Table
              cols={[
                { key: "timestamp", label: "Time", render: (v) => relTime(v) },
                { key: "ip_address", label: "IP Address" },
                { key: "user_display", label: "User" },
                { key: "path", label: "Path" },
                { key: "device_type", label: "Device", render: (v) => (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Laptop size={12} /> {v || "desktop"}
                  </span>
                )},
                { key: "browser", label: "Browser" },
                { key: "country", label: "Country" },
                { key: "city", label: "City" },
              ]}
              rows={visitors}
              empty="No visitor data yet."
            />
          </SectionCard>
        )}

        {/* ── Users ────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <SectionCard title="Registered Users" icon={PersonFill}>
            <Table
              cols={[
                { key: "email", label: "Email" },
                { key: "username", label: "Username" },
                { key: "role", label: "Role", render: (v) => (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: v === "admin" ? "rgba(167,139,250,0.15)" : "rgba(79,158,255,0.1)",
                      color: v === "admin" ? "#a78bfa" : "#4f9eff",
                    }}
                  >
                    {v?.toUpperCase()}
                  </span>
                )},
                { key: "date_joined", label: "Joined", render: (v) => relTime(v) },
                { key: "last_login", label: "Last Login", render: (v) => relTime(v) },
                { key: "total_scans", label: "Scans", render: (v) => fmt(v) },
                { key: "total_visits", label: "Visits", render: (v) => fmt(v) },
              ]}
              rows={users}
              empty="No users found."
            />
          </SectionCard>
        )}

        {/* ── Geography ────────────────────────────────────────────────── */}
        {tab === "geo" && (
          <SectionCard title="Visitor Geography (Last 30 Days)" icon={GeoAlt}>
            <Table
              cols={[
                { key: "country", label: "Country" },
                { key: "country_code", label: "Code" },
                { key: "visits", label: "Visits", render: (v) => fmt(v) },
                { key: "unique_ips", label: "Unique IPs", render: (v) => fmt(v) },
                { key: "visits", label: "Bar", render: (v, row) => {
                  const max = Math.max(...geo.map((g) => g.visits), 1);
                  const pct = Math.round((v / max) * 100);
                  return (
                    <div style={{ width: 100, background: "rgba(255,255,255,0.07)", borderRadius: 4, height: 8 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #4f9eff, #a78bfa)",
                          borderRadius: 4,
                          transition: "width 0.4s",
                        }}
                      />
                    </div>
                  );
                }},
              ]}
              rows={geo}
              empty="No geographic data yet."
            />
          </SectionCard>
        )}

        {/* spin keyframes */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
        `}</style>
      </div>
    </main>
  );
}
