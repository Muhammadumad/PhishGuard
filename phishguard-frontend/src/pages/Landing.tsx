import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck, Search, Terminal, Globe, Zap, Cpu, Pause, Play, Clock, Network, AlertTriangle } from "lucide-react";
import useAuthStore from "../store/AuthStore";

const SAMPLE_URLS = [
  {
    url: "https://paypal-security-verify-account.net/login",
    label: "Phishing Lure",
    verdict: "blocked",
    score: 94,
    reason: "Domain registered 2 days ago • Brand spoofing PayPal • Missing SPF alignment",
    details: { spf: "Fail", tls: "Self-Signed", age: "2 days", chain: "3 redirects" },
  },
  {
    url: "https://corp-mail-update-2026.org/auth",
    label: "Suspicious Redirect",
    verdict: "suspicious",
    score: 68,
    reason: "Unusual TLD • High entropy hostname • Fresh SSL certificate",
    details: { spf: "SoftFail", tls: "Let's Encrypt", age: "14 days", chain: "2 redirects" },
  },
  {
    url: "https://github.com/Muhammadumad/PhishGuard",
    label: "Legitimate URL",
    verdict: "verified",
    score: 8,
    reason: "Established domain age • Valid TLS issuer • SPF & DKIM aligned",
    details: { spf: "Pass", tls: "DigiCert EV", age: "16+ years", chain: "Direct" },
  },
];

const INITIAL_FEED = [
  { id: "1", time: "14:02:11", source: "SMTP Relay", text: "Blocked credential lure mail-relay-203.xyz", kind: "blocked" },
  { id: "2", time: "14:02:08", source: "Mail Auth", text: "Verified SPF alignment for corp-update.net", kind: "verified" },
  { id: "3", time: "14:02:03", source: "URL Engine", text: "Blocked redirect chain to login-secure-mail.com", kind: "blocked" },
  { id: "4", time: "14:01:58", source: "WHOIS Intel", text: "Queued domain lookup for 0x4f21c9d7", kind: "queued" },
  { id: "5", time: "14:01:52", source: "TLS Inspection", text: "Verified Let's Encrypt cert for app.internal.io", kind: "verified" },
];

const FEATURE_TABS = [
  {
    id: "interdiction",
    title: "Pre-Click Interdiction",
    icon: Zap,
    headline: "Intercept phishing lures before the browser renders the page",
    copy: "PhishGuard analyzes incoming links in real time, inspecting DNS records, domain reputation, and TLS fingerprints in under 340 milliseconds.",
    badge: "< 340ms Latency",
    metrics: [
      { label: "Scan Time", val: "340ms" },
      { label: "Accuracy", val: "99.4%" },
      { label: "False Positives", val: "0.08%" },
    ],
  },
  {
    id: "engine",
    title: "Multi-Vendor Engine",
    icon: Network,
    headline: "Unified evidence scoring across 6 verification layers",
    copy: "Combines WHOIS domain age, SPF/DKIM authentication, SSL issuer validation, HTTP redirect chain analysis, and HTML page hash matching.",
    badge: "6-Layer Analysis",
    metrics: [
      { label: "SPF / DKIM", val: "Enforced" },
      { label: "TLS Fingerprint", val: "Validated" },
      { label: "WHOIS Lookups", val: "Automated" },
    ],
  },
  {
    id: "integrations",
    title: "SIEM & API Integration",
    icon: Cpu,
    headline: "Plug directly into Splunk, Slack, Microsoft Sentinel, & Webhooks",
    copy: "Trigger automated blocklists, alert security channels, and push immutable audit logs to your enterprise SIEM with zero manual effort.",
    badge: "REST & Webhooks",
    metrics: [
      { label: "API Latency", val: "< 50ms" },
      { label: "Supported SIEMs", val: "12+" },
      { label: "Uptime SLA", val: "99.99%" },
    ],
  },
  {
    id: "audit",
    title: "Compliance Audit Trail",
    icon: ShieldCheck,
    headline: "Every analyst decision stored with cryptographically verified logs",
    copy: "Retain complete decision histories for compliance audits. Export structured JSON or CSV reports for executive reviews in one click.",
    badge: "SOC 2 Ready",
    metrics: [
      { label: "Log Retention", val: "365 Days" },
      { label: "Format", val: "JSON / CSV" },
      { label: "Audit Level", val: "Strict" },
    ],
  },
];

