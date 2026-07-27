// src/api/authAPI.js — COMPLETE FILE
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// ── Login ─────────────────────────────────────────────────────────────────────
export async function loginUser({ email, password }) {
  try {
    const { data } = await axios.post(
      `${BASE}/token/`,
      { username: email, password },
      { headers: { "Content-Type": "application/json" } }
    );
    return data;
  } catch (err) {
    console.error("LOGIN ERROR:", err.response?.status, err.response?.data);
    if (!err.response) {
      throw new Error("API_NETWORK_ERROR");
    }
    if (err.response?.status === 404) {
      throw new Error("API_ENDPOINT_NOT_FOUND");
    }
    throw err;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
export async function registerUser({ name, email, password }) {
  try {
    // Step 1 — create account
    // Only send fields that exist in the User model: email, username, password
    await axios.post(
      `${BASE}/register/`,
      {
        email,
        username:  email,   // use email as username
        password,
        password2: password,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    // Step 2 — auto login to get JWT tokens
    const { data } = await axios.post(
      `${BASE}/token/`,
      { username: email, password },
      { headers: { "Content-Type": "application/json" } }
    );
    return data; // { access, refresh }

  } catch (err) {
    console.error("REGISTER ERROR:", err.response?.status, err.response?.data);
    if (!err.response) {
      throw new Error("API_NETWORK_ERROR");
    }
    if (err.response?.status === 404) {
      throw new Error("API_ENDPOINT_NOT_FOUND");
    }
    throw err;
  }
}

// ── Fetch profile ─────────────────────────────────────────────────────────────
export async function fetchProfile(token) {
  try {
    const { data } = await axios.get(
      `${BASE}/profile/`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (err) {
    console.error("PROFILE ERROR:", err.response?.status, err.response?.data);
    return null;
  }
}