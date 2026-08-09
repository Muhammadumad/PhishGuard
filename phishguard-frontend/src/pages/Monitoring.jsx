// src/pages/Monitoring.jsx
import { useMemo } from "react";

export default function Monitoring() {
  const iframeSrc = useMemo(() => {
    const rawBase = import.meta.env.VITE_API_BASE_URL || "/api";
    const djangoOrigin = import.meta.env.VITE_DJANGO_ORIGIN || "https://phishguard-api-g2df.onrender.com";

    let target = `${djangoOrigin}/monitoring/`;
    if (rawBase.startsWith("http")) {
      try {
        const origin = new URL(rawBase).origin;
        target = `${origin}/monitoring/`;
      } catch (e) {
        // Fallback to djangoOrigin
      }
    }
    return target;
  }, []);

  return (
    <main
      className="pg-main fade-up"
      style={{
        padding: "16px",
        height: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid rgba(99, 179, 237, 0.2)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          background: "#090d14",
        }}
      >
        <iframe
          src={iframeSrc}
          title="PhishGuard Real-time Visitor & Scan Monitoring"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "#090d14",
          }}
        />
      </div>
    </main>
  );
}
