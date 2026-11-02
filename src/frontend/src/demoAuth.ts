import { guestWorkspace } from "./guestWorkspace";

// Public deployment defaults contain no credentials; VITE_API_URL remains the override.
export const API_BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "https://resiliospace-api.onrender.com" : "http://127.0.0.1:8000")).replace(/\/+$/, "");
export const GUEST_DEMO = import.meta.env.VITE_GUEST_DEMO === "true" || (import.meta.env.PROD && import.meta.env.VITE_GUEST_DEMO !== "false");
export const AUTH_EXPIRED = "resiliospace-auth-expired";
export const AUTH_READY = "resiliospace-auth-ready";
let token: string | null = null;
let expiration: ReturnType<typeof setTimeout> | undefined;

function notify(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

export function clearDemoSession() {
  token = null;
  clearTimeout(expiration);
  notify(AUTH_EXPIRED);
}

export async function authStatus(signal?: AbortSignal): Promise<{ required: boolean }> {
  if (GUEST_DEMO) return { required: false };
  const response = await fetch(`${API_BASE}/api/auth/status`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("The demo service is unavailable. Try again shortly.");
  return response.json();
}

export async function loginDemo(password: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Login failed.");
  if (typeof payload.token !== "string" || typeof payload.expires_in !== "number") throw new Error("Invalid login response.");
  token = payload.token;
  clearTimeout(expiration);
  expiration = setTimeout(clearDemoSession, payload.expires_in * 1000);
  notify(AUTH_READY);
}

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!url.startsWith(`${API_BASE}/`)) throw new Error("Unexpected API destination.");
  if (GUEST_DEMO) return guestWorkspace.fetch(url, init, API_BASE);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  if (response.status === 401) clearDemoSession();
  return response;
}

export async function logoutDemo(): Promise<void> {
  try { await apiFetch(`${API_BASE}/api/auth/logout`, { method: "POST" }); }
  finally { clearDemoSession(); }
}
