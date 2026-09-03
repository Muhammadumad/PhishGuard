import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopNavbar from "./components/TopNavbar";
import AuthGuard from "./components/AuthGuard";
import useAuthStore from "./store/AuthStore";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import BulkScanner from "./pages/BulkScanner";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import QualityCheck from "./pages/QualityCheck";
import Monitoring from "./pages/Monitoring";
import Login from "./pages/Login";
import Register from "./pages/Register";

const PUBLIC_PATHS = ["/"];
const AUTH_PATHS = ["/login", "/register"];

/** Redirects non-admin users away from admin-only routes */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function Layout() {
  const { pathname } = useLocation();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuth = AUTH_PATHS.includes(pathname);

  if (isPublic) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Auth pages: full screen, perfectly centered
  if (isAuth) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // App pages: Tailwind Layout with Top Glassmorphism Navbar
  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col font-sans">
      <TopNavbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/bulk"
            element={
              <AuthGuard>
                <BulkScanner />
              </AuthGuard>
            }
          />
          <Route
            path="/history"
            element={
              <AuthGuard>
                <History />
              </AuthGuard>
            }
          />
          <Route
            path="/analytics"
            element={
              <AuthGuard>
                <Analytics />
              </AuthGuard>
            }
          />
          <Route
            path="/qa"
            element={
              <AuthGuard>
                <QualityCheck />
              </AuthGuard>
            }
          />
          <Route
            path="/monitoring"
            element={
              <AuthGuard>
                <AdminGuard>
                  <Monitoring />
                </AdminGuard>
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <Layout />;
}
