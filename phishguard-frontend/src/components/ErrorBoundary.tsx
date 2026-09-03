// src/components/ErrorBoundary.tsx
import React from "react";
import { ExclamationTriangle, ArrowClockwise, ShieldCheck } from "react-bootstrap-icons";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("PhishGuard UI Error Boundary Caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="pg-app-container pg-main" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "24px" }}>
          <div className="pg-card" style={{ maxWidth: "560px", width: "100%", textAlign: "center", padding: "36px 28px", borderRadius: "20px", border: "1px solid var(--border-hi)" }}>
            <div style={{ width: "54px", height: "54px", borderRadius: "16px", background: "rgba(255, 59, 92, 0.12)", border: "1px solid rgba(255, 59, 92, 0.3)", color: "var(--red)", display: "grid", placeItems: "center", margin: "0 auto 20px auto" }}>
              <ExclamationTriangle size={26} />
            </div>
            
            <h2 style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 800, color: "#ffffff", marginBottom: "10px", textAlign: "center" }}>
              Unexpected Interface Disruption
            </h2>
            
            <p style={{ fontFamily: "var(--body)", fontSize: "14px", color: "var(--text-2)", lineHeight: "1.6", marginBottom: "24px", textAlign: "center" }}>
              PhishGuard encountered an unhandled view state error. Your session security state remains intact.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", fontSize: "11px", color: "var(--amber)", overflowX: "auto", textAlign: "left", marginBottom: "24px", maxHeight: "160px" }}>
                {this.state.error.toString()}
              </pre>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="pg-btn-primary"
                onClick={this.handleReset}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px" }}
              >
                <ArrowClockwise size={15} /> Reload Console
              </button>
              
              <a
                href="/dashboard"
                className="pg-btn-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", textDecoration: "none" }}
              >
                <ShieldCheck size={15} /> Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

