import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, ClipboardList, MapPin, Laptop, Users, User, Search, ShieldAlert, Wifi, Globe, Server, UserCircle, Key } from "lucide-react";
import useAuthStore from "../store/AuthStore";

const BACKEND = import.meta.env.VITE_DJANGO_ORIGIN || "https://phishguard-api-g2df.onrender.com";

async function monitoringFetch(path: string) {
  const token = localStorage.getItem("pg_access");
  const res = await fetch(`${BACKEND}/api/monitoring${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString();
}

function relTime(ts: string) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const v = (verdict || "").toLowerCase();
  
  if (v === "phishing") {
    return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wider">Phishing</span>;
  }
  if (v === "suspicious") {
    return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">Suspicious</span>;
  }
  if (v === "safe") {
    return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">Safe</span>;
  }
  
  return <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground border border-border uppercase tracking-wider">{verdict || "Unknown"}</span>;
}

function StatCard({ icon: Icon, label, value, sub, colorClass, bgClass }: any) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 relative overflow-hidden transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>{fmt(value)}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, extra }: any) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        {extra}
      </div>
      <div className="overflow-x-auto flex-1">
        {children}
      </div>
    </div>
  );
}

function Table({ cols, rows, empty = "No data yet." }: any) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground text-sm">
        <ClipboardList className="h-8 w-8 opacity-20 mb-3" />
        {empty}
      </div>
    );
  }
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
        <tr>
          {cols.map((c: any) => (
            <th key={c.key} className="px-5 py-3 font-medium border-b border-border whitespace-nowrap">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row: any, i: number) => (
          <tr key={i} className="hover:bg-muted/30 transition-colors">
            {cols.map((c: any) => (
              <td key={c.key} className="px-5 py-3 align-middle">
                {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "live",     label: "Live Feed", icon: Wifi },
  { id: "searches", label: "URL Searches", icon: Search },
  { id: "visitors", label: "Visitors", icon: Users },
  { id: "users",    label: "Users", icon: User },
  { id: "geo",      label: "Geography", icon: Globe },
];

export default function Monitoring() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState<any>(null);
  const [live, setLive] = useState([]);
  const [searches, setSearches] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [users, setUsers] = useState([]);
  const [geo, setGeo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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
    } catch (e: any) {
      setError(`Failed to load data: ${e.message}. Make sure you are signed in as Admin.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-destructive/10 rounded-full flex items-center justify-center mb-6 border-8 border-destructive/5">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-destructive mb-2">Admin Access Only</h2>
        <p className="text-muted-foreground max-w-md">
          This page is restricted to administrators. You do not have the required permissions to view this content.
        </p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 flex flex-col items-center text-center animate-in slide-in-from-top-4">
          <ShieldAlert className="h-8 w-8 text-destructive mb-3" />
          <h3 className="font-semibold text-destructive text-lg mb-1">Connection Error</h3>
          <p className="text-sm text-destructive/80 mb-4">{error}</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-500 flex items-center gap-2">
            <Server className="w-8 h-8 text-primary" /> PhishGuard Monitoring
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time visitor analytics & scan monitoring
            {lastRefresh && ` · Updated ${relTime(lastRefresh.toISOString())}`}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/30 transition-colors disabled:opacity-50 text-sm font-semibold"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border no-scrollbar hide-scrollbar">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading && !stats && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-pulse">
          <Server className="h-8 w-8 mb-4 opacity-20" />
          <p>Loading monitoring data...</p>
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Globe} label="Total Visits" value={stats.visits?.total} sub="All time" colorClass="text-primary" bgClass="bg-primary/10 text-primary" />
            <StatCard icon={Activity} label="Visits (24h)" value={stats.visits?.last_24h} sub="Last 24 hours" colorClass="text-indigo-500" bgClass="bg-indigo-500/10 text-indigo-500" />
            <StatCard icon={Users} label="Unique IPs" value={stats.visits?.unique_ips} sub="24h window" colorClass="text-purple-500" bgClass="bg-purple-500/10 text-purple-500" />
            <StatCard icon={Search} label="Total Scans" value={stats.scans?.total} sub="All time" colorClass="text-emerald-500" bgClass="bg-emerald-500/10 text-emerald-500" />
            <StatCard icon={ShieldAlert} label="Phishing" value={stats.scans?.phishing} sub="Detected" colorClass="text-destructive" bgClass="bg-destructive/10 text-destructive" />
            <StatCard icon={UserCircle} label="Users" value={stats.users?.total} sub="Registered" colorClass="text-amber-500" bgClass="bg-amber-500/10 text-amber-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Top Countries" icon={MapPin}>
              <div className="p-4">
                <div className="space-y-1">
                  {geo.slice(0, 8).map((g, i) => (
                    <div key={i} className="flex justify-between items-center py-2 px-2 hover:bg-muted/50 rounded-md transition-colors">
                      <span className="text-sm font-medium">{g.country || "Unknown"}</span>
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-md">{fmt(g.visits)}</span>
                    </div>
                  ))}
                  {geo.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No geo data yet. Geo data populates as users visit from different countries.
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Verdict Breakdown" icon={ShieldAlert}>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  {[
                    { label: "Phishing", val: stats.scans?.phishing, colorClass: "text-destructive", bgClass: "bg-destructive/10" },
                    { label: "Suspicious", val: stats.scans?.suspicious, colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
                    { label: "Safe", val: stats.scans?.safe, colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
                  ].map(({ label, val, colorClass, bgClass }) => {
                    const pct = stats.scans?.total ? (val / stats.scans.total) * 100 : 0;
                    return (
                      <div key={label} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-medium text-muted-foreground">{label}</span>
                          <span className={`text-lg font-bold ${colorClass}`}>{fmt(val)}</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${colorClass.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total Scans</span>
                  <span className="text-xl font-bold">{fmt(stats.scans?.total)}</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Live Feed ─────────────────────────────────────────────────── */}
      {tab === "live" && (
        <div className="animate-in fade-in duration-300">
          <SectionCard
            title="Live Visitor Feed"
            icon={Wifi}
            extra={
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live (30s)
              </div>
            }
          >
            <Table
              cols={[
                { key: "timestamp", label: "Time", render: (v: string) => <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(v)}</span> },
                { key: "user_display", label: "User", render: (v: string) => <span className="font-medium">{v}</span> },
                { key: "ip_address", label: "IP", render: (v: string) => <span className="font-mono text-xs">{v}</span> },
                { key: "path", label: "Path", render: (v: string) => <span className="font-mono text-xs max-w-[200px] truncate block" title={v}>{v}</span> },
                { key: "method", label: "Method", render: (v: string) => <span className="text-xs font-bold text-muted-foreground">{v}</span> },
                { key: "status_code", label: "Status", render: (v: number) => (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${v >= 400 ? "bg-destructive/10 text-destructive" : v >= 300 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
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
        </div>
      )}

      {/* ── URL Searches ───────────────────────────────────────────────── */}
      {tab === "searches" && (
        <div className="animate-in fade-in duration-300">
          <SectionCard title="URL Scan History" icon={Search}>
            <Table
              cols={[
                { key: "date_submitted", label: "Date", render: (v: string) => <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(v)}</span> },
                { key: "url", label: "URL", render: (v: string) => (
                  <span className="font-mono text-xs max-w-[260px] truncate block" title={v}>{v}</span>
                )},
                { key: "submitted_by_email", label: "User", render: (v: string) => <span className="text-xs">{v}</span> },
                { key: "verdict", label: "Verdict", render: (v: string) => <VerdictBadge verdict={v} /> },
                { key: "confidence_score", label: "Score", render: (v: number) => v != null ? <span className="font-mono text-xs">{v}%</span> : "—" },
              ]}
              rows={searches}
              empty="No URL scans yet."
            />
          </SectionCard>
        </div>
      )}

      {/* ── Visitors ─────────────────────────────────────────────────── */}
      {tab === "visitors" && (
        <div className="animate-in fade-in duration-300">
          <SectionCard title="Visitor Log" icon={Users}>
            <Table
              cols={[
                { key: "timestamp", label: "Time", render: (v: string) => <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(v)}</span> },
                { key: "ip_address", label: "IP Address", render: (v: string) => <span className="font-mono text-xs">{v}</span> },
                { key: "user_display", label: "User", render: (v: string) => <span className="text-xs font-medium">{v}</span> },
                { key: "path", label: "Path", render: (v: string) => <span className="font-mono text-xs max-w-[150px] truncate block" title={v}>{v}</span> },
                { key: "device_type", label: "Device", render: (v: string) => (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                    <Laptop className="h-3 w-3" /> {v || "desktop"}
                  </span>
                )},
                { key: "browser", label: "Browser", render: (v: string) => <span className="text-xs">{v}</span> },
                { key: "country", label: "Country", render: (v: string) => <span className="text-xs">{v}</span> },
                { key: "city", label: "City", render: (v: string) => <span className="text-xs">{v}</span> },
              ]}
              rows={visitors}
              empty="No visitor data yet."
            />
          </SectionCard>
        </div>
      )}

      {/* ── Users ────────────────────────────────────────────────────── */}
      {tab === "users" && (
        <div className="animate-in fade-in duration-300">
          <SectionCard title="Registered Users" icon={UserCircle}>
            <Table
              cols={[
                { key: "email", label: "Email", render: (v: string) => <span className="font-medium text-sm">{v}</span> },
                { key: "username", label: "Username", render: (v: string) => <span className="text-xs text-muted-foreground">@{v}</span> },
                { key: "role", label: "Role", render: (v: string) => (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${v === "admin" ? "bg-purple-500/15 text-purple-500 border border-purple-500/20" : "bg-primary/10 text-primary border border-primary/20"}`}>
                    {v === "admin" && <Key className="h-3 w-3" />} {v}
                  </span>
                )},
                { key: "date_joined", label: "Joined", render: (v: string) => <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(v)}</span> },
                { key: "last_login", label: "Last Login", render: (v: string) => <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime(v)}</span> },
                { key: "total_scans", label: "Scans", render: (v: number) => <span className="font-mono text-xs">{fmt(v)}</span> },
                { key: "total_visits", label: "Visits", render: (v: number) => <span className="font-mono text-xs">{fmt(v)}</span> },
              ]}
              rows={users}
              empty="No users found."
            />
          </SectionCard>
        </div>
      )}

      {/* ── Geography ────────────────────────────────────────────────── */}
      {tab === "geo" && (
        <div className="animate-in fade-in duration-300">
          <SectionCard title="Visitor Geography (Last 30 Days)" icon={Globe}>
            <Table
              cols={[
                { key: "country", label: "Country", render: (v: string) => <span className="font-medium">{v}</span> },
                { key: "country_code", label: "Code", render: (v: string) => <span className="text-xs font-mono text-muted-foreground">{v}</span> },
                { key: "visits", label: "Visits", render: (v: number) => <span className="font-mono text-sm">{fmt(v)}</span> },
                { key: "unique_ips", label: "Unique IPs", render: (v: number) => <span className="font-mono text-sm">{fmt(v)}</span> },
                { key: "visits", label: "", render: (v: number) => {
                  const max = Math.max(...geo.map((g) => g.visits), 1);
                  const pct = Math.round((v / max) * 100);
                  return (
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden ml-auto">
                      <div className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  );
                }},
              ]}
              rows={geo}
              empty="No geographic data yet."
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
