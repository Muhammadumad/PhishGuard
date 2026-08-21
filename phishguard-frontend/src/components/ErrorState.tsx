// src/components/ErrorState.jsx
// Reusable error state components
import { ExclamationTriangle, WifiOff, Search } from "react-bootstrap-icons";

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="pg-error-banner">
      <div className="pg-error-banner-copy">
        <span className="pg-error-banner-icon"><ExclamationTriangle size={14} /></span>
        <div>
          <div className="pg-error-banner-title">Something went wrong</div>
          <div className="pg-error-banner-message">
            {message || "An unexpected error occurred. Please try again."}
          </div>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="pg-error-button">
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorEmpty({ title = "Nothing here yet", subtitle, action, actionLabel }) {
  return (
    <div className="pg-empty-state">
      <div className="pg-empty-state-icon"><Search size={18} /></div>
      <div className="pg-empty-state-title">{title}</div>
      {subtitle && <p className="pg-empty-state-copy">{subtitle}</p>}
      {action && (
        <button onClick={action} className="pg-error-button">
          {actionLabel || "Get Started"}
        </button>
      )}
    </div>
  );
}

export function ErrorNetworkDown({ onRetry }) {
  return (
    <div className="pg-error-network">
      <div className="pg-empty-state-icon"><WifiOff size={18} /></div>
      <div className="pg-empty-state-title">Cannot reach Django API</div>
      <p className="pg-empty-state-copy">
        Make sure your Django backend is running on <code>localhost:8000</code>.
      </p>
      {onRetry && (
        <button onClick={onRetry} className="pg-error-button">
          Retry Connection
        </button>
      )}
    </div>
  );
}