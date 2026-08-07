// src/pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import { loginUser, fetchProfile } from "../api/AuthAPI";

function Field({ label, type = "text", value, onChange, error, placeholder }) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;
  return (
    <div className="pg-field">
      <label className="pg-field-label">{label}</label>
      <div className="pg-field-control">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`pg-field-input${error ? " pg-invalid" : ""}`}
          style={{
            padding: type === "password" ? "12px 44px 12px 16px" : "12px 16px",
          }}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="pg-field-toggle"
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && <p className="pg-field-error">{error}</p>}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      // 1 — Get tokens from Django
      const { access, refresh } = await loginUser({ email, password });

      // 2 — Save tokens to localStorage immediately
      localStorage.setItem("pg_access", access);
      localStorage.setItem("pg_refresh", refresh);

      // 3 — Fetch profile (fallback if it fails)
      let profile = { username: email.split("@")[0], email: email };
      try {
        const fetched = await fetchProfile(access);
        if (fetched) {
          // If username looks like an email, extract the part before @
          profile = {
            ...fetched,
            username: fetched.username?.includes("@")
              ? fetched.username.split("@")[0]
              : fetched.username || email.split("@")[0],
          };
        }
      } catch (_) {}

      // 4 — Save to localStorage and Zustand
      localStorage.setItem("pg_user", JSON.stringify(profile));
      setAuth(profile, access, refresh);

      // 5 — Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err.message === "API_NETWORK_ERROR" || !err.response) {
        setApiError(
          "Cannot reach backend API. Make sure Django is running, and check CORS/proxy settings.",
        );
      } else if (err.message === "API_ENDPOINT_NOT_FOUND") {
        setApiError(
          "Login endpoint not found (expected /api/token/). Check Django urls.py and VITE_API_BASE_URL.",
        );
      } else if (err.response?.status === 401) {
        setApiError("Wrong email or password. Please try again.");
      } else {
        setApiError(
          err.response?.data?.detail || "Login failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pg-auth-page">
      <div className="pg-auth-card pg-auth-card-compact">
        {/* Logo */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="pg-logo-icon">
            <img
              src="/phishguard-logo.svg"
              alt="PhishGuard logo"
              className="pg-logo-img"
            />
          </div>
          <div>
            <div className="pg-logo-text">PhishGuard</div>
            <div className="pg-logo-sub">Authenticate To Threat Console</div>
          </div>
        </div>

        {/* Error banner */}
        {apiError && <div className="pg-alert">{apiError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            placeholder="••••••••"
          />

          <div
            style={{
              textAlign: "right",
              marginTop: "-10px",
              marginBottom: "24px",
            }}
          >
            <span className="pg-auth-hint">Forgot password?</span>
          </div>

          <button type="submit" disabled={loading} className="pg-auth-submit">
            {loading ? (
              <>
                <span className="spin">⟳</span> SIGNING IN...
              </>
            ) : (
              "SIGN IN →"
            )}
          </button>
        </form>

        <div
          className="pg-auth-divider"
          style={{ marginTop: "24px", marginBottom: 0 }}
        >
          <div className="pg-auth-divider-line" />
          <span className="pg-auth-divider-text">OR</span>
          <div className="pg-auth-divider-line" />
        </div>

        <p className="pg-auth-meta" style={{ marginTop: "16px" }}>
          Don't have an account?{" "}
          <Link to="/register" className="pg-auth-link">
            Create one →
          </Link>
        </p>
      </div>
    </main>
  );
}
