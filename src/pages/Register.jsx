// src/pages/Register.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import { registerUser } from "../api/AuthAPI";

// ── Reusable field (same as Login) ───────────────────────────────────────────
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

// ── Password strength indicator ──────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const levels = [
    { label: "Weak", color: "#ff3b5c" },
    { label: "Fair", color: "#ff6b35" },
    { label: "Good", color: "#ffb020" },
    { label: "Strong", color: "#00d084" },
    { label: "Strong", color: "#00d084" },
  ];
  const { label, color } = levels[score];

  return (
    <div style={{ marginTop: "-8px", marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "3px",
              borderRadius: "4px",
              background: i <= score ? color : "rgba(255,255,255,0.07)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: "10px",
          color,
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Register page ────────────────────────────────────────────────────────────
export default function Register() {
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!form.confirmPassword)
      e.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    if (!agreed) e.agreed = "You must accept the terms to continue";
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
      const { access, refresh } = await registerUser({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setAuth(
        {
          username: form.name.trim() // use the name they entered
            ? form.name.trim().split(" ")[0] // first word of full name
            : form.email.split("@")[0], // fallback: part before @
          email: form.email,
        },
        access,
        refresh,
      );
      setSuccess(true);
    } catch (err) {
      console.error(
        "REGISTER ERROR:",
        err.response?.status,
        err.response?.data,
        err.message,
      );
      if (err.message === "API_NETWORK_ERROR" || !err.response) {
        setApiError(
          "Cannot reach backend API. Make sure Django is running, and check CORS/proxy settings.",
        );
      } else if (err.message === "API_ENDPOINT_NOT_FOUND") {
        setApiError(
          "Register endpoint not found (expected /api/register/). Check Django urls.py and VITE_API_BASE_URL.",
        );
      } else {
        const status = err.response?.status;
        const data = err.response?.data;

        // Show the EXACT error from Django
        if (data?.email)
          setApiError(
            "Email: " +
              (Array.isArray(data.email) ? data.email[0] : data.email),
          );
        else if (data?.username)
          setApiError(
            "Username: " +
              (Array.isArray(data.username) ? data.username[0] : data.username),
          );
        else if (data?.password)
          setApiError(
            "Password: " +
              (Array.isArray(data.password) ? data.password[0] : data.password),
          );
        else if (data?.password2)
          setApiError(
            "Confirm: " +
              (Array.isArray(data.password2)
                ? data.password2[0]
                : data.password2),
          );
        else if (data?.error) setApiError(data.error);
        else if (data?.detail) setApiError(data.detail);
        else if (typeof data === "object" && data !== null)
          setApiError("Error " + status + ": " + JSON.stringify(data));
        else if (typeof data === "string" && data.length < 500)
          setApiError("Server error " + status + ": " + data);
        else
          setApiError(
            "Server returned HTTP " + status + " (non-JSON). Check Render logs for the full traceback.",
          );
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ────────────────────────────────────────
  if (success) {
    return (
      <main className="pg-auth-page">
        <div className="pg-auth-card pg-auth-card-compact pg-auth-success">
          <div className="pg-auth-success-icon">OK</div>
          <h2
            style={{
              fontFamily: "var(--display)",
              fontWeight: 800,
              fontSize: "22px",
              color: "var(--success)",
              marginBottom: "8px",
            }}
          >
            Account Created!
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            Welcome to PhishGuard,{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {form.name.split(" ")[0]}
            </strong>
            !
          </p>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "13px",
              marginBottom: "28px",
            }}
          >
            You're now logged in and ready to scan URLs.
          </p>
          <Link
            to="/dashboard"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #ff3b5c, #ff6b35)",
              borderRadius: "12px",
              color: "white",
              fontFamily: "var(--mono)",
              fontWeight: 700,
              fontSize: "13px",
              padding: "12px 28px",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(255,59,92,0.35)",
            }}
          >
            Start Scanning →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pg-auth-page">
      <div className="pg-auth-card pg-auth-card-wide">
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
            <div className="pg-logo-sub">Initialize Analyst Profile</div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "24px" }}>
          {["Account Info", "Password", "Terms"].map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: "3px",
                  borderRadius: "4px",
                  marginBottom: "5px",
                  background:
                    i === 0
                      ? form.name && form.email
                        ? "var(--success)"
                        : "var(--danger)"
                      : i === 1
                        ? form.password &&
                          form.password === form.confirmPassword
                          ? "var(--success)"
                          : "var(--border-bright)"
                        : agreed
                          ? "var(--success)"
                          : "var(--border-bright)",
                  transition: "background 0.3s",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  letterSpacing: "0.5px",
                }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* API error */}
        {apiError && <div className="pg-alert">{apiError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <Field
            label="Full Name"
            value={form.name}
            onChange={set("name")}
            error={errors.name}
            placeholder="Enter the username"
          />

          {/* Email */}
          <Field
            label="Email Address"
            type="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            placeholder="you@example.com"
          />

          {/* Password */}
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            placeholder="Min. 8 characters"
          />
          <PasswordStrength password={form.password} />

          {/* Confirm password */}
          <Field
            label="Confirm Password"
            type="password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            error={errors.confirmPassword}
            placeholder="Repeat your password"
          />

          {/* Password match tick */}
          {form.confirmPassword && (
            <div
              style={{
                marginTop: "-8px",
                marginBottom: "16px",
                fontFamily: "var(--mono)",
                fontSize: "11px",
              }}
            >
              {form.password === form.confirmPassword ? (
                <span style={{ color: "var(--success)" }}>
                  ✓ Passwords match
                </span>
              ) : (
                <span style={{ color: "var(--danger)" }}>
                  ✗ Passwords do not match
                </span>
              )}
            </div>
          )}

          {/* Terms checkbox */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
              }}
            >
              <div
                onClick={() => setAgreed((a) => !a)}
                style={{
                  width: "18px",
                  height: "18px",
                  flexShrink: 0,
                  border: `2px solid ${errors.agreed ? "var(--danger)" : agreed ? "var(--success)" : "var(--border-bright)"}`,
                  borderRadius: "5px",
                  marginTop: "1px",
                  background: agreed ? "var(--success)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  cursor: "pointer",
                }}
              >
                {agreed && (
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                I agree to the{" "}
                <span style={{ color: "var(--danger)", cursor: "pointer" }}>
                  Terms of Service
                </span>{" "}
                and{" "}
                <span style={{ color: "var(--danger)", cursor: "pointer" }}>
                  Privacy Policy
                </span>
              </span>
            </label>
            {errors.agreed && (
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--danger)",
                  marginTop: "6px",
                  marginBottom: 0,
                  marginLeft: "30px",
                }}
              >
                {errors.agreed}
              </p>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="pg-auth-submit">
            {loading ? (
              <>
                <span className="spin">⟳</span> CREATING ACCOUNT...
              </>
            ) : (
              "CREATE ACCOUNT →"
            )}
          </button>
        </form>

        {/* Login link */}
        <div className="pg-auth-divider">
          <div className="pg-auth-divider-line" />
          <span className="pg-auth-divider-text">OR</span>
          <div className="pg-auth-divider-line" />
        </div>
        <p className="pg-auth-meta">
          Already have an account?{" "}
          <Link to="/login" className="pg-auth-link">
            Sign in →
          </Link>
        </p>
      </div>
    </main>
  );
}
