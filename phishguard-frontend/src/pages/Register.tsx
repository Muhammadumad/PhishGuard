import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/AuthStore";
import { registerUser } from "../api/AuthAPI";
import { Zap, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

function Field({ label, type = "text", value, onChange, error, placeholder }: any) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? "border-destructive focus-visible:ring-destructive" : "border-input"
          }`}
          style={{ paddingRight: type === "password" ? "40px" : "12px" }}
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const levels = [
    { label: "Weak", color: "bg-destructive" },
    { label: "Fair", color: "bg-orange-500" },
    { label: "Good", color: "bg-amber-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Strong", color: "bg-emerald-500" },
  ];
  const { label, color } = levels[score];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300 ${i <= score ? color : "bg-muted"}`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium uppercase tracking-wider ${
        score <= 1 ? "text-destructive" : score === 2 ? "text-orange-500" : score === 3 ? "text-amber-500" : "text-emerald-500"
      }`}>
        {label}
      </p>
    </div>
  );
}

export default function Register() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (field: string) => (e: any) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e: any = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (!form.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!agreed) e.agreed = "You must accept the terms to continue";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
          username: form.name.trim() ? form.name.trim().split(" ")[0] : form.email.split("@")[0],
          email: form.email,
        },
        access,
        refresh
      );
      setSuccess(true);
    } catch (err: any) {
      if (err.message === "API_NETWORK_ERROR" || !err.response) {
        setApiError("Cannot reach backend API. Make sure Django is running.");
      } else {
        const data = err.response?.data;
        if (data?.email) setApiError("Email: " + (Array.isArray(data.email) ? data.email[0] : data.email));
        else if (data?.username) setApiError("Username: " + (Array.isArray(data.username) ? data.username[0] : data.username));
        else if (data?.password) setApiError("Password: " + (Array.isArray(data.password) ? data.password[0] : data.password));
        else if (data?.error) setApiError(data.error);
        else setApiError("Registration failed. Please check your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background/50 p-4">
        <div className="w-full max-w-[400px] border border-border bg-card shadow-sm rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-6">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Account Created!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Welcome to PhishGuard, <strong className="text-foreground">{form.name.split(" ")[0]}</strong>! You are now logged in and ready to scan URLs.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex w-full items-center justify-center rounded-md bg-primary h-10 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start Scanning <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background/50 p-4">
      <div className="w-full max-w-[450px] border border-border bg-card shadow-sm rounded-xl p-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center space-y-2 mb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-2">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">Initialize your PhishGuard analyst profile</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          {["Account Info", "Security", "Terms"].map((step, i) => {
            const isCompleted = 
              i === 0 ? (form.name && form.email) : 
              i === 1 ? (form.password && form.password === form.confirmPassword) : 
              agreed;
            return (
              <div key={step} className="flex-1 text-center">
                <div className={`h-1 rounded-full mb-1 transition-colors duration-300 ${isCompleted ? "bg-emerald-500" : "bg-muted"}`} />
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{step}</span>
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {apiError && (
          <div className="mb-6 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center">
            <AlertCircle className="mr-2 h-4 w-4 shrink-0" />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Full Name" value={form.name} onChange={set("name")} error={errors.name} placeholder="e.g. Jane Doe" />
            </div>
            <div className="md:col-span-2">
              <Field label="Email Address" type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <Field label="Password" type="password" value={form.password} onChange={set("password")} error={errors.password} placeholder="Min. 8 characters" />
              <PasswordStrength password={form.password} />
            </div>
            <div className="space-y-1">
              <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} placeholder="Repeat password" />
              {form.confirmPassword && (
                <div className="mt-2 text-[10px] font-medium uppercase tracking-wider">
                  {form.password === form.confirmPassword ? (
                    <span className="text-emerald-500 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Passwords match</span>
                  ) : (
                    <span className="text-destructive flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Do not match</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <div className="relative flex items-center justify-center mt-0.5">
                <input type="checkbox" className="peer sr-only" checked={agreed} onChange={() => setAgreed(!agreed)} />
                <div className={`w-5 h-5 border-2 rounded transition-all duration-200 flex items-center justify-center ${errors.agreed ? "border-destructive" : agreed ? "bg-primary border-primary" : "border-muted-foreground group-hover:border-primary"}`}>
                  {agreed && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                </span>
                {errors.agreed && <p className="text-[13px] font-medium text-destructive">{errors.agreed}</p>}
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary h-10 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 mt-4"
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</> : "Create Account"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
