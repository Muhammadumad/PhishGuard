import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chart, registerables } from "chart.js";
import { Activity, RefreshCw, BarChart2, Calendar, ChevronRight, TrendingUp, Zap, ShieldAlert, ShieldCheck, Info, X } from "lucide-react";
import { fetchAnalytics, fetchHistory } from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";
import useThemeStore from "../store/ThemeStore";

Chart.register(...registerables);

const RANGE_OPTIONS = [7, 14, 30];

function getChartTheme(theme: string) {
  const isLight = theme === "light";
  return {
    tooltip: {
      backgroundColor: isLight ? "#ffffff" : "#0f172a",
      borderColor: isLight ? "#e2e8f0" : "#1e293b",
      borderWidth: 1,
      titleColor: isLight ? "#0f172a" : "#f8fafc",
      bodyColor: isLight ? "#475569" : "#cbd5e1",
      titleFont: { family: "Inter", size: 12, weight: "bold" as const },
      bodyFont: { family: "Inter", size: 12 },
      padding: 12,
      cornerRadius: 8,
    },
    ticks: {
      color: isLight ? "#64748b" : "#94a3b8",
      font: { family: "Inter", size: 11 },
    },
    grid: isLight ? "#f1f5f9" : "#1e293b",
    legend: isLight ? "#334155" : "#cbd5e1",
    donutBorder: isLight ? "#ffffff" : "#020817",
    donutFallback: isLight ? "#e2e8f0" : "#1e293b",
  };
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value ?? 0);

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTimelineSeries(dailyRows: any[], rangeDays: number) {
  const byDate = new Map();
  const validRows = [...(dailyRows || [])].filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || "")));

  validRows.forEach((entry) => {
    const key = entry.date;
    const current = byDate.get(key) || { phishing: 0, suspicious: 0, safe: 0 };
    current.phishing += entry.phishing || 0;
    current.suspicious += entry.suspicious || 0;
    current.safe += entry.safe || 0;
    byDate.set(key, current);
  });

  const latestDate = validRows.length ? new Date(validRows.map((entry) => entry.date).sort().at(-1)) : new Date();
  latestDate.setHours(0, 0, 0, 0);

  const buildWindow = (offsetDays: number) => {
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
  const previousTotal = previousPoints.reduce((sum, point) => sum + point.total, 0);
  const peakPoint = points.reduce((best, point) => (!best || point.total > best.total ? point : best), null as any);

  return { points, total, previousTotal, peakPoint };
}

function getVerdictTone(verdict: string) {
  if (verdict === "phishing") return "text-destructive";
  if (verdict === "suspicious") return "text-amber-500";
  return "text-emerald-500";
}

function getVerdictBg(verdict: string) {
  if (verdict === "phishing") return "bg-destructive/10 text-destructive border-destructive/20";
  if (verdict === "suspicious") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
}

function Skeleton({ height = "h-48", className = "" }: { height?: string, className?: string }) {
  return <div className={`w-full rounded-lg bg-muted animate-pulse ${height} ${className}`} />;
}

