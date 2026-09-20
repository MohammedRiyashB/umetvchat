import { auth } from "./firebase";

const configuredApiBase = typeof import.meta.env.VITE_SOCKET_URL === "string" ? import.meta.env.VITE_SOCKET_URL.trim() : "";
const apiBase = configuredApiBase || (import.meta.env.DEV ? window.location.origin : "https://umetvchat.onrender.com");

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const user = auth.currentUser;
  if (user) {
    headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}
