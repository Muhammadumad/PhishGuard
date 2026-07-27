// src/components/AuthGuard.jsx
import { Navigate } from "react-router-dom";

// ── Decode JWT payload without any library ────────────────────────────────────
function parseToken(token) {
  try {
    // JWT has 3 parts: header.payload.signature — we only need the middle part
    const base64 = token.split(".")[1];

    // atob() needs standard base64 — JWT uses URL-safe base64 so fix the chars
    const fixed = base64.replace(/-/g, "+").replace(/_/g, "/");

    // Pad to a multiple of 4 characters if needed
    const padded = fixed + "=".repeat((4 - (fixed.length % 4)) % 4);

    return JSON.parse(atob(padded));
  } catch {
    // If decoding fails for any reason treat token as invalid
    return null;
  }
}

// ── Check token exists AND is not expired ─────────────────────────────────────
function isTokenValid(token) {
  if (!token) return false;

  const payload = parseToken(token);
  if (!payload) return false;

  // payload.exp is in SECONDS — Date.now() is in MILLISECONDS
  if (!payload.exp) return false;

  // 10-second buffer so we don't flash protected content
  // right before the token expires mid-request
  const bufferMs  = 10 * 1000;
  const expiresAt = payload.exp * 1000;

  return Date.now() < expiresAt - bufferMs;
}

// ── Clear all auth data from localStorage ─────────────────────────────────────
function clearAuth() {
  localStorage.removeItem("pg_access");
  localStorage.removeItem("pg_refresh");
  localStorage.removeItem("pg_user");
}

// ── AuthGuard component ───────────────────────────────────────────────────────
export default function AuthGuard({ children }) {
  const token = localStorage.getItem("pg_access");

  if (!isTokenValid(token)) {
    // Remove stale/expired tokens before redirecting so login starts clean
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return children;
}