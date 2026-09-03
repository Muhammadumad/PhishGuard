import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LogOut,
  Sun,
  Target,
  History as ClockHistory,
  AlertCircle,
  Eye,
  Settings,
  LayoutGrid,
  Zap,
  Menu,
  Moon,
  UserPlus,
  Search,
  Sliders,
  X,
  User
} from "lucide-react";
import useAuthStore from "../store/AuthStore";
import useThemeStore from "../store/ThemeStore";
import usePerformanceStore from "../store/PerformanceStore";

const NAV_ITEMS = [
  { path: "/dashboard",  icon: LayoutGrid,  label: "Dashboard",  adminOnly: false },
  { path: "/bulk",       icon: Search,      label: "Bulk Scan",  adminOnly: false },
  { path: "/history",    icon: ClockHistory, label: "History",   adminOnly: false },
  { path: "/analytics",  icon: Activity,    label: "Analytics",  adminOnly: false },
  { path: "/monitoring", icon: Eye,         label: "Monitoring", adminOnly: true  },
  { path: "/qa",         icon: AlertCircle, label: "Quick QA",   adminOnly: false },
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

  const topbarRef    = useRef<HTMLElement>(null);
  const drawerRef    = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const resolvedTheme  = theme === "system" ? systemTheme : theme;
  const username       = user?.username || "Guest User";
  const normalizedName = username.includes("@") ? username.split("@")[0] : username;
  const avatarLetter   = (normalizedName[0] || "G").toUpperCase();
  const displayRole    = user?.role === "admin" ? "Admin" : "User";

  useEffect(() => {
    setSettingsOpen(false);
    setUserMenuOpen(false);
    setConfirmLogout(false);
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
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
      <header
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        ref={topbarRef}
      >
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* LEFT: Brand Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {/* Replace with actual SVG later if needed */}
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-bold tracking-tight text-foreground">PhishGuard</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Console</span>
            </div>
          </Link>

          {/* CENTER: Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Account Controls + Hamburger */}
          <div className="flex items-center space-x-2">
            
            {/* Account badge */}
            {isLoggedIn && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center space-x-2 rounded-full border border-border bg-card px-2 py-1 hover:bg-accent transition-colors"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {avatarLetter}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline-block">{normalizedName}</span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-border bg-popover p-1 shadow-md ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-2 py-2">
                      <p className="text-sm font-medium text-foreground">{normalizedName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email || username}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    {user?.role === "admin" && (
                      <>
                        <Link
                          to="/monitoring"
                          className="flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Eye className="mr-2 h-4 w-4" /> Admin Monitoring
                        </Link>
                        <div className="my-1 h-px bg-border" />
                      </>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {confirmLogout ? "Confirm Sign Out" : "Sign Out"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Guest badge */}
            {isGuest && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center space-x-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-500 hover:bg-amber-500/20 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-bold">Guest</span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-md border border-border bg-popover p-2 shadow-md">
                    <div className="mb-2">
                      <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-500">
                        <Zap className="mr-1 h-3 w-3" /> GUEST SESSION
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Your scans are stored temporarily in this browser tab. All history is automatically wiped when you close the website.
                      </p>
                    </div>
                    <div className="my-2 h-px bg-border" />
                    <Link
                      to="/register"
                      className="flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" /> Create Account
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="mt-2 flex w-full items-center justify-center rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {confirmLogout ? "Confirm Exit" : "Exit Guest Mode"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Settings */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md border border-border bg-popover p-1 shadow-md">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Preferences</div>
                  <button onClick={toggleMode} className="flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent">
                    <Sliders className="mr-2 h-4 w-4" />
                    {mode === "fast" ? "Visual Rich Mode" : "Fast Mode"}
                  </button>
                  <button onClick={toggle} className="flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent">
                    {theme === "system" ? <Target className="mr-2 h-4 w-4" /> : resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                    {theme === "system" ? `Auto (${systemTheme})` : resolvedTheme === "dark" ? "Dark Theme" : "Light Theme"}
                  </button>
                  <button onClick={toggleContrast} className="flex w-full items-center rounded-md px-2 py-2 text-sm hover:bg-accent">
                    <Target className="mr-2 h-4 w-4" />
                    {contrast === "high" ? "Normal Contrast" : "High Contrast"}
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger (Mobile) */}
            <button
              ref={hamburgerRef}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground md:hidden"
              onClick={() => setMobileNavOpen((prev) => !prev)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Backdrop */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={closeMobileNav} />
      )}

      {/* Mobile Nav Drawer */}
      <div
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 z-50 w-3/4 max-w-sm border-l border-border bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out md:hidden ${
          mobileNavOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col space-y-6">
          <nav className="flex flex-col space-y-3">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center space-x-3 rounded-md px-3 py-2 text-base font-medium transition-colors ${
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                  onClick={closeMobileNav}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
