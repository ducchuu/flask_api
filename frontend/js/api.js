/**
 * Thin wrapper around the Pulse REST API.
 *
 * Handles base URL, bearer-token injection, JSON encode/decode, and a single
 * consistent error shape. A 401 anywhere clears the session and bounces the
 * user to the login screen.
 */
import { store } from "./store.js";

const BASE = "/api";

/** Error carrying the HTTP status plus the server's message. */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Pull a human message out of either error-envelope shape the backend uses. */
function readError(body, status) {
  const err = body && body.error;
  if (err && typeof err === "object") return { message: err.message || "Request failed", code: err.code };
  if (typeof err === "string") return { message: err, code: status };
  if (body && body.details) return { message: body.details, code: status };
  return { message: `Request failed (${status})`, code: status };
}

async function request(method, path, body, { auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && store.token) headers["Authorization"] = `Bearer ${store.token}`;

  let resp;
  try {
    resp = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is it running?", 0);
  }

  if (resp.status === 401 && auth) {
    store.clear();
    window.dispatchEvent(new CustomEvent("pulse:unauthorized"));
    throw new ApiError("Your session expired. Please sign in again.", 401);
  }

  const text = await resp.text();
  const data = text ? JSON.parse(text) : null;

  if (!resp.ok) {
    const { message, code } = readError(data, resp.status);
    throw new ApiError(message, resp.status, code);
  }
  return data;
}

export const api = {
  // --- auth ---
  register: (username, password) =>
    request("POST", "/users", { username, password }, { auth: false }),
  login: (username, password) =>
    request("POST", "/tokens", { username, password }, { auth: false }),
  googleLogin: (credential) =>
    request("POST", "/auth/google", { credential }, { auth: false }),
  me: () => request("GET", "/users/me"),
  updateMe: (patch) => request("PATCH", "/users/me", patch),

  // --- interests (CRUD) ---
  interests: () => request("GET", "/interests"),
  createInterest: (payload) => request("POST", "/interests", payload),
  updateInterest: (id, payload) => request("PUT", `/interests/${id}`, payload),
  deleteInterest: (id) => request("DELETE", `/interests/${id}`),

  // --- feed + stats ---
  items: (params = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const qs = q.toString();
    return request("GET", `/items${qs ? "?" + qs : ""}`);
  },
  stats: (by) => request("GET", `/items/stats?by=${by}`),

  // --- collections (CRUD + membership) ---
  collections: () => request("GET", "/collections"),
  createCollection: (payload) => request("POST", "/collections", payload),
  getCollection: (id) => request("GET", `/collections/${id}`),
  updateCollection: (id, payload) => request("PUT", `/collections/${id}`, payload),
  deleteCollection: (id) => request("DELETE", `/collections/${id}`),
  addToCollection: (cid, itemId) => request("PUT", `/collections/${cid}/items/${itemId}`),
  removeFromCollection: (cid, itemId) => request("DELETE", `/collections/${cid}/items/${itemId}`),

  // --- feedback ---
  feedback: () => request("GET", "/feedback"),
  createFeedback: (itemId, kind) => request("POST", "/feedback", { item_id: itemId, kind }),
  deleteFeedback: (id) => request("DELETE", `/feedback/${id}`),

  // --- additive: upsert a live feed item to get a numeric DB id ---
  upsertItem: (item) => request("POST", "/items", item),
};
