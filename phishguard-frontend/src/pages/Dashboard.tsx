import { useState, useEffect } from "react";
import api from "../api/axiosInstance";
import { fetchStats, fetchHistory, reportURL } from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";
import { ArrowRight, ShieldCheck, ShieldAlert, Shield, Search, Info, Flag, Target, AlertTriangle, Loader2, History } from "lucide-react";

function statusColorClass(s: string) {
  if (s === "phishing" || s === "malicious") return "text-destructive";
  if (s === "suspicious") return "text-amber-500";
  return "text-emerald-500";
}

function statusBgClass(s: string) {
  if (s === "phishing" || s === "malicious") return "bg-destructive/10 border-destructive/20 text-destructive";
  if (s === "suspicious") return "bg-amber-500/10 border-amber-500/20 text-amber-500";
  return "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";
}

function ScoreRing({ score, verdict }: { score: number, verdict: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const safeScore = Math.min(Math.max(Math.round(score || 0), 0), 100);
  const pct = (safeScore / 100) * c;
  const color =
    verdict === "phishing" || verdict === "malicious"
      ? "#ef4444"
      : verdict === "suspicious"
        ? "#f59e0b"
        : "#10b981";
  
  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="absolute inset-0">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${pct} ${c}`} strokeLinecap="round" transform="rotate(-90 48 48)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold font-mono" style={{ color }}>{safeScore}</span>
        <span className="text-[10px] text-muted-foreground font-mono">/100</span>
      </div>
    </div>
  );
}

// Minimal Detail Modal
function ScanDetailModal({ scan, getRiskBand, getRecommendation, onClose }: any) {
  if (!scan) return null;
  const verdict = scan.status || "safe";
  const score = scan.scan_result?.risk_score ?? 0;
  const confidence = scan.scan_result?.confidence_score ?? "N/A";
  const reasons = scan.scan_result?.reasons || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border shadow-lg rounded-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Scan Details</h3>
            <p className="text-sm text-muted-foreground">Detailed intelligence on this URL</p>
          </div>
          <button onClick={onClose} className="h-8 px-3 rounded-md hover:bg-accent text-sm font-medium transition-colors">Close</button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">URL</div>
              <div className="text-sm font-mono break-all">{scan.url}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBgClass(verdict)} uppercase`}>{verdict}</span>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Risk Score</div>
              <div className={`text-sm font-mono font-bold ${statusColorClass(verdict)}`}>{score}/100</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Confidence</div>
              <div className="text-sm font-mono">{confidence}/100</div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Risk Band</div>
              <div className="text-sm">{getRiskBand(score)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommendation</div>
              <div className="text-sm leading-relaxed">{getRecommendation(verdict)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Time</div>
              <div className="text-sm text-muted-foreground">{scan.time || "—"}</div>
            </div>
          </div>
          
          {reasons.length > 0 && (
            <div className="sm:col-span-2 pt-4 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Detection Reasons</div>
              <ul className="space-y-2">
                {reasons.map((r: string, i: number) => (
                  <li key={i} className="flex items-start text-sm">
                    <AlertTriangle className={`mr-2 h-4 w-4 shrink-0 mt-0.5 ${statusColorClass(verdict)}`} />
                    <span className="text-muted-foreground font-mono text-xs">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportModal({ scanResult, onClose }: any) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (description.trim().length < 10) return;
    setSubmitting(true);
    try {
      await reportURL(scanResult.id, description);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border shadow-lg rounded-xl w-full max-w-md overflow-hidden p-6 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {submitted ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
            <p className="text-sm text-muted-foreground mb-6">An admin will review this URL. If confirmed, it will be added to the global blacklist.</p>
            <button onClick={onClose} className="w-full inline-flex justify-center items-center h-10 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">Close</button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-destructive flex items-center"><Flag className="mr-2 w-5 h-5" /> Report URL</h3>
                <p className="text-sm text-muted-foreground mt-1">Flag this URL for manual admin review</p>
              </div>
            </div>
            <div className="bg-muted p-3 rounded-md mb-4 break-all font-mono text-xs text-muted-foreground">
              {scanResult.url}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Why is this URL suspicious?</label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. Looks like a fake login page..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="text-right text-xs mt-1">
                <span className={description.trim().length < 10 ? "text-destructive" : "text-muted-foreground"}>
                  {description.trim().length} chars (min 10)
                </span>
              </div>
            </div>
            {error && <div className="p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-10 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium text-sm transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || description.trim().length < 10} className="flex-[2] h-10 rounded-md bg-destructive text-destructive-foreground font-medium text-sm hover:bg-destructive/90 transition-colors inline-flex items-center justify-center">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [apiError, setApiError] = useState("");
  const [stats, setStats] = useState({ total: 0, phishing: 0, suspicious: 0, safe: 0 });

  const [showReportModal, setShowReportModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedDashboardScan, setSelectedDashboardScan] = useState<any>(null);

  useEffect(() => {
    loadHistory();
    loadStats();
    setShowOnboarding(localStorage.getItem("pg_dashboard_onboarding_dismissed") !== "1");
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetchHistory({ sort: "newest", page: 1, page_size: 10 });
      setHistory(res.results || []);
    } catch (_) { } finally { setLoadingHistory(false); }
  };

  const loadStats = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (_) {}
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    let raw = urlInput.trim();
    if (!raw) return;

    // Auto-fix common scheme typos e.g. https:/ or https://:
    raw = raw.replace(/^(https?):\/+(?::+)?/i, "$1://").replace(/^(https?:\/\/):+/i, "$1");

    setScanning(true);
    setCurrentResult(null);
    setApiError("");
    try {
      const res = await api.post("/scan/", { url: raw });
      setCurrentResult({ ...res.data, time: "just now" });
      setUrlInput("");
      loadHistory();
      loadStats();
    } catch (err: any) {
      if (!err.response) setApiError("Cannot connect to Django server.");
      else if (err.response?.status === 401) setApiError("Session expired. Please log in again.");
      else setApiError(err.response?.data?.error || "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const getRiskBand = (score: number) => {
    if (score >= 81) return "Critical";
    if (score >= 61) return "High";
    if (score >= 41) return "Moderate";
    if (score >= 21) return "Low";
    return "Minimal";
  };

  const getRecommendation = (status: string) => {
    if (status === "phishing" || status === "malicious") return "Do not open this URL. Block and report it immediately.";
    if (status === "suspicious") return "Avoid entering credentials. Verify domain ownership.";
    return "No obvious phishing signals. Continue with standard caution.";
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_dashboard_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your URL scanning activity and recent threats.</p>
      </div>

      {showOnboarding && (
        <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center text-primary"><Target className="w-5 h-5 mr-2" /> Quick Start Guide</h3>
                <p className="text-sm text-muted-foreground mt-1">Get started with the PhishGuard scanner in three simple steps.</p>
              </div>
              <button onClick={dismissOnboarding} className="text-xs font-medium text-muted-foreground hover:text-foreground">Hide Guide</button>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">1</span>
                <span className="text-sm font-medium">Paste a URL and scan it</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">2</span>
                <span className="text-sm font-medium">Review the automated risk assessment</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">3</span>
                <span className="text-sm font-medium">Report false negatives to the blacklist</span>
              </li>
            </ol>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setUrlInput("paypa1-security-check.com")} className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent transition-colors">Try suspicious URL</button>
              <button onClick={() => setUrlInput("github.com")} className="text-xs px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent transition-colors">Try safe URL</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Scans", value: stats.total, sub: "all time", icon: Search, color: "text-primary" },
          { label: "Phishing", value: stats.phishing, sub: "threats found", icon: ShieldAlert, color: "text-destructive" },
          { label: "Suspicious", value: stats.suspicious, sub: "needs review", icon: AlertTriangle, color: "text-amber-500" },
          { label: "Safe", value: stats.safe, sub: "clean URLs", icon: ShieldCheck, color: "text-emerald-500" },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="mt-4 flex items-baseline">
              <h2 className="text-3xl font-bold tracking-tight">{stat.value}</h2>
              <span className="ml-2 text-xs text-muted-foreground">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Scan Input Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent"></div>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center"><Search className="mr-2 h-5 w-5 text-primary" /> New Scan</h3>
          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                className="w-full h-12 rounded-lg border border-input bg-background px-4 py-2 pl-4 pr-12 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter a URL to analyze (e.g. google.com or https://example.com)"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                disabled={scanning}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Shield className="h-4 w-4 opacity-50" />
              </div>
            </div>
            <button
              type="submit"
              disabled={scanning || !urlInput.trim()}
              className="h-12 px-8 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center shrink-0"
            >
              {scanning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</> : <><Search className="mr-2 h-4 w-4" /> Scan URL</>}
            </button>
          </form>
          {apiError && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
              {apiError}
            </div>
          )}
        </div>
      </div>

      {/* Latest Result Card */}
      {currentResult && (
        <div className={`rounded-xl border bg-card p-6 shadow-sm transition-all animate-in zoom-in-95 ${
          currentResult.status === 'phishing' ? 'border-destructive/50' : 
          currentResult.status === 'suspicious' ? 'border-amber-500/50' : 'border-emerald-500/50'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b border-border pb-4 gap-4">
            <h3 className="text-lg font-semibold">Latest Analysis Result</h3>
            {(currentResult.status === "phishing" || currentResult.status === "suspicious") && (
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
              >
                <Flag className="mr-2 h-3 w-3" /> Report URL
              </button>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <ScoreRing score={currentResult.scan_result?.risk_score ?? 0} verdict={currentResult.status} />
            <div className="flex-1 text-center md:text-left space-y-3 w-full">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusBgClass(currentResult.status)}`}>
                  {currentResult.status}
                </span>
                <span className="text-sm font-medium text-muted-foreground">{getRiskBand(currentResult.scan_result?.risk_score ?? 0)} Risk</span>
              </div>
              <p className="font-mono text-sm break-all font-medium">{currentResult.url}</p>
              <div className="pt-2">
                <button
                  onClick={() => setSelectedDashboardScan(currentResult)}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  <Info className="mr-1.5 h-4 w-4" /> View full detailed report <ArrowRight className="ml-1 h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Scans Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-semibold">Recent Scans</h3>
          {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="overflow-x-auto">
          {loadingHistory && history.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No scans yet. Enter a URL above to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-6 py-3 font-medium">URL</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Risk Score</th>
                  <th className="px-6 py-3 font-medium">Top Reason</th>
                  <th className="px-6 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.slice(0, 10).map((h, i) => (
                  <tr key={h.id || i} className="hover:bg-muted/50 transition-colors group cursor-pointer" onClick={() => setSelectedDashboardScan(h)}>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs max-w-[200px] sm:max-w-[300px] truncate group-hover:text-primary transition-colors">{h.url}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBgClass(h.status)}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-bold ${statusColorClass(h.status)}`}>{h.scan_result?.risk_score ?? 0}</span>
                      <span className="text-muted-foreground text-[10px]">/100</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">{h.scan_result?.reasons?.[0] || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs text-muted-foreground">{h.time || "—"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedDashboardScan && (
        <ScanDetailModal
          scan={selectedDashboardScan}
          getRiskBand={getRiskBand}
          getRecommendation={getRecommendation}
          onClose={() => setSelectedDashboardScan(null)}
        />
      )}

      {showReportModal && currentResult && (
        <ReportModal scanResult={currentResult} onClose={() => setShowReportModal(false)} />
      )}
    </div>
  );
}
