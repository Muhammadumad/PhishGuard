import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Diagram3,
  ExclamationTriangle,
  LightningCharge,
  Link45deg,
  ShieldCheck,
  ShieldExclamation,
  Terminal,
  XCircle,
} from "react-bootstrap-icons";
import useAuthStore from "../store/authStore";

const FEED_SEQUENCE = [
  {
    kind: "blocked",
    source: "SMTP relay",
    text: "blocked phishing attempt from mail-relay-203.xyz",
  },
  {
    kind: "verified",
    source: "mail auth",
    text: "verified SPF alignment for corp-update.net",
  },
  {
    kind: "blocked",
    source: "URL verdict",
    text: "blocked redirect chain to login-secure-mail.com",
  },
  {
    kind: "queued",
    source: "WHOIS",
    text: "queued domain intel lookup for 0x4f21c9d7",
  },
  {
    kind: "blocked",
    source: "link scan",
    text: "blocked credential lure on shared-files365.com",
  },
  {
    kind: "verified",
    source: "network",
    text: "TLS fingerprint matched known enterprise SaaS",
  },
  {
    kind: "blocked",
    source: "page hash",
    text: "blocked spoofed Microsoft 365 reset page",
  },
];

const STAT_ITEMS = [
  {
    label: "avg detection",
    value: 340,
    suffix: "ms",
    note: "URL verdict after fetch",
  },
  { label: "links blocked", value: 12481, suffix: "", note: "last 24h" },
  { label: "false positives", value: 8, suffix: "%", note: "manual review" },
  {
    label: "domains resolved",
    value: 1894,
    suffix: "",
    note: "DNS, TLS, WHOIS",
  },
];

const COMPARE_ROWS = [
  {
    label: "Triage surface",
    before: "Generic URL list and a score badge.",
    after:
      "URL, redirect chain, issuer, SPF/DKIM, and analyst note in one view.",
  },
  {
    label: "Analyst action",
    before: "Copy evidence into another system.",
    after: "Block, escalate, or clear the case from the verdict panel.",
  },
  {
    label: "Audit trail",
    before: "Timestamped somewhere else.",
    after: "Every line is retained with source, event type, and decision path.",
  },
];

const PROOF_LINES = [
  {
    role: "SOC analyst",
    quote:
      "The feed looks like a terminal, not a brochure. That makes it easier to trust.",
    metric: "14:02 review",
  },
  {
    role: "IT manager",
    quote:
      "We could tell, within a minute, which lures needed blocking and which needed documentation.",
    metric: "2-step escalation",
  },
  {
    role: "MSSP analyst",
    quote:
      "The verdict path is short enough to use under pressure, which is the point.",
    metric: "sub-400ms reads",
  },
];

const TRUST_SYSTEMS = [
  "Microsoft 365",
  "Google Workspace",
  "Jira",
  "Slack",
  "Splunk",
  "Cloudflare",
];

const FEED_WINDOW = 5;

function formatClock(date) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function MagneticLink({ to, variant = "primary", children }) {
  const [style, setStyle] = useState({});

  const handleMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    setStyle({
      "--mx": `${offsetX * 8}px`,
      "--my": `${offsetY * 8}px`,
    });
  };

  return (
    <Link
      to={to}
      className={`pg-action-btn pg-action-btn-${variant}`}
      style={style}
      onMouseMove={handleMove}
      onMouseLeave={() => setStyle({})}
      onFocus={() => setStyle({ "--mx": "0px", "--my": "0px" })}
      onBlur={() => setStyle({})}
    >
      {children}
    </Link>
  );
}

