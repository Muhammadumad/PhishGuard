// src/api/axiosInstance.js
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: BASE,
});

// Attach JWT token to EVERY request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pg_access");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  config.headers["Content-Type"] = "application/json";
  return config;
}, (error) => Promise.reject(error));

// Auto-refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("pg_refresh");
        if (!refresh) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE}/token/refresh/`, { refresh });
        localStorage.setItem("pg_access", data.access);
        original.headers["Authorization"] = `Bearer ${data.access}`;
        return api(original);
      } catch {
        // Refresh failed — clear tokens and redirect to login
        localStorage.removeItem("pg_access");
        localStorage.removeItem("pg_refresh");
        localStorage.removeItem("pg_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;