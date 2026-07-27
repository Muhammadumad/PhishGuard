// src/App.jsx
import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import AuthGuard from "./components/AuthGuard";

const loadDashboard = () => import("./pages/Dashboard");
const loadBulkScanner = () => import("./pages/BulkScanner");
const loadHistory = () => import("./pages/History");
const loadAnalytics = () => import("./pages/Analytics");
const loadQualityCheck = () => import("./pages/QualityCheck");
const loadLanding = () => import("./pages/Landing");
const loadLogin = () => import("./pages/Login");
const loadRegister = () => import("./pages/Register");

const Dashboard = lazy(loadDashboard);
const BulkScanner = lazy(loadBulkScanner);
const History = lazy(loadHistory);
const Analytics = lazy(loadAnalytics);
const QualityCheck = lazy(loadQualityCheck);
const Landing = lazy(loadLanding);
const Login = lazy(loadLogin);
const Register = lazy(loadRegister);

const PUBLIC_PATHS = ["/"];
const AUTH_PATHS = ["/login", "/register"];

function RouteLoader() {
  return (
    <div className="pg-route-loader">
      <div className="pg-route-loader-card">
        <span className="spin">⟳</span>
        Loading page...
      </div>
    </div>
  );
}

function Layout() {
  const { pathname } = useLocation();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuth = AUTH_PATHS.includes(pathname);

  if (isPublic) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Auth pages: full screen, no sidebar, perfectly centered
  if (isAuth) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // App pages: fixed left sidebar + content
  return (
    <>
      <Sidebar />
      <TopNavbar />
      <Suspense fallback={<RouteLoader />}>
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return <Layout />;
}
