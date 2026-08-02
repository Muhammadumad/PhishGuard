import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BoxArrowRight,
  BrightnessHigh,
  Bullseye,
  ClockHistory,
  ExclamationCircle,
  Gear,
  Grid,
  LightningCharge,
  MoonStars,
  PersonPlus,
  Search,
  Sliders,
} from "react-bootstrap-icons";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/ThemeStore";
import usePerformanceStore from "../store/PerformanceStore";

const NAV_ITEMS = [
  { path: "/dashboard", icon: Grid, label: "Dashboard" },
  { path: "/bulk", icon: Search, label: "Bulk Scan" },
  { path: "/history", icon: ClockHistory, label: "History" },
  { path: "/analytics", icon: Activity, label: "Analytics" },
  { path: "/qa", icon: ExclamationCircle, label: "Quick QA" },
];

export default function TopNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isLoggedIn, isGuest } = useAuthStore();
  const { theme, contrast, systemTheme, toggle, toggleContrast } = useThemeStore();
  const { mode, toggleMode } = usePerformanceStore();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const menuRef = useRef(null);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const username = user?.username || "Guest User";
  const normalizedName = username.includes("@") ? username.split("@")[0] : username;
  const avatarLetter = (normalizedName[0] || "G").toUpperCase();
  const displayRole = user?.role === "admin" ? "Admin" : "User";

  // Close menus on route change or click outside
  useEffect(() => {
    setSettingsOpen(false);
    setUserMenuOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 3500);
      return;
    }
    logout();
    navigate("/login");
  };

  return (
    <header className="pg-glass-topbar">
      <div className="pg-topbar-inner" ref={menuRef}>
        {/* ── Left: Brand & Logo ────────────────────────────────────────── */}
        <Link to="/dashboard" className="pg-topbar-brand">
          <div className="pg-logo-icon">
            <img src="/phishguard-logo.svg" alt="PhishGuard logo" className="pg-logo-img" />
          </div>
          <div className="pg-brand-text">
            <span className="pg-brand-name">PhishGuard</span>
            <span className="pg-brand-tag">Console</span>
          </div>
        </Link>

        {/* ── Center: Horizontal Page Links ─────────────────────────────── */}
        <nav className="pg-topbar-nav" aria-label="Main Navigation">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`pg-topbar-link${isActive ? " active" : ""}`}
              >
                <Icon size={14} className="pg-nav-link-icon" />
                <span>{label}</span>
                {isActive && <span className="pg-nav-active-dot" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Right Controls: Account / Guest & Settings ───────────────── */}
        <div className="pg-topbar-right">
          {/* Account Button (When Logged In) */}
          {isLoggedIn && (
            <div className="pg-user-menu-wrap">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className={`pg-account-badge-btn${userMenuOpen ? " active" : ""}`}
                aria-label="User Account Menu"
              >
                <div className="pg-avatar-circle">{avatarLetter}</div>
                <span className="pg-account-label">{normalizedName}</span>
                <span className="pg-role-tag">{displayRole}</span>
              </button>

              {userMenuOpen && (
                <div className="pg-glass-popover pg-user-popover">
                  <div className="pg-popover-header">
                    <div className="pg-avatar-large">{avatarLetter}</div>
                    <div className="pg-popover-user-info">
                      <div className="pg-popover-username">{normalizedName}</div>
                      <div className="pg-popover-user-email">{user?.email || username}</div>
                    </div>
                  </div>
                  <div className="pg-popover-divider" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="pg-popover-btn pg-text-danger"
                  >
                    <BoxArrowRight size={14} />
                    {confirmLogout ? "Confirm Sign Out" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Guest Badge Button (When in Guest Mode) */}
          {isGuest && (
            <div className="pg-user-menu-wrap">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className={`pg-guest-badge-btn${userMenuOpen ? " active" : ""}`}
                aria-label="Guest Session Info"
              >
                <LightningCharge size={13} className="pg-guest-icon-pulse" />
                <span className="pg-guest-label">Guest Mode</span>
              </button>

              {userMenuOpen && (
                <div className="pg-glass-popover pg-guest-popover">
                  <div className="pg-popover-header">
                    <div className="pg-guest-popover-badge">
                      <LightningCharge size={14} /> GUEST SESSION
                    </div>
                    <p className="pg-popover-subtext">
                      Your scans are stored temporarily in this browser tab. All history is automatically wiped when you close the website.
                    </p>
                  </div>
                  <div className="pg-popover-divider" />
                  <Link
                    to="/register"
                    className="pg-popover-btn pg-popover-btn-primary"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <PersonPlus size={14} /> Create Account to Save History
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="pg-popover-btn pg-text-danger"
                  >
                    <BoxArrowRight size={14} />
                    {confirmLogout ? "Confirm Exit" : "Exit Guest Mode"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Settings Dropdown */}
          <div className="pg-user-menu-wrap">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`pg-settings-trigger-btn${settingsOpen ? " active" : ""}`}
              aria-label="Quick Settings"
            >
              <Gear size={15} />
            </button>

            {settingsOpen && (
              <div className="pg-glass-popover pg-settings-popover">
                <div className="pg-popover-section-label">Preferences</div>
                <button type="button" onClick={toggleMode} className="pg-popover-btn">
                  <Sliders size={13} /> {mode === "fast" ? "Visual Rich Mode" : "Fast Mode"}
                </button>
                <button type="button" onClick={toggle} className="pg-popover-btn">
                  {theme === "system" ? (
                    <Bullseye size={13} />
                  ) : resolvedTheme === "dark" ? (
                    <BrightnessHigh size={13} />
                  ) : (
                    <MoonStars size={13} />
                  )}
                  {theme === "system"
                    ? `Auto (${systemTheme})`
                    : resolvedTheme === "dark"
                      ? "Dark Theme"
                      : "Light Theme"}
                </button>
                <button type="button" onClick={toggleContrast} className="pg-popover-btn">
                  <Bullseye size={13} />
                  {contrast === "high" ? "Normal Contrast" : "High Contrast"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

