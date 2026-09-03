// src/store/ThemeStore.ts
import { create } from "zustand";

const THEME_KEY = "pg-theme";
const CONTRAST_KEY = "pg-contrast";
const THEME_ORDER = ["dark", "light", "system"] as const;
type Theme = typeof THEME_ORDER[number];
type Contrast = "normal" | "high";

interface ThemeState {
  theme: Theme;
  contrast: Contrast;
  systemTheme: "dark" | "light";
  toggle: () => void;
  setTheme: (nextTheme: Theme) => void;
  toggleContrast: () => void;
}

const savedTheme = (
  typeof window !== "undefined"
    ? localStorage.getItem(THEME_KEY) || "system"
    : "system"
) as Theme;

const savedContrast = (
  typeof window !== "undefined"
    ? localStorage.getItem(CONTRAST_KEY) || "normal"
    : "normal"
) as Contrast;

let transitionTimer: ReturnType<typeof setTimeout>;

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function resolveTheme(theme: Theme): "dark" | "light" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme, contrast: Contrast) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-contrast", contrast || "normal");

  clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove("theme-switching");
  }, 380);
}

const useThemeStore = create<ThemeState>((set, get) => ({
  theme: savedTheme,
  contrast: savedContrast,
  systemTheme: getSystemTheme(),

  toggle: () =>
    set((state) => {
      const currentIndex = THEME_ORDER.indexOf(state.theme);
      const next = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next, get().contrast);
      return { theme: next };
    }),

  setTheme: (nextTheme) => {
    if (!THEME_ORDER.includes(nextTheme)) return;
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme, get().contrast);
    set({ theme: nextTheme });
  },

  toggleContrast: () =>
    set((state) => {
      const nextContrast: Contrast = state.contrast === "high" ? "normal" : "high";
      localStorage.setItem(CONTRAST_KEY, nextContrast);
      applyTheme(get().theme, nextContrast);
      return { contrast: nextContrast };
    }),
}));

if (typeof window !== "undefined") {
  applyTheme(savedTheme, savedContrast);

  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onMediaChange = () => {
    const state = useThemeStore.getState();
    const systemTheme = getSystemTheme();
    useThemeStore.setState({ systemTheme });
    if (state.theme === "system") {
      applyTheme("system", state.contrast);
    }
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onMediaChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(onMediaChange);
  }
}

export default useThemeStore;