const TRUST_BRANDS = [
  "Microsoft 365",
  "Google Workspace",
  "Cloudflare",
  "Splunk",
  "Slack",
  "Okta",
];

function MiniRiskGauge({ score, verdict }: { score: number, verdict: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = verdict === "blocked" ? "#ef4444" : verdict === "suspicious" ? "#f59e0b" : "#10b981";

  return (
    <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center bg-card rounded-full shadow-inner border border-border">
      <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" className="stroke-muted" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold font-mono leading-none">{score}</span>
        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">/100</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn, isGuest, setGuestMode } = useAuthStore();
  
  const [inputUrl, setInputUrl] = useState(SAMPLE_URLS[0].url);
  const [activeScan, setActiveScan] = useState(SAMPLE_URLS[0]);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");
  const [activeTabId, setActiveTabId] = useState("interdiction");
  const [monthlyVolume, setMonthlyVolume] = useState(2500);
  const [analystRate, setAnalystRate] = useState(55);
  const [feedLogs, setFeedLogs] = useState(INITIAL_FEED);
  const [feedFilter, setFeedFilter] = useState("all");
  const [feedPaused, setFeedPaused] = useState(false);

  const handleTryFree = (e: any) => {
    if (e) e.preventDefault();
    if (!isLoggedIn && !isGuest) {
      setGuestMode();
    }
    navigate("/dashboard");
  };

  const handleRunScan = (targetItem?: any) => {
    const item = targetItem || {
      url: inputUrl,
      label: inputUrl.includes("paypal") || inputUrl.includes("login") ? "Phishing Lure" : "Analyzed Link",
      verdict: inputUrl.includes("paypal") || inputUrl.includes("login") ? "blocked" : "verified",
      score: inputUrl.includes("paypal") || inputUrl.includes("login") ? 92 : 12,
      reason: inputUrl.includes("paypal") || inputUrl.includes("login")
        ? "Domain registered recently • Spoofed login form detected • SPF failure"
        : "Valid SSL certificate • Clean domain reputation • SPF & DKIM aligned",
      details: {
        spf: inputUrl.includes("paypal") ? "Fail" : "Pass",
        tls: inputUrl.includes("paypal") ? "Self-Signed" : "Valid EV",
        age: inputUrl.includes("paypal") ? "3 days" : "5+ years",
        chain: inputUrl.includes("paypal") ? "2 redirects" : "Direct",
      },
    };

    setScanning(true);
    setScanStep("Resolving DNS & Host Reputation...");
    setTimeout(() => setScanStep("Inspecting TLS Fingerprint & SPF/DKIM..."), 350);
    setTimeout(() => setScanStep("Evaluating Redirect Chain..."), 700);
    setTimeout(() => {
      setActiveScan(item);
      setInputUrl(item.url);
      setScanning(false);
      setScanStep("");
    }, 1000);
  };

  useEffect(() => {
    if (feedPaused) return undefined;
    const interval = setInterval(() => {
      const newEntry = {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        source: ["URL Engine", "SMTP Relay", "TLS Inspection", "WHOIS Intel"][Math.floor(Math.random() * 4)],
        text: [
          "Intercepted suspicious redirect to account-verify-sec.org",
          "Verified SPF/DKIM alignment for mail.enterprise.com",
          "Blocked zero-day phishing lure payload",
          "TLS certificate revoked for login-auth-portal.tk",
        ][Math.floor(Math.random() * 4)],
        kind: ["blocked", "verified", "blocked", "queued"][Math.floor(Math.random() * 4)],
      };
      setFeedLogs((prev) => [newEntry, ...prev.slice(0, 5)]);
    }, 3500);
    return () => clearInterval(interval);
  }, [feedPaused]);

  const hoursSaved = Math.round((monthlyVolume * 4.5) / 60);
  const monthlySavings = Math.round(hoursSaved * analystRate);
  const filteredLogs = feedLogs.filter((log) => (feedFilter === "all" ? true : log.kind === feedFilter));
  const activeTab = FEATURE_TABS.find((t) => t.id === activeTabId) || FEATURE_TABS[0];
  const ActiveTabIcon = activeTab.icon;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/30">
      
      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8 overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl mix-blend-screen opacity-50"></div>
        <div className="absolute top-40 left-0 -translate-x-1/3 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl mix-blend-screen opacity-50"></div>

        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Hero Text */}
            <div className="flex flex-col max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6 self-start">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                Enterprise Phishing Interdiction
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
                Stop credential lures <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">before the first click.</span>
              </h1>
              
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                PhishGuard intercepts malicious links in real-time, analyzes SPF/DKIM records and TLS fingerprints under 340ms, and provides SOC analysts with an instant verdict.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <button onClick={handleTryFree} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 shadow-md">
                  Start Free Scan <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <Link to={isLoggedIn || isGuest ? "/dashboard" : "/login"} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-12 px-8">
                  {isLoggedIn || isGuest ? "Open Console" : "Sign In"}
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border/50">
                <div>
                  <div className="text-2xl font-bold text-foreground">340ms</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Avg Detection Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">99.4%</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">Threat Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">0.08%</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-1">False Positive Rate</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Widget */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-indigo-500/20 rounded-2xl blur-xl opacity-50 transform -rotate-3"></div>
              
              <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 backdrop-blur-md">
                  <div className="flex items-center gap-2 font-semibold text-sm text-indigo-500">
                    <Terminal className="w-4 h-4" /> Live URL Inspector Demo
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span> Interactive
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Try sample:</span>
                    {SAMPLE_URLS.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => handleRunScan(item)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${activeScan.url === item.url ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-muted-foreground"><Globe className="w-4 h-4" /></div>
                    <input
                      type="url"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="Paste suspicious URL (e.g. https://login-verify...)"
                      className="w-full h-12 pl-10 pr-32 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    />
                    <button
                      disabled={scanning || !inputUrl.trim()}
                      onClick={() => handleRunScan()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary text-primary-foreground rounded-md text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                    >
                      {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Search className="w-3.5 h-3.5 mr-1.5" /> Test Scan</>}
                    </button>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4 min-h-[160px] flex flex-col justify-center">
                    {scanning ? (
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin mb-4"></div>
                        <div className="text-sm font-medium text-primary animate-pulse">{scanStep}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-5">
                        <MiniRiskGauge score={activeScan.score} verdict={activeScan.verdict} />
                        
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                              activeScan.verdict === "blocked" ? "bg-destructive/10 text-destructive border-destructive/20" : 
                              activeScan.verdict === "suspicious" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                              "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            }`}>
                              {activeScan.verdict === "blocked" && <ShieldAlert className="w-3.5 h-3.5" />}
                              {activeScan.verdict === "suspicious" && <AlertTriangle className="w-3.5 h-3.5" />}
                              {activeScan.verdict === "verified" && <ShieldCheck className="w-3.5 h-3.5" />}
                              {activeScan.verdict}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">Risk Index: <strong className="text-foreground">{activeScan.score}/100</strong></span>
                          </div>
                          
                          <p className="text-sm font-medium leading-snug">{activeScan.reason}</p>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 pt-3 border-t border-border">
                            <div className="text-[10px]"><span className="text-muted-foreground">SPF/DKIM:</span> <strong className="text-foreground">{activeScan.details.spf}</strong></div>
                            <div className="text-[10px]"><span className="text-muted-foreground">TLS Issuer:</span> <strong className="text-foreground">{activeScan.details.tls}</strong></div>
                            <div className="text-[10px]"><span className="text-muted-foreground">Domain Age:</span> <strong className="text-foreground">{activeScan.details.age}</strong></div>
                            <div className="text-[10px]"><span className="text-muted-foreground">Chain:</span> <strong className="text-foreground">{activeScan.details.chain}</strong></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BRAND STRIP ───────────────────────────────────────────── */}
      <section className="py-10 border-y border-border bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Protecting enterprise workflows across</p>
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8">
            {TRUST_BRANDS.map((brand) => (
              <span key={brand} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-full text-sm font-semibold shadow-sm text-foreground/80">
                <CheckCircle2 className="w-4 h-4 text-indigo-500" /> {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE FEATURE MATRIX SHOWCASE ─────────────────────────── */}
      <section className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-primary font-bold text-sm tracking-widest uppercase mb-3">Enterprise Capabilities</div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Built for security teams that move fast</h2>
          <p className="text-muted-foreground text-lg">PhishGuard replaces static blocklists with active evidence scoring and automated response workflows.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Tabs Navigation */}
          <div className="flex flex-col gap-2 lg:w-1/3">
            {FEATURE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-xl font-medium text-left transition-all ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]' 
                      : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  {tab.title}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="lg:w-2/3">
            <div className="rounded-2xl border border-border bg-card shadow-lg p-8 md:p-10 flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {activeTab.badge}
                </div>
                <h3 className="text-2xl font-bold leading-tight">{activeTab.headline}</h3>
                <p className="text-muted-foreground leading-relaxed">{activeTab.copy}</p>
                
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  {activeTab.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="text-xl font-bold">{m.val}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full max-w-sm rounded-xl overflow-hidden bg-[#0d1117] border border-border shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                  </div>
                  <div className="text-[10px] font-mono text-[#8b949e] flex items-center gap-1.5 ml-2">
                    <ActiveTabIcon className="w-3 h-3" /> phishguard-cli // {activeTab.id}
                  </div>
                </div>
                <div className="p-4 font-mono text-[11px] leading-relaxed text-[#c9d1d9] space-y-2 h-[200px] flex flex-col justify-center">
                  <div><span className="text-primary font-bold">$</span> phishguard inspect --url "https://auth-update.net"</div>
                  <div className="text-[#3fb950]">[SUCCESS] DNS Resolved -{'>'} 104.21.48.11</div>
                  <div className="text-[#d29922]">[WARNING] Domain Age: 4 days (High Risk)</div>
                  <div className="text-[#f85149] font-bold">[CRITICAL] Spoofed Form Hash Match (0x9a4f)</div>
                  <div className="pt-2 mt-2 border-t border-[#30363d]">
                    <span className="bg-[#f85149]/20 text-[#ff7b72] px-1 py-0.5 rounded mr-2">VERDICT: BLOCKED</span> 
                    Risk Index 96/100
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE STREAMING THREAT LOG FEED ──────────────────────────────── */}
      <section className="py-24 px-6 lg:px-8 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="text-primary font-bold text-sm tracking-widest uppercase mb-3">Real-Time Threat Telemetry</div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Live Interdiction Feed</h2>
            <p className="text-muted-foreground text-lg">See threats caught across the network as they occur. Hover over the feed to pause streaming.</p>
          </div>

          <div 
            className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden max-w-4xl mx-auto"
            onMouseEnter={() => setFeedPaused(true)}
            onMouseLeave={() => setFeedPaused(false)}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-border bg-muted/50 gap-4">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-sm">Streaming Event Log</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background border border-border text-[10px] font-bold uppercase tracking-wider">
                  {feedPaused ? (
                    <><Pause className="w-3 h-3 text-amber-500" /> Paused</>
                  ) : (
                    <><Play className="w-3 h-3 text-emerald-500" /> Live Stream</>
                  )}
                </span>
              </div>
              
              <div className="flex bg-background rounded-md border border-border p-1">
                {["all", "blocked", "verified", "queued"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFeedFilter(f)}
                    className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors ${feedFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col font-mono text-[11px] sm:text-xs">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground w-16 shrink-0">{log.time}</span>
                  <span className="font-semibold text-indigo-400 w-28 shrink-0">{log.source}</span>
                  <span className="text-foreground/80 flex-1 truncate" title={log.text}>{log.text}</span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 w-24 justify-center ${
                    log.kind === "blocked" ? "bg-destructive/10 text-destructive border-destructive/20" : 
                    log.kind === "verified" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                    "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }`}>
                    {log.kind === "blocked" && <ShieldAlert className="w-3 h-3" />}
                    {log.kind === "verified" && <ShieldCheck className="w-3 h-3" />}
                    {log.kind === "queued" && <Clock className="w-3 h-3" />}
                    {log.kind}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ANALYST SAVINGS / ROI CALCULATOR ─────────────────── */}
      <section className="py-24 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-primary font-bold text-sm tracking-widest uppercase mb-3">Impact Calculator</div>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Calculate your SOC Analyst ROI</h2>
          <p className="text-muted-foreground text-lg">Automating initial link triage frees up analyst hours and reduces incident response cycles.</p>
        </div>

        <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-border bg-muted/20">
            <div className="space-y-10">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="font-semibold text-sm">Monthly Suspicious Link Alerts</label>
                  <span className="text-xl font-bold text-primary">{monthlyVolume.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">alerts</span></span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="25000"
                  step="500"
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium">
                  <span>500</span>
                  <span>25,000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="font-semibold text-sm">SOC Analyst Hourly Rate</label>
                  <span className="text-xl font-bold text-primary">${analystRate}<span className="text-sm font-normal text-muted-foreground">/hr</span></span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="120"
                  step="5"
                  value={analystRate}
                  onChange={(e) => setAnalystRate(Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2 font-medium">
                  <span>$35/hr</span>
                  <span>$120/hr</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 md:p-12 flex flex-col justify-center gap-10 bg-gradient-to-br from-card to-muted/20">
            <div>
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Analyst Hours Saved / Month</div>
              <div className="text-5xl font-extrabold tracking-tight mb-2">{hoursSaved} <span className="text-2xl text-muted-foreground font-semibold">hrs</span></div>
              <div className="text-sm text-muted-foreground font-medium">~{(hoursSaved / 160).toFixed(1)} full-time analyst equivalents</div>
            </div>

            <div className="pt-8 border-t border-border">
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Estimated Monthly Savings</div>
              <div className="text-5xl font-extrabold tracking-tight text-emerald-500 mb-2">${monthlySavings.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground font-medium">Direct triage cost reduction</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA CARD ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-primary to-indigo-600 p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
          {/* Abstract pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[length:24px_24px]"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest bg-white/20 rounded-full mb-6 text-white border border-white/20">Ready to secure your workflow?</span>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">Start catching phishing lures today.</h2>
            <p className="text-lg text-white/80 max-w-2xl mb-10">Deploy PhishGuard in minutes. Integrate via REST API or test single URLs directly in your browser.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button onClick={handleTryFree} className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-white text-primary font-bold hover:bg-white/90 transition-colors shadow-lg">
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <Link to={isLoggedIn || isGuest ? "/dashboard" : "/login"} className="inline-flex items-center justify-center h-14 px-8 rounded-lg bg-black/20 text-white border border-white/30 hover:bg-black/30 font-bold transition-colors">
                {isLoggedIn || isGuest ? "Open Console" : "Sign In to Console"}
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-border mt-auto">
        &copy; {new Date().getFullYear()} PhishGuard. All rights reserved.
      </footer>
    </div>
  );
}
