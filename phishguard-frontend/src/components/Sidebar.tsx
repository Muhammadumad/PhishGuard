// src/components/Sidebar.jsx
// Sidebar focuses on navigation only. Global actions now live in TopNavbar.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  ClockHistory,
  Grid,
  Search,
  ExclamationCircle,
} from "react-bootstrap-icons";
import useAuthStore from "../store/AuthStore";

let qaPrefetched = false;

const DESKTOP_BREAKPOINT = 768;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 220;

function prefetchQaPage() {
  if (qaPrefetched) return;
  qaPrefetched = true;
  import("../pages/QualityCheck");
}

const NAV = [
  { path: "/dashboard", icon: Grid, label: "Dashboard" },
  { path: "/bulk", icon: Search, label: "Bulk Scan" },
  { path: "/history", icon: ClockHistory, label: "History" },
  { path: "/analytics", icon: Activity, label: "Analytics" },
  { path: "/qa", icon: ExclamationCircle, label: "Quick QA" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const savedWidth = Number(window.localStorage.getItem("pg.sidebar.width"));
    if (!Number.isFinite(savedWidth)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, savedWidth));
  });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startWidth: SIDEBAR_DEFAULT_WIDTH,
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem("pg.sidebar.width", String(sidebarWidth));
  }, [sidebarWidth]);

  const username = user?.username || "User";
  const normalizedName = username.includes("@")
    ? username.split("@")[0]
    : username;
  const displayRole = user?.role === "admin" ? "Admin" : "User";
  const avatarLetter = (normalizedName[0] || "U").toUpperCase();

  useEffect(() => {
    const openFromTopbar = () => setMobileOpen(true);
    window.addEventListener("pg:open-sidebar", openFromTopbar);
    return () => {
      window.removeEventListener("pg:open-sidebar", openFromTopbar);
    };
  }, []);

  const onResizeMove = useCallback((event) => {
    if (!dragRef.current.active) return;

    const delta = event.clientX - dragRef.current.startX;
    const next = Math.min(
      SIDEBAR_MAX_WIDTH,
      Math.max(SIDEBAR_MIN_WIDTH, dragRef.current.startWidth + delta),
    );
    setSidebarWidth(next);
  }, []);

  const endResize = useCallback(() => {
    dragRef.current.active = false;
    document.body.classList.remove("pg-sidebar-resizing");
    window.removeEventListener("pointermove", onResizeMove);
  }, [onResizeMove]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("pg-sidebar-resizing");
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup", endResize);
    };
  }, [endResize, onResizeMove]);

  const startResize = (event) => {
    if (window.innerWidth <= DESKTOP_BREAKPOINT) {
      return;
    }

    dragRef.current.active = true;
    dragRef.current.startX = event.clientX;
    dragRef.current.startWidth = sidebarWidth;
    document.body.classList.add("pg-sidebar-resizing");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", endResize, { once: true });
  };

  const renderSidebarContent = (compact = false) => (
    <>
      {/* Logo */}
      <div
        style={{
          minHeight: "66px",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-hi)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: compact ? "0" : "10px",
            justifyContent: compact ? "center" : "flex-start",
          }}
        >
          <div className="pg-logo-icon">
            <img
              src="/phishguard-logo.svg"
              alt="PhishGuard logo"
              className="pg-logo-img"
            />
          </div>
          {!compact && (
            <div>
              <div className="pg-logo-text">PhishGuard</div>
              <div className="pg-logo-sub">Threat Intelligence Console</div>
            </div>
          )}
        </div>
      </div>

      {user && (
        <div className="pg-sidebar-account">
          <div className="pg-sidebar-account-avatar">{avatarLetter}</div>
          {!compact && (
            <div className="pg-sidebar-account-copy">
              <div className="pg-sidebar-account-name">{normalizedName}</div>
              <div className="pg-sidebar-account-role">{displayRole}</div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "8px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--text-3)",
            padding: "0 6px",
            marginBottom: "6px",
          }}
        >
          Navigation
        </div>
        {NAV.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              aria-label={label}
              onClick={() => setMobileOpen(false)}
              onMouseEnter={() => {
                if (path === "/qa") prefetchQaPage();
              }}
              onFocus={() => {
                if (path === "/qa") prefetchQaPage();
              }}
              className={`pg-nav-link${isActive ? " active" : ""}${compact ? " compact" : ""}`}
            >
              <span
                className="pg-nav-icon"
                style={{ width: "18px", textAlign: "center", flexShrink: 0 }}
              >
                <Icon size={14} />
              </span>
              {!compact && label}
              {isActive && (
                <span
                  style={{
                    marginLeft: compact ? "0" : "auto",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--red)",
                    boxShadow: "0 0 0 0 rgba(255,59,92,0.4)",
                    animation: "pulse-ring 2s ease infinite",
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="pg-sidebar"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {renderSidebarContent()}
        <div
          className="pg-sidebar-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={startResize}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 99,
              backdropFilter: "blur(4px)",
            }}
          />
          <aside
            className="pg-sidebar open"
            style={{
              display: "flex",
              flexDirection: "column",
              transform: "translateX(0)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 16px",
              }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-2)",
                  cursor: "pointer",
                  fontSize: "18px",
                  minHeight: "44px",
                  minWidth: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        </>
      )}
    </>
  );
}
