import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  CheckCircleFill,
  ClockHistory,
  Cpu,
  Diagram3,
  ExclamationTriangle,
  Globe,
  LightningCharge,
  PauseFill,
  PlayFill,
  Search,
  ShieldCheck,
  ShieldExclamation,
  Terminal,
  XCircleFill,
} from "react-bootstrap-icons";
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
    icon: LightningCharge,
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
    icon: Diagram3,
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

function MiniRiskGauge({ score, verdict }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = verdict === "blocked" ? "#ef4444" : verdict === "suspicious" ? "#f59e0b" : "#10b981";

  return (
    <div className="pg-hero-gauge">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
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
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
        <text x="36" y="35" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" style={{ fontFamily: "var(--mono)", fontSize: "14px", fontWeight: 700 }}>
          {score}
        </text>
        <text x="36" y="47" textAnchor="middle" fill="#94a3b8" style={{ fontFamily: "var(--mono)", fontSize: "8px" }}>
          /100
        </text>
      </svg>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn, isGuest, setGuestMode } = useAuthStore();
  
  // Hero interactive scanner state
  const [inputUrl, setInputUrl] = useState(SAMPLE_URLS[0].url);
  const [activeScan, setActiveScan] = useState(SAMPLE_URLS[0]);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState("");

  // Feature showcase tab state
  const [activeTabId, setActiveTabId] = useState("interdiction");

  // ROI Calculator state
  const [monthlyVolume, setMonthlyVolume] = useState(2500);
  const [analystRate, setAnalystRate] = useState(55);

  // Live feed state
  const [feedLogs, setFeedLogs] = useState(INITIAL_FEED);
  const [feedFilter, setFeedFilter] = useState("all");
  const [feedPaused, setFeedPaused] = useState(false);

  // Handler for Try Free / Start Free Scan (directly opens Dashboard as guest or authenticated)
  const handleTryFree = (e) => {
    if (e) e.preventDefault();
    if (!isLoggedIn && !isGuest) {
      setGuestMode();
    }
    navigate("/dashboard");
  };

  // Run interactive scan demo
  const handleRunScan = (targetItem) => {
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

    setTimeout(() => {
      setScanStep("Inspecting TLS Fingerprint & SPF/DKIM...");
    }, 350);

    setTimeout(() => {
      setScanStep("Evaluating Redirect Chain...");
    }, 700);

    setTimeout(() => {
      setActiveScan(item);
      setInputUrl(item.url);
      setScanning(false);
      setScanStep("");
    }, 1000);
  };

  // Live feed stream simulation
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

  // ROI calculations
  const hoursSaved = Math.round((monthlyVolume * 4.5) / 60);
  const monthlySavings = Math.round(hoursSaved * analystRate);

  const filteredLogs = feedLogs.filter((log) => (feedFilter === "all" ? true : log.kind === feedFilter));

  const activeTab = FEATURE_TABS.find((t) => t.id === activeTabId) || FEATURE_TABS[0];
  const ActiveTabIcon = activeTab.icon;

  return (
    <main className="pg-landing-v2">
      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="pg-landing-hero">
        <div className="pg-hero-main-content">
          <div className="pg-hero-badge-pill">
            <span className="pg-pill-dot" />
            <span className="pg-pill-text">ENTERPRISE PHISHING INTERDICTION</span>
          </div>

          <h1 className="pg-hero-headline">
            Stop credential lures <br />
            <span className="pg-headline-gradient">before the first click.</span>
          </h1>

          <p className="pg-hero-subhead">
            PhishGuard intercepts malicious links in real-time, analyzes SPF/DKIM records and TLS fingerprints under 340ms, and provides SOC analysts with an instant verdict.
          </p>

          <div className="pg-hero-cta-group">
            <button type="button" onClick={handleTryFree} className="pg-btn-hero-primary">
              Start Free Scan <ArrowRight size={15} className="pg-btn-icon-shift" />
            </button>
            <Link to={isLoggedIn || isGuest ? "/dashboard" : "/login"} className="pg-btn-hero-secondary">
              {isLoggedIn || isGuest ? "Open Console" : "Sign In"}
            </Link>
          </div>

          {/* Key Metrics Strip */}
          <div className="pg-hero-metrics-strip">
            <div className="pg-metric-box">
              <span className="pg-metric-num">340ms</span>
              <span className="pg-metric-lbl">Avg Detection Time</span>
            </div>
            <div className="pg-metric-divider" />
            <div className="pg-metric-box">
              <span className="pg-metric-num">99.4%</span>
              <span className="pg-metric-lbl">Threat Accuracy</span>
            </div>
            <div className="pg-metric-divider" />
            <div className="pg-metric-box">
              <span className="pg-metric-num">0.08%</span>
              <span className="pg-metric-lbl">False Positive Rate</span>
            </div>
          </div>
        </div>

        {/* ── INTERACTIVE LIVE SCANNER WIDGET ──────────────────────────────── */}
        <div className="pg-hero-demo-card">
          <div className="pg-demo-card-header">
            <div className="pg-demo-card-title">
              <Terminal size={14} className="pg-text-indigo" /> Live URL Inspector Demo
            </div>
            <span className="pg-demo-status-badge">
              <span className="pg-live-dot" /> Interactive
            </span>
          </div>

          {/* Sample preset buttons */}
          <div className="pg-sample-chips-row">
            <span className="pg-chip-label">Try sample:</span>
            {SAMPLE_URLS.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`pg-sample-chip ${activeScan.url === item.url ? "active" : ""}`}
                onClick={() => handleRunScan(item)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="pg-demo-input-bar">
            <Globe size={15} className="pg-input-icon" />
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste suspicious URL (e.g. https://login-verify...)"
              className="pg-demo-url-field"
            />
            <button
              type="button"
              disabled={scanning || !inputUrl.trim()}
              onClick={() => handleRunScan()}
              className="pg-btn-demo-scan"
            >
              {scanning ? (
                <>
                  <span className="pg-spinner" /> Scanning...
                </>
              ) : (
                <>
                  <Search size={13} /> Test Scan
                </>
              )}
            </button>
          </div>

          {/* Scan result display */}
          <div className="pg-demo-result-box">
            {scanning ? (
              <div className="pg-demo-scanning-state">
                <div className="pg-scan-pulse-ring" />
                <div className="pg-scan-status-text">{scanStep}</div>
              </div>
            ) : (
              <div className="pg-demo-verdict-layout">
                <MiniRiskGauge score={activeScan.score} verdict={activeScan.verdict} />

                <div className="pg-demo-verdict-info">
                  <div className="pg-verdict-top-row">
                    <span className={`pg-verdict-badge pg-verdict-${activeScan.verdict}`}>
                      {activeScan.verdict === "blocked" && <ShieldExclamation size={12} />}
                      {activeScan.verdict === "suspicious" && <ExclamationTriangle size={12} />}
                      {activeScan.verdict === "verified" && <ShieldCheck size={12} />}
                      {activeScan.verdict.toUpperCase()}
                    </span>
                    <span className="pg-verdict-score-lbl">
                      Risk Index: <strong>{activeScan.score}/100</strong>
                    </span>
                  </div>

                  <p className="pg-verdict-reason">{activeScan.reason}</p>

                  <div className="pg-verdict-tech-grid">
                    <div>
                      <span>SPF / DKIM:</span> <strong>{activeScan.details.spf}</strong>
                    </div>
                    <div>
                      <span>TLS Issuer:</span> <strong>{activeScan.details.tls}</strong>
                    </div>
                    <div>
                      <span>Domain Age:</span> <strong>{activeScan.details.age}</strong>
                    </div>
                    <div>
                      <span>Redirect Chain:</span> <strong>{activeScan.details.chain}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── TRUST BRAND STRIP ───────────────────────────────────────────── */}
      <section className="pg-trust-section">
        <span className="pg-trust-headline">PROTECTING ENTERPRISE WORKFLOWS ACROSS</span>
        <div className="pg-trust-logos">
          {TRUST_BRANDS.map((brand) => (
            <span key={brand} className="pg-trust-brand-pill">
              <CheckCircle size={12} className="pg-text-indigo" /> {brand}
            </span>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE FEATURE MATRIX SHOWCASE ─────────────────────────── */}
      <section className="pg-section-wrapper">
        <div className="pg-section-header">
          <span className="pg-section-kicker">ENTERPRISE CAPABILITIES</span>
          <h2 className="pg-section-title">Built for security teams that move fast</h2>
          <p className="pg-section-subtitle">
            PhishGuard replaces static blocklists with active evidence scoring and automated response workflows.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="pg-feature-tabs-nav">
          {FEATURE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                className={`pg-feature-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content panel */}
        <div className="pg-feature-tab-card">
          <div className="pg-tab-content-left">
            <span className="pg-tab-badge">{activeTab.badge}</span>
            <h3 className="pg-tab-headline">{activeTab.headline}</h3>
            <p className="pg-tab-copy">{activeTab.copy}</p>

            <div className="pg-tab-metrics-row">
              {activeTab.metrics.map((m) => (
                <div key={m.label} className="pg-tab-metric-box">
                  <span className="pg-tab-metric-val">{m.val}</span>
                  <span className="pg-tab-metric-lbl">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pg-tab-content-right">
            <div className="pg-tab-preview-box">
              <div className="pg-preview-top-bar">
                <span className="pg-dot-red" />
                <span className="pg-dot-yellow" />
                <span className="pg-dot-green" />
                <span className="pg-preview-title-text">
                  <ActiveTabIcon size={12} /> phishguard-console // {activeTab.id}
                </span>
              </div>
              <div className="pg-preview-body">
                <div className="pg-preview-code-line">
                  <span className="pg-code-prompt">$</span> phishguard inspect --url "https://auth-update.net"
                </div>
                <div className="pg-preview-code-line pg-code-response">
                  [SUCCESS] DNS Resolved -&gt; 104.21.48.11 (Cloudflare Edge)
                </div>
                <div className="pg-preview-code-line pg-code-response">
                  [WARNING] Domain Age: 4 days (High Risk Category)
                </div>
                <div className="pg-preview-code-line pg-code-response">
                  [CRITICAL] Spoofed Microsoft 365 Form Hash Match (0x9a4f)
                </div>
                <div className="pg-preview-code-line pg-code-verdict">
                  VERDICT: BLOCKED (Risk Index 96/100) -&gt; Action: Enforcement Active
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE STREAMING THREAT LOG FEED ──────────────────────────────── */}
      <section className="pg-section-wrapper">
        <div className="pg-section-header">
          <span className="pg-section-kicker">REAL-TIME THREAT TELEMETRY</span>
          <h2 className="pg-section-title">Live Interdiction Feed</h2>
          <p className="pg-section-subtitle">
            See threats caught across the network as they occur. Hover over the feed to pause streaming.
          </p>
        </div>

        <div
          className="pg-live-feed-card"
          onMouseEnter={() => setFeedPaused(true)}
          onMouseLeave={() => setFeedPaused(false)}
        >
          <div className="pg-feed-card-header">
            <div className="pg-feed-header-left">
              <Terminal size={15} className="pg-text-indigo" />
              <span>Streaming Event Log</span>
              <span className="pg-feed-pause-indicator">
                {feedPaused ? (
                  <>
                    <PauseFill size={12} /> Paused
                  </>
                ) : (
                  <>
                    <PlayFill size={12} className="pg-text-emerald" /> Live Stream
                  </>
                )}
              </span>
            </div>

            {/* Category filter pills */}
            <div className="pg-feed-filter-pills">
              {["all", "blocked", "verified", "queued"].map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`pg-feed-filter-btn ${feedFilter === f ? "active" : ""}`}
                  onClick={() => setFeedFilter(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Feed list */}
          <div className="pg-feed-list">
            {filteredLogs.map((log) => (
              <div key={log.id} className={`pg-feed-row state-${log.kind}`}>
                <span className="pg-feed-time">{log.time}</span>
                <span className="pg-feed-source">{log.source}</span>
                <span className="pg-feed-text">{log.text}</span>
                <span className={`pg-feed-badge state-${log.kind}`}>
                  {log.kind === "blocked" && <XCircleFill size={10} />}
                  {log.kind === "verified" && <CheckCircleFill size={10} />}
                  {log.kind === "queued" && <ClockHistory size={10} />}
                  {log.kind.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE ANALYST SAVINGS / ROI CALCULATOR ─────────────────── */}
      <section className="pg-section-wrapper">
        <div className="pg-section-header">
          <span className="pg-section-kicker">IMPACT CALCULATOR</span>
          <h2 className="pg-section-title">Calculate your SOC Analyst ROI</h2>
          <p className="pg-section-subtitle">
            Automating initial link triage frees up analyst hours and reduces incident response cycles.
          </p>
        </div>

        <div className="pg-calculator-card">
          <div className="pg-calc-controls-col">
            <div className="pg-calc-field">
              <div className="pg-calc-label-row">
                <label className="pg-calc-lbl">Monthly Suspicious Link Alerts</label>
                <span className="pg-calc-val">{monthlyVolume.toLocaleString()} alerts</span>
              </div>
              <input
                type="range"
                min="500"
                max="25000"
                step="500"
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="pg-calc-slider"
              />
              <div className="pg-calc-minmax">
                <span>500</span>
                <span>25,000</span>
              </div>
            </div>

            <div className="pg-calc-field" style={{ marginTop: "24px" }}>
              <div className="pg-calc-label-row">
                <label className="pg-calc-lbl">SOC Analyst Hourly Rate ($)</label>
                <span className="pg-calc-val">${analystRate}/hr</span>
              </div>
              <input
                type="range"
                min="35"
                max="120"
                step="5"
                value={analystRate}
                onChange={(e) => setAnalystRate(Number(e.target.value))}
                className="pg-calc-slider"
              />
              <div className="pg-calc-minmax">
                <span>$35/hr</span>
                <span>$120/hr</span>
              </div>
            </div>
          </div>

          <div className="pg-calc-results-col">
            <div className="pg-calc-result-box">
              <span className="pg-calc-res-label">Analyst Hours Saved / Month</span>
              <span className="pg-calc-res-big">{hoursSaved} hrs</span>
              <span className="pg-calc-res-sub">~{(hoursSaved / 160).toFixed(1)} full-time analyst equivalents</span>
            </div>

            <div className="pg-calc-result-box">
              <span className="pg-calc-res-label">Estimated Monthly Savings</span>
              <span className="pg-calc-res-big pg-text-emerald">${monthlySavings.toLocaleString()}</span>
              <span className="pg-calc-res-sub">Direct triage cost reduction</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA CARD ───────────────────────────────────────────────── */}
      <section className="pg-cta-banner">
        <div className="pg-cta-inner">
          <span className="pg-cta-kicker">READY TO SECURE YOUR WORKFLOW?</span>
          <h2 className="pg-cta-title">Start catching phishing lures today.</h2>
          <p className="pg-cta-copy">
            Deploy PhishGuard in minutes. Integrate via REST API or test single URLs directly in your browser.
          </p>

          <div className="pg-cta-btn-group">
            <button type="button" onClick={handleTryFree} className="pg-btn-hero-primary">
              Get Started Free <ArrowRight size={15} />
            </button>
            <Link to={isLoggedIn || isGuest ? "/dashboard" : "/login"} className="pg-btn-hero-secondary">
              {isLoggedIn || isGuest ? "Open Console" : "Sign In to Console"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
