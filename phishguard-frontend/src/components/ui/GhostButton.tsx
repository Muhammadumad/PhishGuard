export default function GhostButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={`pg-btn-ghost ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
