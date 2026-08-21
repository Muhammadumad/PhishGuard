import { useEffect, useState, useRef } from "react";
import api from "../api/axiosInstance";
import StatusAlert from "../components/ui/StatusAlert";
import { Play, Square, Info, RefreshCw, XCircle, Grid } from "lucide-react";

const MAX_CONCURRENT_SCANS = 4;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 350;

function statusColorClass(s: string) {
  if (s === "phishing" || s === "malicious") return "text-destructive";
  if (s === "suspicious") return "text-amber-500";
  if (s === "error") return "text-muted-foreground";
  return "text-emerald-500";
}

function statusBgClass(s: string) {
  if (s === "phishing" || s === "malicious") return "bg-destructive/10 border-destructive/20 text-destructive";
  if (s === "suspicious") return "bg-amber-500/10 border-amber-500/20 text-amber-500";
  if (s === "error") return "bg-muted text-muted-foreground border-border";
  return "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";
}

export default function BulkScanner() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [scanRate, setScanRate] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const scanStartRef = useRef<number | null>(null);
  const abortRef = useRef(false);
  const controllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    setShowOnboarding(localStorage.getItem("pg_bulk_onboarding_dismissed") !== "1");
  }, []);

  const parseURLs = (text: string) => text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0);
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const getRetryDelay = (attempt: number) => {
    const jitter = Math.floor(Math.random() * 120);
    return RETRY_BASE_MS * (2 ** attempt) + jitter;
  };

  const shouldRetry = (err: any) => !err.response || err.response.status >= 500;

  const buildSuccessResult = (data: any, url: string, index: number) => ({
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

  const buildErrorResult = (url: string, index: number, errMsg: string) => ({
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

  const scanOneUrl = async (url: string, index: number) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (abortRef.current) throw new Error("ABORTED");
      const controller = new AbortController();
      controllersRef.current.add(controller);
      
      try {
        const res = await api.post("/scan/", { url: url.trim() }, { signal: controller.signal });
        return buildSuccessResult(res.data, url, index);
      } catch (err: any) {
        if (controller.signal.aborted || abortRef.current) throw new Error("ABORTED");
        if (err.response?.status === 401) {
          const authError: any = new Error("AUTH_EXPIRED");
          authError.code = "AUTH_EXPIRED";
          throw authError;
        }
        
        if (shouldRetry(err) && attempt < MAX_RETRIES) {
          await sleep(getRetryDelay(attempt));
          continue;
        }
        return buildErrorResult(url, index, err.response?.data?.error || err.message || "Scan failed");
      } finally {
        controllersRef.current.delete(controller);
      }
    }
    return buildErrorResult(url, index, "Scan failed");
  };

  const handleScan = async (urlsToScan: string[] | null = null) => {
    setError("");
    setApiError("");
    const urls = urlsToScan || parseURLs(input);
    if (urls.length === 0) { setError("Please enter at least one URL."); return; }
    if (urls.length > 50) { setError("Maximum 50 URLs per bulk scan."); return; }

    setScanning(true);
    if (!urlsToScan) setResults([]);
    setProgress({ done: 0, total: urls.length });
    setScanRate(null);
    abortRef.current = false;
    scanStartRef.current = Date.now();

    const base = urlsToScan ? [...results.filter(r => r.status !== "error")] : [];
    const batch = new Array(urls.length).fill(null);
    let done = 0;
    let pointer = 0;
    let fatalError = "";

    const updateLiveStats = () => {
      const elapsed = (Date.now() - (scanStartRef.current || Date.now())) / 1000;
      if (elapsed > 0) setScanRate((done / elapsed).toFixed(1));
      setProgress({ done, total: urls.length });
      setResults([...base, ...batch.filter(Boolean)]);
    };

    const worker = async () => {
      while (!abortRef.current) {
        const current = pointer++;
        if (current >= urls.length) return;
        try {
          batch[current] = await scanOneUrl(urls[current], current);
        } catch (err: any) {
          if (err.code === "AUTH_EXPIRED") {
            fatalError = "Session expired. Please log in again.";
            abortRef.current = true;
            controllersRef.current.forEach(c => c.abort());
            controllersRef.current.clear();
            return;
          }
          if (err.message === "ABORTED") return;
          batch[current] = buildErrorResult(urls[current], current, "Unexpected scan error");
        } finally {
          done++;
          updateLiveStats();
        }
      }
    };

    const workerCount = Math.min(MAX_CONCURRENT_SCANS, urls.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (fatalError) setApiError(fatalError);
    else if (!abortRef.current && done < urls.length) setApiError("Scan stopped before completion.");
    setScanning(false);
  };

  const handleStop = () => {
    abortRef.current = true;
    controllersRef.current.forEach(c => c.abort());
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

  const loadExample = () => setInput("paypa1.com\ngithub.com\nsecure-bank-login.xyz\nbit.ly/xK9mP2\ngoogle.com\nfree-iphone-winner.com\nanthropic.com\nmalware-drop.ru");
  
  const dismissOnboarding = () => {
    localStorage.setItem("pg_bulk_onboarding_dismissed", "1");
    setShowOnboarding(false);
  };

  const failedURLs = results.filter(r => r.status === "error").map(r => r.url);
  const summary = {
    phishing: results.filter(r => r.status === "phishing").length,
    suspicious: results.filter(r => r.status === "suspicious").length,
    safe: results.filter(r => r.status === "safe").length,
    errors: results.filter(r => r.status === "error").length,
  };

  const urlCount = parseURLs(input).length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const pendingRows = scanning ? Math.min(progress.total - progress.done, 3) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Scanner</h1>
        <p className="text-muted-foreground mt-1">Process up to 50 URLs concurrently.</p>
      </div>

      {showOnboarding && (
        <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center text-primary"><Info className="w-5 h-5 mr-2" /> Bulk Scan Tips</h3>
                <p className="text-sm text-muted-foreground mt-1">Process many URLs quickly and review threats in one table.</p>
              </div>
              <button onClick={dismissOnboarding} className="text-xs font-medium text-muted-foreground hover:text-foreground">Hide Guide</button>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">1</span>
                <span className="text-sm font-medium">Paste up to 50 URLs (one per line)</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">2</span>
                <span className="text-sm font-medium">Track scan speed in real time</span>
              </li>
              <li className="flex flex-col bg-background/50 rounded-lg p-4 border border-border">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">3</span>
                <span className="text-sm font-medium">Re-scan failed rows if necessary</span>
              </li>
            </ol>
            <div className="mt-4">
              <button onClick={loadExample} className="text-sm font-medium text-primary hover:underline">Load starter list</button>
            </div>
          </div>
        </div>
      )}

      {apiError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center">
          <XCircle className="mr-2 h-5 w-5 shrink-0" />
          {apiError}
        </div>
      )}

      {/* Input Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Enter URLs</h2>
          <div className="flex gap-2">
            <button onClick={loadExample} disabled={scanning} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">Load example</button>
            <span className="text-muted-foreground text-xs">•</span>
            <button onClick={handleClear} disabled={scanning} className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">Clear</button>
          </div>
        </div>

        <textarea
          rows={6}
          placeholder="https://example.com&#10;https://another-site.org&#10;..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={scanning}
          className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-50 font-mono"
        />

        <div className="flex justify-between items-center text-xs">
          <span className={urlCount > 50 ? "text-destructive font-bold" : "text-muted-foreground"}>
            {urlCount} / 50 URLs
          </span>
          {error && <span className="text-destructive font-medium">{error}</span>}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {scanning ? (
            <button onClick={handleStop} className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground h-10 px-6 py-2 text-sm font-bold transition-colors border border-destructive/20">
              <Square className="mr-2 h-4 w-4" /> Stop Scan
            </button>
          ) : (
            <button 
              onClick={() => handleScan()} 
              disabled={!input.trim() || urlCount > 50} 
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-6 py-2 text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="mr-2 h-4 w-4" /> Scan {urlCount > 0 ? urlCount : ""} URL{urlCount !== 1 ? "s" : ""}
            </button>
          )}

          {scanning && (
            <div className="flex-1 w-full space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{progress.done} / {progress.total} {scanRate && <span className="ml-2 opacity-60">({scanRate}/s)</span>}</span>
                <span className="text-primary">{pct}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Phishing", value: summary.phishing, color: "text-destructive" },
            { label: "Suspicious", value: summary.suspicious, color: "text-amber-500" },
            { label: "Safe", value: summary.safe, color: "text-emerald-500" },
            { label: "Scanned", value: results.length, color: "text-foreground" },
            ...(summary.errors > 0 ? [{ label: "Errors", value: summary.errors, color: "text-muted-foreground" }] : []),
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card shadow-sm p-4 text-center">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</div>
              <div className={`text-3xl font-bold transition-colors ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rescan Failed */}
      {!scanning && failedURLs.length > 0 && (
        <button onClick={() => handleScan(failedURLs)} className="inline-flex items-center justify-center rounded-md border border-input bg-background h-9 px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          <RefreshCw className="mr-2 h-4 w-4" /> Re-scan {failedURLs.length} failed URL{failedURLs.length !== 1 ? "s" : ""}
        </button>
      )}

      {/* Results Table */}
      {(results.length > 0 || scanning) && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold">{scanning ? `Scanning... (${progress.done}/${progress.total})` : `Results — ${results.length} URLs scanned`}</h3>
            {!scanning && results.length > 0 && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${summary.phishing > 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {summary.phishing > 0 ? `${summary.phishing} threat${summary.phishing > 1 ? "s" : ""} found` : "All clear ✓"}
              </span>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium w-16">#</th>
                  <th className="px-6 py-3 font-medium">URL</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Reason</th>
                  <th className="px-6 py-3 font-medium">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r, i) => (
                  <tr key={r.id} className={`hover:bg-muted/50 transition-colors animate-in fade-in ${r.error ? 'bg-destructive/5' : ''}`}>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className={`font-mono text-xs max-w-[240px] truncate ${r.error ? 'text-muted-foreground' : 'text-foreground'}`} title={r.url}>{r.url}</div>
                    </td>
                    <td className="px-6 py-4">
                      {r.error ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-destructive/10 text-destructive border-destructive/20">ERROR</span>
                      ) : (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBgClass(r.status)}`}>{r.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-xs max-w-[200px] truncate ${r.error ? 'text-destructive' : 'text-muted-foreground'}`} title={r.reason}>{r.reason}</div>
                    </td>
                    <td className="px-6 py-4">
                      {r.error ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2 w-24">
                          <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${statusColorClass(r.status).replace('text-', 'bg-')}`} style={{ width: `${Math.min(r.confidence ?? r.risk_score ?? 0, 100)}%` }} />
                          </div>
                          <span className={`font-mono font-bold text-xs ${statusColorClass(r.status)}`}>{r.confidence || r.risk_score}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                
                {pendingRows > 0 && Array.from({ length: pendingRows }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    {[1, 2, 3, 4, 5].map(j => (
                      <td key={j} className="px-6 py-4"><div className="h-4 bg-muted rounded w-20"></div></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!scanning && results.length === 0 && !input.trim() && (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-xl border border-border border-dashed bg-card/50">
          <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
            <Grid className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-bold mb-2">No URLs entered</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">Paste up to 50 URLs above and click Scan. Results save to the database automatically.</p>
          <button onClick={loadExample} className="inline-flex items-center justify-center rounded-md border border-input bg-background h-9 px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            Load example URLs
          </button>
        </div>
      )}
    </div>
  );
}