function ThreatFeed() {
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const [logs, setLogs] = useState(() =>
    FEED_SEQUENCE.slice(0, FEED_WINDOW).map((entry, index) => ({
      id: `${entry.kind}-${index}`,
      time: `14:${String(2 + index * 2).padStart(2, "0")}:${String(11 + index).padStart(2, "0")}`,
      ...entry,
    })),
  );

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    let feedIndex = FEED_WINDOW;
    const timer = window.setInterval(() => {
      setLogs((current) => {
        const nextEntry = FEED_SEQUENCE[feedIndex % FEED_SEQUENCE.length];
        feedIndex += 1;

        return [
          {
            id: `${nextEntry.kind}-${Date.now()}`,
            time: formatClock(new Date()),
            ...nextEntry,
          },
          ...current,
        ].slice(0, FEED_WINDOW);
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const mobilePreview = logs.slice(0, 3);

  return (
    <aside className="pg-feed-panel" aria-label="Live detection feed">
      <div className="pg-feed-panel-head">
        <div>
          <div className="pg-feed-kicker">
            <Terminal size={12} /> Live threat feed
          </div>
          <div className="pg-feed-title">
            Blocked entries flash red, then settle to the log.
          </div>
        </div>
        <div className="pg-feed-status">
          <span className="pg-feed-dot" />
          streaming
        </div>
      </div>

      <div className="pg-feed-strip">
        <div>
          <span className="pg-feed-strip-label">Latest block</span>
          <strong>mail-relay-203.xyz</strong>
        </div>
        <div>
          <span className="pg-feed-strip-label">Decision rate</span>
          <strong>97.2%</strong>
        </div>
        <div>
          <span className="pg-feed-strip-label">Current latency</span>
          <strong>340ms</strong>
        </div>
      </div>

      <div className="pg-feed-window">
        {logs.map((entry, index) => (
          <div
            className={`pg-feed-line state-${entry.kind}`}
            key={entry.id}
            style={{ animationDelay: `${index * 55}ms` }}
          >
            <span className="pg-feed-time">{entry.time}</span>
            <span className="pg-feed-source">{entry.source}</span>
            <span className="pg-feed-message">{entry.text}</span>
            <span className={`pg-feed-pill state-${entry.kind}`}>
              {entry.kind}
            </span>
          </div>
        ))}
      </div>

      <div className="pg-feed-mobile">
        <div className="pg-feed-mobile-title">Last 3 alerts</div>
        <div className="pg-feed-mobile-list">
          {mobilePreview.map((entry) => (
            <div
              className={`pg-feed-mobile-item state-${entry.kind}`}
              key={entry.id}
            >
              <span>{entry.time}</span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CountUpStat({ value, suffix = "", active }) {
  const [count, setCount] = useState(active ? 0 : value);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (prefersReducedMotion) {
      setCount(value);
      return undefined;
    }

    const duration = 800;
    const start = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [active, value]);

  return (
    <strong>
      {count}
      {suffix}
    </strong>
  );
}

function SectionHeader({ eyebrow, title, copy }) {
  return (
    <div className="pg-section-header">
      <div className="pg-section-eyebrow">{eyebrow}</div>
      <h2 className="pg-section-title">{title}</h2>
      <p className="pg-section-copy">{copy}</p>
    </div>
  );
}

function ComparisonSection() {
  return (
    <section
      className="pg-comparison-section fade-up"
      style={{ animationDelay: "0.08s" }}
    >
      <SectionHeader
        eyebrow="Before and after"
        title="Same attack surface. Different operator experience."
        copy="The difference is whether the analyst sees a generic score or a decision path they can actually defend under pressure."
      />

      <div className="pg-comparison-grid">
        <article className="pg-comparison-card pg-comparison-card-before">
          <div className="pg-comparison-label">Before PhishGuard</div>
          <div className="pg-comparison-title">Noise first, context later.</div>
          {COMPARE_ROWS.map((row) => (
            <div className="pg-comparison-row" key={row.label}>
              <div className="pg-comparison-row-label">{row.label}</div>
              <div className="pg-comparison-row-copy">{row.before}</div>
            </div>
          ))}
        </article>

        <article className="pg-comparison-card pg-comparison-card-after">
          <div className="pg-comparison-label">With PhishGuard</div>
          <div className="pg-comparison-title">
            Evidence first, decision second.
          </div>
          {COMPARE_ROWS.map((row) => (
            <div className="pg-comparison-row" key={row.label}>
              <div className="pg-comparison-row-label">{row.label}</div>
              <div className="pg-comparison-row-copy">{row.after}</div>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section
      className="pg-proof-section fade-up"
      style={{ animationDelay: "0.12s" }}
    >
      <SectionHeader
        eyebrow="Operator notes"
        title="Short, factual feedback from people who would actually use it."
        copy="No hype language, no vendor clichés. Just what a security buyer wants to know in under ten seconds."
      />

      <div className="pg-trust-systems" aria-label="Systems supported">
        {TRUST_SYSTEMS.map((system) => (
          <span className="pg-trust-system" key={system}>
            {system}
          </span>
        ))}
      </div>

      <div className="pg-proof-feed">
        {PROOF_LINES.map((line) => (
          <article className="pg-proof-row" key={line.role}>
            <div className="pg-proof-meta">
              <span className="pg-proof-role">{line.role}</span>
              <span className="pg-proof-metric">{line.metric}</span>
            </div>
            <p className="pg-proof-quote">{line.quote}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  const { isLoggedIn } = useAuthStore();
  const [countsActive, setCountsActive] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const element = statsRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCountsActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const primaryPath = isLoggedIn ? "/dashboard" : "/register";
  const secondaryPath = isLoggedIn ? "/dashboard" : "/login";

  return (
    <main className="pg-landing-page">
      <section
        className="pg-hero-shell fade-up"
        style={{ animationDelay: "0.03s" }}
      >
        <div className="pg-hero-copy">
          <div className="pg-hero-kicker">REAL-TIME PHISHING INTERDICTION</div>
          <h1 className="pg-hero-title">
            <span className="pg-hero-title-line">Catches phishing links</span>
            <span className="pg-hero-title-line">before the click.</span>
          </h1>

          <p className="pg-hero-copy-text">
            PhishGuard blocks suspicious links, shows why they were blocked, and
            keeps the analyst trail short enough to use in a real incident.
          </p>

          <div className="pg-hero-actions">
            <MagneticLink to={primaryPath} variant="primary">
              Start free scan <ArrowRight size={14} />
            </MagneticLink>
            <MagneticLink to={secondaryPath} variant="secondary">
              {isLoggedIn ? "Open analyst console" : "Sign in"}
            </MagneticLink>
          </div>

          <div className="pg-hero-rules">
            <div>
              <span className="pg-hero-rules-label">Detection time</span>
              <strong>340ms</strong>
            </div>
            <div>
              <span className="pg-hero-rules-label">Protocols checked</span>
              <strong>SMTP / SPF / DKIM / TLS</strong>
            </div>
            <div>
              <span className="pg-hero-rules-label">Decision path</span>
              <strong>block, verify, or escalate</strong>
            </div>
          </div>
        </div>

        <ThreatFeed />
      </section>

      <section className="pg-stats-band" ref={statsRef}>
        {STAT_ITEMS.map((item) => (
          <article className="pg-stat-item" key={item.label}>
            <div className="pg-stat-value">
              <CountUpStat
                value={item.value}
                suffix={item.suffix}
                active={countsActive}
              />
            </div>
            <div className="pg-stat-label">{item.label}</div>
            <div className="pg-stat-note">{item.note}</div>
          </article>
        ))}
      </section>

      <ComparisonSection />

      <ProofSection />

      <section
        className="pg-visibility-band fade-up"
        style={{ animationDelay: "0.16s" }}
      >
        <div className="pg-visibility-card">
          <CheckCircle size={16} />
          <div>
            <div className="pg-visibility-label">Verified</div>
            <div className="pg-visibility-value">
              Known SaaS fingerprint, SPF aligned, safe to release.
            </div>
          </div>
        </div>
        <div className="pg-visibility-card pg-visibility-card-alert">
          <ShieldExclamation size={16} />
          <div>
            <div className="pg-visibility-label">Blocked</div>
            <div className="pg-visibility-value">
              Redirect chain, domain age, and lure pattern matched the block
              rule.
            </div>
          </div>
        </div>
        <div className="pg-visibility-card">
          <LightningCharge size={16} />
          <div>
            <div className="pg-visibility-label">Queued</div>
            <div className="pg-visibility-value">
              Waiting on WHOIS and TLS enrichment before a final verdict.
            </div>
          </div>
        </div>
      </section>

      <div
        className="pg-feed-legend fade-up"
        style={{ animationDelay: "0.18s" }}
      >
        <span>
          <ShieldCheck size={12} /> Verified
        </span>
        <span>
          <XCircle size={12} /> Blocked
        </span>
        <span>
          <ExclamationTriangle size={12} /> Queued
        </span>
        <span>
          <Link45deg size={12} /> URL / relay / chain intelligence
        </span>
        <span>
          <Diagram3 size={12} /> Analyst decision path
        </span>
      </div>
    </main>
  );
}
