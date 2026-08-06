export default function StatusAlert({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="pg-alert pg-alert-inline">
      <span>⚠️ {message}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="pg-alert-close"
          aria-label="Close alert"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
