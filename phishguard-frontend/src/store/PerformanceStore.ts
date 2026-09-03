// src/store/PerformanceStore.ts
import { create } from "zustand";

type PerfMode = "fast" | "rich";

interface PerformanceState {
  mode: PerfMode;
  toggleMode: () => void;
}

const saved = (
  typeof window !== "undefined"
    ? localStorage.getItem("pg-performance") || "fast"
    : "fast"
) as PerfMode;

function applyPerformance(mode: PerfMode): void {
  if (typeof window === "undefined") return;
  const body = document.body;
  if (!body) return;

  body.classList.remove("pg-perf-fast", "pg-perf-rich");
  body.classList.add(mode === "rich" ? "pg-perf-rich" : "pg-perf-fast");
}

function initPerformance(): void {
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

const usePerformanceStore = create<PerformanceState>((set) => ({
  mode: saved,
  toggleMode: () =>
    set((state) => {
      const next: PerfMode = state.mode === "fast" ? "rich" : "fast";
      localStorage.setItem("pg-performance", next);
      applyPerformance(next);
      return { mode: next };
    }),
}));

initPerformance();

export default usePerformanceStore;

