// src/store/authStore.js
import { create } from "zustand";

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem("pg_user") || "null"),
  accessToken: localStorage.getItem("pg_access") || null,
  refreshToken: localStorage.getItem("pg_refresh") || null,
  isLoggedIn: !!localStorage.getItem("pg_access"),

  setAuth: (user, accessToken, refreshToken) => {
    // Save to localStorage FIRST
    localStorage.setItem("pg_access", accessToken);
    localStorage.setItem("pg_refresh", refreshToken);
    localStorage.setItem("pg_user", JSON.stringify(user));
    // Then update Zustand state
    set({ user, accessToken, refreshToken, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem("pg_access");
    localStorage.removeItem("pg_refresh");
    localStorage.removeItem("pg_user");
    set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false });
  },

  updateToken: (accessToken) => {
    localStorage.setItem("pg_access", accessToken);
    set({ accessToken });
  },
}));

export default useAuthStore;