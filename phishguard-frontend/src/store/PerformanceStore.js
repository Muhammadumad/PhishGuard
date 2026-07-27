import { create } from "zustand";

const saved =
  typeof window !== "undefined"
    ? localStorage.getItem("pg-performance") || "fast"
    : "fast";

function applyPerformance(mode) {
  if (typeof window === "undefined") return;
  const body = document.body;
  if (!body) return;

  body.classList.remove("pg-perf-fast", "pg-perf-rich");
  body.classList.add(mode === "rich" ? "pg-perf-rich" : "pg-perf-fast");
}

function initPerformance() {
  if (typeof window === "undefined") return;

  if (document.body) {
    applyPerformance(saved);
    return;
  }

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      applyPerformance(saved);
    },
    { once: true }
  );
}

const usePerformanceStore = create((set) => ({
  mode: saved,
  toggleMode: () =>
    set((state) => {
      const next = state.mode === "fast" ? "rich" : "fast";
      localStorage.setItem("pg-performance", next);
      applyPerformance(next);
      return { mode: next };
    }),
}));

initPerformance();

export default usePerformanceStore;
