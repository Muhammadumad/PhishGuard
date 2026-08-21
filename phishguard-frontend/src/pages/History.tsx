import { useState, useEffect, useCallback } from "react";
import { fetchHistory, fetchStats, deleteScan, fetchAllScans } from "../api/scanAPI";
import StatusAlert from "../components/ui/StatusAlert";
import { Download, Trash2, Loader2, Info, Search, Filter, History as HistoryIcon } from "lucide-react";

const PAGE_SIZE = 8;

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

function downloadCSV(rows: any[]) {
  const headers = ["URL", "Status", "Risk Score", "Reason", "Time"];
  const escape = (val: any) => {
    const str = String(val ?? "").replace(/"/g, '""');
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
  };
  const lines = [
    headers.join(","),
    ...rows.map(item => [
      escape(item.url),
      escape(item.status),
      escape(item.scan_result?.risk_score ?? 0),
      escape(item.scan_result?.reasons?.[0] ?? "—"),
      escape(item.time ?? "—"),
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
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
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ all: 0, phishing: 0, suspicious: 0, safe: 0 });

  const [deletingId, setDeletingId] = useState<any>(null);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(localStorage.getItem("pg_history_onboarding_dismissed") !== "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchHistory({ status: filter, search: search.trim(), sort: sortBy, page, page_size: PAGE_SIZE });
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
      setCounts({ all: stats.total || 0, phishing: stats.phishing || 0, suspicious: stats.suspicious || 0, safe: stats.safe || 0 });
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const handleFilter = (v: string) => { setFilter(v); setPage(1); };
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteError("");
    setConfirmDeleteId(null);
    try {
      await deleteScan(id);
      setData(prev => prev.filter(item => item.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
      await loadCounts();
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || "Could not delete scan.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const all = await fetchAllScans();
      if (all.length === 0) { setDeleteError("No scans to export yet."); return; }
      downloadCSV(all);
    } catch {
      setDeleteError("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const dismissOnboarding = () => {
    localStorage.setItem("pg_history_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan History</h1>
          <p className="text-muted-foreground mt-1">Review and manage your past URL analyses.</p>
        </div>
        {total > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground font-medium text-sm transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
          >
            {exporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</> : <><Download className="mr-2 h-4 w-4" /> Export CSV</>}
          </button>
        )}
      </div>

      {showOnboarding && (
        <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center text-primary"><Info className="w-5 h-5 mr-2" /> History Guide</h3>
                <p className="text-sm text-muted-foreground mt-1">Use filters and search to quickly find risky URLs.</p>
              </div>
              <button onClick={dismissOnboarding} className="text-xs font-medium text-muted-foreground hover:text-foreground">Hide Guide</button>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">1</span>
                <span className="text-sm font-medium">Filter by threat level</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">2</span>
                <span className="text-sm font-medium">Sort by risk score or date</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">3</span>
                <span className="text-sm font-medium">Export CSV for auditing</span>
              </li>
            </ol>
          </div>
        </div>
      )}

      {(error || deleteError) && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center">
          <Info className="mr-2 h-5 w-5 shrink-0" />
          {error || deleteError}
        </div>
      )}

      {/* Controls Container */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-4">
        {/* Tabs */}
        <div className="flex overflow-x-auto pb-1 hide-scrollbar">
          <div className="flex space-x-1 rounded-lg bg-muted p-1">
            {[
              { key: "all", label: "All", count: counts.all },
              { key: "phishing", label: "Phishing", count: counts.phishing },
              { key: "suspicious", label: "Suspicious", count: counts.suspicious },
              { key: "safe", label: "Safe", count: counts.safe },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleFilter(tab.key)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  filter === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"
                }`}
              >
                {tab.label} <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search URLs..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="relative sm:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); setPage(1); }}
              className="w-full h-10 pl-9 pr-8 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="riskHigh">Highest Risk</option>
              <option value="riskLow">Lowest Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meta */}
      {!loading && (
        <div className="text-sm text-muted-foreground font-medium">
          {data.length > 0 ? `Showing ${data.length} of ${total} results` : "No results found"}
          {search && <span> for "<span className="text-foreground">{search}</span>"</span>}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">URL</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium">Risk Score</th>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded w-24"></div></td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                      <HistoryIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No scans found.</p>
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const score = item.scan_result?.risk_score ?? 0;
                  const status = item.status;
                  const reason = item.scan_result?.reasons?.[0] || "—";
                  const isDeleting = deletingId === item.id;
                  const isConfirming = confirmDeleteId === item.id;

                  return (
                    <tr key={item.id} className={`hover:bg-muted/50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBgClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs max-w-[200px] truncate" title={item.url}>{item.url}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-muted-foreground max-w-[160px] truncate" title={reason}>{reason}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 w-32">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${statusColorClass(status).replace('text-', 'bg-')}`} style={{ width: `${Math.min(score, 100)}%` }} />
                          </div>
                          <span className={`font-mono font-bold text-xs ${statusColorClass(status)}`}>{score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{item.time || "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                        ) : isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(item.id)} className="px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded text-[10px] font-bold hover:bg-destructive hover:text-destructive-foreground transition-colors">Yes</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-muted text-muted-foreground rounded text-[10px] hover:bg-accent transition-colors">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded transition-colors" title="Delete scan">
                            <Trash2 className="h-4 w-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:pointer-events-none">Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-md text-sm font-medium ${page === p ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:pointer-events-none">Next</button>
        </div>
      )}
    </div>
  );
}