function StatCard({ label, value, sub, colorClass, loading, icon, bgClass }: any) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 relative overflow-hidden transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        {icon && <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgClass}`}>{icon}</div>}
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-muted rounded animate-pulse my-1" />
      ) : (
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, height = "h-[240px]", loading, children }: any) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col h-full">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className={`relative flex-1 ${height}`}>
        {loading ? <Skeleton height="h-full" /> : children}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { theme } = useThemeStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [rangeDays, setRangeDays] = useState(7);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [recentScanTotal, setRecentScanTotal] = useState(0);

  const lineChartRef = useRef<Chart | null>(null);
  const donutChartRef = useRef<Chart | null>(null);
  const barChartRef = useRef<Chart | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const donutCanvasRef = useRef<HTMLCanvasElement>(null);
  const barCanvasRef = useRef<HTMLCanvasElement>(null);

  const summary = data?.summary || {};
  const scanTotal = summary.total ?? 0;
  
  const verdictBreakdown = useMemo(() => 
    (data?.by_verdict || []).reduce((acc: any, entry: any) => {
      acc[entry.verdict || "unknown"] = entry.count || 0;
      return acc;
    }, {}), [data]);

  const dominantVerdict = useMemo(() => {
    const verdicts = data?.by_verdict || [];
    if (!verdicts.length) return { verdict: "safe", count: 0 };
    return verdicts.reduce((best: any, entry: any) => ((entry.count || 0) > (best.count || 0) ? entry : best), verdicts[0]);
  }, [data]);

  const timeline = useMemo(() => buildTimelineSeries(data?.daily || [], rangeDays), [data, rangeDays]);

  const summaryTotals = {
    phishing: summary.phishing ?? verdictBreakdown.phishing ?? 0,
    suspicious: summary.suspicious ?? verdictBreakdown.suspicious ?? 0,
    safe: summary.safe ?? verdictBreakdown.safe ?? 0,
  };

  const threatTotal = summary.threats ?? (summaryTotals.phishing + summaryTotals.suspicious);
  const threatRate = scanTotal > 0 ? (threatTotal / scanTotal) * 100 : 0;
  const safeRate = scanTotal > 0 ? (summaryTotals.safe / scanTotal) * 100 : 0;
  const highRiskTotal = (data?.score_dist?.["61-80"] || 0) + (data?.score_dist?.["81-100"] || 0);
  const highRiskRate = scanTotal > 0 ? (highRiskTotal / scanTotal) * 100 : 0;
  const trendDelta = timeline.previousTotal > 0 ? ((timeline.total - timeline.previousTotal) / timeline.previousTotal) * 100 : null;
  const trendDirection = trendDelta == null ? "steady" : trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "steady";
  const peakLabel = timeline.peakPoint ? `${timeline.peakPoint.label} · ${timeline.peakPoint.total} scans` : "No activity yet";

  const destroyCharts = () => {
    if (lineChartRef.current) { lineChartRef.current.destroy(); lineChartRef.current = null; }
    if (donutChartRef.current) { donutChartRef.current.destroy(); donutChartRef.current = null; }
    if (barChartRef.current) { barChartRef.current.destroy(); barChartRef.current = null; }
  };

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
    } catch {
      setError("Could not load analytics. Make sure Django is running.");
      setRecentScans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setShowOnboarding(localStorage.getItem("pg_analytics_onboarding_dismissed") !== "1"); }, []);

  useEffect(() => {
    if (!data || loading) { destroyCharts(); return; }
    destroyCharts();
    const chartTheme = getChartTheme(theme);
    if (scanTotal === 0) return;

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
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#ef4444",
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
            {
              label: "Suspicious",
              data: selectedDays.map((point) => point.suspicious),
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#f59e0b",
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
            {
              label: "Safe",
              data: selectedDays.map((point) => point.safe),
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#10b981",
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { labels: { color: chartTheme.legend, font: { family: "Inter", size: 11 }, boxWidth: 10, usePointStyle: true } },
            tooltip: chartTheme.tooltip,
          },
          scales: {
            x: { grid: { color: chartTheme.grid, display: false }, ticks: chartTheme.ticks, border: { color: chartTheme.grid } },
            y: { grid: { color: chartTheme.grid }, ticks: { ...chartTheme.ticks, stepSize: 1 }, border: { color: chartTheme.grid, display: false }, beginAtZero: true },
          },
        },
      });
    }

    if (donutCanvasRef.current) {
      const verdicts = data.by_verdict || [];
      const labels = verdicts.map((v: any) => v.verdict || "Unknown");
      const values = verdicts.map((v: any) => v.count || 0);
      const colors = labels.map((l: string) => l === "phishing" ? "#ef4444" : l === "suspicious" ? "#f59e0b" : l === "safe" ? "#10b981" : "#64748b");
      
      donutChartRef.current = new Chart(donutCanvasRef.current, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: values.length ? values : [1],
            backgroundColor: values.length ? colors : [chartTheme.donutFallback],
            borderColor: chartTheme.donutBorder,
            borderWidth: 3,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "75%",
          plugins: {
            legend: { position: "bottom", labels: { color: chartTheme.legend, font: { family: "Inter", size: 11 }, usePointStyle: true, padding: 20 } },
            tooltip: values.length ? chartTheme.tooltip : { enabled: false },
          },
        },
      });
    }

    if (barCanvasRef.current) {
      const dist = data.score_dist || {};
      const labels = ["0-20", "21-40", "41-60", "61-80", "81-100"];
      const values = labels.map(k => dist[k] || 0);
      
      barChartRef.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "URLs",
            data: values,
            backgroundColor: ["rgba(16,185,129,0.7)", "rgba(16,185,129,0.4)", "rgba(245,158,11,0.6)", "rgba(239,68,68,0.5)", "rgba(239,68,68,0.9)"],
            borderColor: ["#10b981", "#10b981", "#f59e0b", "#ef4444", "#ef4444"],
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { ...chartTheme.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} URL${ctx.raw !== 1 ? "s" : ""}` } },
          },
          scales: {
            x: { grid: { display: false }, ticks: chartTheme.ticks, border: { color: chartTheme.grid } },
            y: { grid: { color: chartTheme.grid }, ticks: { ...chartTheme.ticks, stepSize: 1 }, border: { display: false }, beginAtZero: true },
          },
        },
      });
    }

    return () => destroyCharts();
  }, [data, loading, scanTotal, timeline.points, theme]);

  const isEmpty = !loading && scanTotal === 0;

  const dismissOnboarding = () => {
    localStorage.setItem("pg_analytics_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  const loadRecentScans = useCallback(async () => {
    try {
      const history = await fetchHistory({ page: 1, page_size: 5, sort: "newest" });
      setRecentScans(history?.results || []);
      setRecentScanTotal(history?.total || 0);
    } catch {
      setRecentScans([]);
    }
  }, []);

  useEffect(() => {
    loadRecentScans();
    const interval = window.setInterval(() => { if (!document.hidden) loadRecentScans(); }, 15000);
    return () => window.clearInterval(interval);
  }, [loadRecentScans]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Overview</h1>
          <p className="text-muted-foreground mt-1">Monitor threat trends and platform usage.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-input bg-background p-1">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option}
                onClick={() => setRangeDays(option)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${option === rangeDays ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {option}d
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} disabled={loading || refreshing} className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {showOnboarding && (
        <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center text-primary"><Info className="w-5 h-5 mr-2" /> Analytics Guide</h3>
                <p className="text-sm text-muted-foreground mt-1">Understand threat trends and react quickly to rising risk.</p>
              </div>
              <button onClick={dismissOnboarding} className="text-xs font-medium text-muted-foreground hover:text-foreground">Hide Guide</button>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">1</span>
                <span className="text-sm font-medium">Switch between 7d, 14d, and 30d date ranges</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">2</span>
                <span className="text-sm font-medium">Track threat ratio and high-risk URL share</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">3</span>
                <span className="text-sm font-medium">Use top threat sources to prioritize actions</span>
              </li>
            </ol>
          </div>
        </div>
      )}

      {error && (
        <StatusAlert message={error} onClose={() => load(true)} />
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Scans"
          value={formatNumber(summary.total ?? 0)}
          sub="All time"
          colorClass="text-foreground"
          loading={loading}
          icon={<Activity className="h-4 w-4" />}
          bgClass="bg-primary/10 text-primary border border-primary/20"
        />
        <StatCard
          label="Threats Found"
          value={formatNumber(summary.threats ?? 0)}
          sub="Phishing + suspicious"
          colorClass="text-destructive"
          loading={loading}
          icon={<ShieldAlert className="h-4 w-4" />}
          bgClass="bg-destructive/10 text-destructive border border-destructive/20"
        />
        <StatCard
          label="Detection Rate"
          value={`${summary.detection_rate ?? 0}%`}
          sub="Of all scans"
          colorClass={summary.detection_rate >= 50 ? "text-destructive" : summary.detection_rate >= 20 ? "text-amber-500" : "text-emerald-500"}
          loading={loading}
          icon={<Zap className="h-4 w-4" />}
          bgClass="bg-amber-500/10 text-amber-500 border border-amber-500/20"
        />
        <StatCard
          label="Avg Risk Score"
          value={formatNumber(summary.avg_risk ?? 0)}
          sub="Across all scans"
          colorClass="text-amber-500"
          loading={loading}
          icon={<BarChart2 className="h-4 w-4" />}
          bgClass="bg-amber-500/10 text-amber-500 border border-amber-500/20"
        />
        <StatCard
          label="Unique Threats"
          value={formatNumber(data?.top_threats?.length ?? 0)}
          sub="Distinct domains"
          colorClass="text-emerald-500"
          loading={loading}
          icon={<ShieldCheck className="h-4 w-4" />}
          bgClass="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
        />
      </div>

      {/* Overview Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Threat Ratio</div>
            <div className="text-3xl font-bold text-destructive">{threatRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{formatNumber(threatTotal)} of {formatNumber(scanTotal)} scans flagged</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Safe Coverage</div>
            <div className="text-3xl font-bold text-emerald-500">{safeRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{formatNumber(summaryTotals.safe)} safe URLs recorded</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High-Risk Share</div>
            <div className="text-3xl font-bold text-amber-500">{highRiskRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{formatNumber(highRiskTotal)} URLs scored above 60</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Peak Activity</div>
            <div className="text-lg font-bold text-primary truncate" title={peakLabel}>{peakLabel}</div>
            <div className="text-xs text-muted-foreground">Trend is {trendDirection === "up" ? "rising" : trendDirection === "down" ? "cooling" : "stable"}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="font-semibold text-sm">
              {trendDelta == null ? "Trend comparison is waiting on more history" : trendDelta > 0 ? "Threat activity is trending up" : trendDelta < 0 ? "Threat activity has eased" : "Threat activity is unchanged"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {trendDelta == null ? `Compared with the prior ${rangeDays}-day window when available` : `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(1)}% vs prior ${rangeDays}-day window`}
              <span className="mx-2">&middot;</span>
              Dominant verdict: <span className="font-medium capitalize text-foreground">{dominantVerdict.verdict || "safe"}</span> ({formatNumber(dominantVerdict.count || 0)} events)
            </p>
          </div>
          <div className="flex gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted">
              <TrendingUp className="w-3 h-3 mr-1.5 opacity-70" /> {formatNumber(timeline.total)} window scans
            </span>
          </div>
        </div>
      </div>

      {isEmpty && !error ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-xl border border-border border-dashed bg-card/50">
          <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
            <BarChart2 className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-bold mb-2">No analytics yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">Scan some URLs on the Dashboard first. Analytics will appear here once you have at least one scan saved.</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <ChartCard title="Daily scan trends" subtitle={`Last ${rangeDays} days — phishing, suspicious and safe verdicts`} height="h-[280px]" loading={loading}>
            <canvas ref={lineCanvasRef} />
            {!loading && !timeline.points.some(p => p.total > 0) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg text-center">
                <h4 className="font-semibold mb-1">No activity in this range</h4>
                <p className="text-sm text-muted-foreground">Try switching to 14d or 30d, or refresh after new scans.</p>
              </div>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Verdict breakdown" subtitle="Distribution of all scan verdicts" height="h-[240px]" loading={loading}>
              <canvas ref={donutCanvasRef} />
            </ChartCard>
            <ChartCard title="Risk score distribution" subtitle="URLs grouped by risk band (0–100 scale)" height="h-[240px]" loading={loading}>
              <canvas ref={barCanvasRef} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Scans */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Recent stored scans</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Live feed of latest scans</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-md">{recentScanTotal} stored</span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 font-medium">URL</th>
                      <th className="px-5 py-3 font-medium">Verdict</th>
                      <th className="px-5 py-3 font-medium">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-12"></div></td>
                        </tr>
                      ))
                    ) : recentScans.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">Scan a URL to see it here</td>
                      </tr>
                    ) : (
                      recentScans.map((item, i) => {
                        const verdict = item?.status === "phishing" ? "phishing" : item?.status || "safe";
                        const score = item?.scan_result?.risk_score ?? 0;
                        return (
                          <tr key={item?.id || i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="font-mono text-xs max-w-[200px] truncate" title={item?.url}>{item?.url || "—"}</div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getVerdictBg(verdict)}`}>
                                {verdict}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2 w-20">
                                <span className={`font-mono font-bold text-xs ${getVerdictTone(verdict)}`}>{score}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Threats */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Top threat sources</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Highest risk domains found</p>
                </div>
                {!loading && data?.top_threats?.length > 0 && (
                  <span className="text-xs font-medium text-destructive px-2 py-1 bg-destructive/10 rounded-md border border-destructive/20">{data.top_threats.length} domains</span>
                )}
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 font-medium">Domain</th>
                      <th className="px-5 py-3 font-medium">Verdict</th>
                      <th className="px-5 py-3 font-medium">Hits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-32"></div></td>
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
                          <td className="px-5 py-3"><div className="h-4 bg-muted rounded w-8"></div></td>
                        </tr>
                      ))
                    ) : !data?.top_threats?.length ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-sm text-muted-foreground">No phishing threats detected yet</td>
                      </tr>
                    ) : (
                      data.top_threats.map((row: any, i: number) => {
                        const verdict = row.verdict || "phishing";
                        return (
                          <tr key={i} className="hover:bg-muted/30 transition-colors bg-destructive/5">
                            <td className="px-5 py-3">
                              <div className="font-mono text-xs max-w-[200px] truncate text-foreground" title={row.url__url || row.url_display}>{row.url__url || row.url_display || "—"}</div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getVerdictBg(verdict)}`}>
                                {verdict}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
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
          </div>
        </>
      )}

      <div className="text-center text-xs text-muted-foreground py-4">
        Live data from MySQL &middot; Auto-refreshes every 15s
      </div>
    </div>
  );
}
