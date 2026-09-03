import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BoxArrowRight,
  BrightnessHigh,
  Bullseye,
  ClockHistory,
  ExclamationCircle,
  Eye,
  Gear,
  Grid,
  LightningCharge,
  List,
  MoonStars,
  PersonPlus,
  Search,
  Sliders,
  X,
} from "react-bootstrap-icons";
import useAuthStore from "../store/AuthStore";
import useThemeStore from "../store/ThemeStore";
import usePerformanceStore from "../store/PerformanceStore";

const NAV_ITEMS = [
  { path: "/dashboard",  icon: Grid,              label: "Dashboard",  adminOnly: false },
  { path: "/bulk",       icon: Search,            label: "Bulk Scan",  adminOnly: false },
  { path: "/history",    icon: ClockHistory,      label: "History",    adminOnly: false },
  { path: "/analytics",  icon: Activity,          label: "Analytics",  adminOnly: false },
  { path: "/monitoring", icon: Eye,               label: "Monitoring", adminOnly: true  },
  { path: "/qa",         icon: ExclamationCircle, label: "Quick QA",   adminOnly: false },
];

export default function TopNavbar() {
  const { pathname } = useLocation();
  const navigate     = useNavigate();

  const { user, logout, isLoggedIn, isGuest } = useAuthStore();
  const { theme, contrast, systemTheme, toggle, toggleContrast } = useThemeStore();
  const { mode, toggleMode } = usePerformanceStore();

  const isAdmin = user?.role === "admin";
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const [confirmLogout,  setConfirmLogout]  = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);

  /* ref covers the topbar inner — click-outside closes popovers */
  const topbarRef    = useRef(null);
  /* ref for the first focusable element inside the mobile drawer */
  const drawerRef    = useRef(null);
  const hamburgerRef = useRef(null);

  const resolvedTheme  = theme === "system" ? systemTheme : theme;
  const username       = user?.username || "Guest User";
  const normalizedName = username.includes("@") ? username.split("@")[0] : username;
  const avatarLetter   = (normalizedName[0] || "G").toUpperCase();
  const displayRole    = user?.role === "admin" ? "Admin" : "User";

  /* ── Close everything on route change ────────────────────────────────── */
  useEffect(() => {
    setSettingsOpen(false);
    setUserMenuOpen(false);
    setConfirmLogout(false);
    setMobileNavOpen(false);
  }, [pathname]);

  /* ── Click-outside: close popovers (but not mobile drawer) ───────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target)) {
        setUserMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Keyboard: Escape closes mobile drawer, returns focus to hamburger ── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (mobileNavOpen) {
          setMobileNavOpen(false);
          hamburgerRef.current?.focus();
        }
        if (settingsOpen)  setSettingsOpen(false);
        if (userMenuOpen)  setUserMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen, settingsOpen, userMenuOpen]);

  /* ── Lock body scroll while mobile drawer is open ────────────────────── */
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  /* ── Move focus into drawer when it opens ─────────────────────────────── */
  useEffect(() => {
    if (mobileNavOpen && drawerRef.current) {
      const firstFocusable = drawerRef.current.querySelector(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [mobileNavOpen]);

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 3500);
      return;
    }
    logout();
    navigate("/login");
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <>
      {/* ── Glass Sticky Top Navigation Bar ───────────────────────────────── */}
      <header className="pg-glass-topbar" ref={topbarRef}>
        <div className="pg-topbar-inner">

          {/* LEFT: Brand Logo ─────────────────────────────────────────────── */}
          <Link to="/dashboard" className="pg-topbar-brand" aria-label="PhishGuard — go to Dashboard">
            <div className="pg-logo-icon">
              <img src="/phishguard-logo.svg" alt="" className="pg-logo-img" />
            </div>
            <div className="pg-brand-text">
              <span className="pg-brand-name">PhishGuard</span>
              <span className="pg-brand-tag">Console</span>
            </div>
          </Link>

          {/* CENTER: Desktop Horizontal Nav Links (hidden < 768px) ─────────── */}
          <nav
            className="pg-topbar-nav pg-desktop-nav"
            aria-label="Main navigation"
          >
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`pg-topbar-link${isActive ? " active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={14} className="pg-nav-link-icon" aria-hidden="true" />
                  <span>{label}</span>
                  {isActive && <span className="pg-nav-active-dot" aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Account Controls + Hamburger ─────────────────────────── */}
          <div className="pg-topbar-right">

            {/* Account badge — logged-in user */}
            {isLoggedIn && (
              <div className="pg-user-menu-wrap">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className={`pg-account-badge-btn${userMenuOpen ? " active" : ""}`}
                  aria-label="Open user account menu"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <div className="pg-avatar-circle" aria-hidden="true">{avatarLetter}</div>
                  <span className="pg-account-label">{normalizedName}</span>
                  <span className="pg-role-tag">{displayRole}</span>
                </button>

                {userMenuOpen && (
                  <div
                    className="pg-glass-popover pg-user-popover"
                    role="menu"
                    aria-label="User account options"
                  >
                    <div className="pg-popover-header">
                      <div className="pg-avatar-large" aria-hidden="true">{avatarLetter}</div>
                      <div className="pg-popover-user-info">
                        <div className="pg-popover-username">{normalizedName}</div>
                        <div className="pg-popover-user-email">{user?.email || username}</div>
                      </div>
                    </div>
                    <div className="pg-popover-divider" />
                    {user?.role === "admin" && (
                      <>
                        <Link
                          to="/monitoring"
                          role="menuitem"
                          className="pg-popover-btn"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Eye size={14} aria-hidden="true" /> Admin Monitoring
                        </Link>
                        <div className="pg-popover-divider" />
                      </>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="pg-popover-btn pg-text-danger"
                    >
                      <BoxArrowRight size={14} aria-hidden="true" />
                      {confirmLogout ? "Confirm Sign Out" : "Sign Out"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Guest badge */}
            {isGuest && (
              <div className="pg-user-menu-wrap">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className={`pg-guest-badge-btn${userMenuOpen ? " active" : ""}`}
                  aria-label="Guest session info"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <LightningCharge size={13} className="pg-guest-icon-pulse" aria-hidden="true" />
                  <span className="pg-guest-label">Guest</span>
                </button>

                {userMenuOpen && (
                  <div
                    className="pg-glass-popover pg-guest-popover"
                    role="menu"
                    aria-label="Guest session options"
                  >
                    <div className="pg-popover-header">
                      <div className="pg-guest-popover-badge">
                        <LightningCharge size={14} aria-hidden="true" /> GUEST SESSION
                      </div>
                      <p className="pg-popover-subtext">
                        Your scans are stored temporarily in this browser tab.
                        All history is automatically wiped when you close the website.
                      </p>
                    </div>
                    <div className="pg-popover-divider" />
                    <Link
                      to="/register"
                      role="menuitem"
                      className="pg-popover-btn pg-popover-btn-primary"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <PersonPlus size={14} aria-hidden="true" /> Create Account to Save History
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="pg-popover-btn pg-text-danger"
                    >
                      <BoxArrowRight size={14} aria-hidden="true" />
                      {confirmLogout ? "Confirm Exit" : "Exit Guest Mode"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Settings */}
            <div className="pg-user-menu-wrap">
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className={`pg-settings-trigger-btn${settingsOpen ? " active" : ""}`}
                aria-label="Quick settings"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
              >
                <Gear size={15} aria-hidden="true" />
              </button>

              {settingsOpen && (
                <div
                  className="pg-glass-popover pg-settings-popover"
                  role="menu"
                  aria-label="Quick settings options"
                >
                  <div className="pg-popover-section-label">Preferences</div>
                  <button type="button" role="menuitem" onClick={toggleMode} className="pg-popover-btn">
                    <Sliders size={13} aria-hidden="true" />
                    {mode === "fast" ? "Visual Rich Mode" : "Fast Mode"}
                  </button>
                  <button type="button" role="menuitem" onClick={toggle} className="pg-popover-btn">
                    {theme === "system" ? (
                      <Bullseye size={13} aria-hidden="true" />
                    ) : resolvedTheme === "dark" ? (
                      <BrightnessHigh size={13} aria-hidden="true" />
                    ) : (
                      <MoonStars size={13} aria-hidden="true" />
                    )}
                    {theme === "system"
                      ? `Auto (${systemTheme})`
                      : resolvedTheme === "dark"
                        ? "Dark Theme"
                        : "Light Theme"}
                  </button>
                  <button type="button" role="menuitem" onClick={toggleContrast} className="pg-popover-btn">
                    <Bullseye size={13} aria-hidden="true" />
                    {contrast === "high" ? "Normal Contrast" : "High Contrast"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Hamburger Toggle — visible only < 768px ──────────────── */}
            <button
              ref={hamburgerRef}
              type="button"
              className={`pg-mobile-hamburger-btn${mobileNavOpen ? " is-open" : ""}`}
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="pg-mobile-drawer"
              aria-haspopup="dialog"
            >
              {mobileNavOpen
                ? <X size={22} aria-hidden="true" />
                : <List size={22} aria-hidden="true" />
              }
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ──────────────────────────────────────────
          Rendered OUTSIDE <header> so it can cover full viewport height.
          Clicking the backdrop closes the drawer.
      ─────────────────────────────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="pg-drawer-backdrop"
          aria-hidden="true"
          onClick={closeMobileNav}
        />
      )}

      {/* ── Mobile Slide-Down Navigation Drawer ─────────────────────────────
          id matches aria-controls on the hamburger button.
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        id="pg-mobile-drawer"
        className={`pg-mobile-nav-drawer${mobileNavOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        ref={drawerRef}
        inert={mobileNavOpen ? undefined : ""}
      >
        {/* Page links */}
        <nav className="pg-mobile-nav-list" aria-label="Mobile page navigation">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`pg-mobile-nav-link${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={closeMobileNav}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {isActive && (
                  <span className="pg-mobile-active-indicator" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="pg-mobile-drawer-footer">
          {isGuest && (
            <div className="pg-mobile-guest-info">
              <div className="pg-mobile-guest-badge">
                <LightningCharge size={14} aria-hidden="true" /> Guest Mode Active
              </div>
              <p className="pg-mobile-guest-text">
                Session data wipes automatically on tab close.
              </p>
              <Link
                to="/register"
                className="pg-mobile-drawer-btn pg-mobile-btn-primary"
                onClick={closeMobileNav}
              >
                <PersonPlus size={16} aria-hidden="true" /> Create Free Account
              </Link>
            </div>
          )}

          <div className="pg-mobile-drawer-actions">
            <button type="button" onClick={toggle} className="pg-mobile-drawer-btn">
              {resolvedTheme === "dark"
                ? <BrightnessHigh size={16} aria-hidden="true" />
                : <MoonStars size={16} aria-hidden="true" />
              }
              <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="pg-mobile-drawer-btn pg-text-danger"
            >
              <BoxArrowRight size={16} aria-hidden="true" />
              <span>{isGuest ? "Exit Guest" : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
