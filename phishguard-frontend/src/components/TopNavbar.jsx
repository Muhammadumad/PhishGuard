import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BoxArrowRight,
  Bullseye,
  BrightnessHigh,
  Gear,
  List,
  MoonStars,
  Sliders,
} from "react-bootstrap-icons";
import useAuthStore from "../store/authStore";
import useThemeStore from "../store/ThemeStore";
import usePerformanceStore from "../store/PerformanceStore";

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/bulk": "Bulk Scanner",
  "/history": "History",
  "/analytics": "Analytics",
  "/qa": "Quick QA",
};

const PAGE_CONTEXT = {
  "/dashboard": "Live scan overview and threat status",
  "/bulk": "Batch scan URLs with live progress",
  "/history": "Search, sort, and export past scans",
  "/analytics": "Trend analysis and verdict insights",
  "/qa": "Quick checks for UI and workflow validation",
};

export default function TopNavbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { theme, contrast, systemTheme, toggle, toggleContrast } =
    useThemeStore();
  const { mode, toggleMode } = usePerformanceStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const pageTitle = PAGE_TITLES[pathname] || "PhishGuard";
  const pageContext = PAGE_CONTEXT[pathname] || "Security console";

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 3000);
      return;
    }
    logout();
    navigate("/login");
  };

  const openMobileSidebar = () => {
    window.dispatchEvent(new Event("pg:open-sidebar"));
  };

  useEffect(() => {
    setSettingsOpen(false);
  }, [pathname]);

  const settingsButtons = (
    <>
      <button
        type="button"
        onClick={toggleMode}
        className="pg-btn-ghost"
        aria-label={
          mode === "fast" ? "Switch to visual rich mode" : "Switch to fast mode"
        }
      >
        <Sliders size={13} /> {mode === "fast" ? "Visual Rich" : "Fast Mode"}
      </button>

      <button
        type="button"
        onClick={toggle}
        className="pg-btn-ghost"
        aria-label="Cycle theme mode"
        aria-pressed={resolvedTheme === "light"}
      >
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
            ? "Dark"
            : "Light"}
      </button>

      <button
        type="button"
        onClick={toggleContrast}
        className="pg-btn-ghost"
        aria-label={
          contrast === "high"
            ? "Switch to normal contrast"
            : "Switch to high contrast"
        }
        aria-pressed={contrast === "high"}
      >
        <Bullseye size={13} />{" "}
        {contrast === "high" ? "Normal Contrast" : "High Contrast"}
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className="pg-btn-ghost"
        style={{ color: confirmLogout ? "var(--red)" : "var(--text-2)" }}
      >
        <BoxArrowRight size={13} />{" "}
        {confirmLogout ? "Click again to sign out" : "Sign Out"}
      </button>
    </>
  );

  return (
    <header className="pg-topbar">
      <div className="pg-topbar-title-wrap">
        <button
          type="button"
          onClick={openMobileSidebar}
          className="pg-topbar-menu"
          aria-label="Open navigation"
        >
          <List size={16} />
        </button>
        <h1 className="pg-topbar-title">{pageTitle}</h1>
        <p className="pg-topbar-sub">{pageContext}</p>
      </div>

      <div className="pg-topbar-mobile-settings">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          className="pg-topbar-settings-trigger"
          aria-label="Open quick settings"
          aria-expanded={settingsOpen}
        >
          <Gear size={15} />
        </button>
        {settingsOpen && (
          <div className="pg-topbar-settings-panel">{settingsButtons}</div>
        )}
      </div>

      <div className="pg-topbar-actions">{settingsButtons}</div>
    </header>
  );
}
