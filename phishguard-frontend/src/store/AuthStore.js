// src/store/authStore.js
import { create } from "zustand";

const isGuestInitial = typeof sessionStorage !== "undefined" && sessionStorage.getItem("pg_is_guest") === "true";
const storedUser = JSON.parse(localStorage.getItem("pg_user") || "null");

const guestUser = {
  username: "Guest User",
  email: "guest@session.local",
  role: "guest",
  isGuest: true,
};

const useAuthStore = create((set) => ({
  isGuest: isGuestInitial,
  user: isGuestInitial ? guestUser : storedUser,
  accessToken: localStorage.getItem("pg_access") || null,
  refreshToken: localStorage.getItem("pg_refresh") || null,
  isLoggedIn: !!localStorage.getItem("pg_access"),

  setAuth: (user, accessToken, refreshToken) => {
    sessionStorage.removeItem("pg_is_guest");
    localStorage.setItem("pg_access", accessToken);
    localStorage.setItem("pg_refresh", refreshToken);
    localStorage.setItem("pg_user", JSON.stringify(user));
    set({ user, accessToken, refreshToken, isLoggedIn: true, isGuest: false });
  },

  setGuestMode: () => {
    sessionStorage.setItem("pg_is_guest", "true");
    set({
      isGuest: true,
      isLoggedIn: false,
      user: guestUser,
      accessToken: null,
      refreshToken: null,
    });
  },

  logout: () => {
    localStorage.removeItem("pg_access");
    localStorage.removeItem("pg_refresh");
    localStorage.removeItem("pg_user");
    sessionStorage.removeItem("pg_is_guest");
    sessionStorage.removeItem("pg_guest_history");
    set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false, isGuest: false });
  },

  updateToken: (accessToken) => {
    localStorage.setItem("pg_access", accessToken);
    set({ accessToken });
  },
}));

export default useAuthStore;