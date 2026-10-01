"use client";

// App-wide error handling, mounted once in the root layout.
//
// * Wraps window.fetch for backend calls so that, on every page (600+ call
//   sites) without editing each one:
//     - a network failure throws a clear message — "No internet connection"
//       when the device is offline, "Unable to connect to the server" when
//       online but the backend can't be reached — instead of "Failed to fetch";
//     - a failed response always has a JSON body with a professional
//       `message` (generic "Internal server error", leaked internals, HTML
//       proxy error pages and empty bodies are replaced with the real reason
//       for that status), keeping the body's existing `error` field shape.
// * Same treatment for axios.
// * Shows a persistent banner while the device is offline, and a single
//   (de-duplicated) toast when the server is unreachable / back.

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import {
  NO_INTERNET_MESSAGE,
  SERVER_UNREACHABLE_MESSAGE,
  extractBodyMessage,
  friendlyMessage,
  isGenericMessage,
  isInternalMessage,
} from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const CONNECTIVITY_TOAST_ID = "connectivity-status";

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

let serverDownToastId: string | null = null;

function markServerDown(message: string) {
  // Same id the de-duplicated toast.error uses, so a page showing the same
  // err.message doesn't stack a second identical toast.
  serverDownToastId = `err:${message}`;
  toast.error(message, { id: serverDownToastId, duration: 6000 });
}

function markServerUp() {
  if (!serverDownToastId) return;
  toast.dismiss(serverDownToastId);
  serverDownToastId = null;
  toast.success("Connection to the server restored.", { id: CONNECTIVITY_TOAST_ID, duration: 3000 });
}

// Identical error toasts (the global one below + a page showing the same
// err.message, or a polling page failing repeatedly) collapse into one.
function dedupeErrorToasts() {
  const t = toast as any;
  if (t.__qmDeduped) return;
  t.__qmDeduped = true;
  const originalError = toast.error;
  t.error = (message: any, opts?: any) =>
    originalError(message, { ...(typeof message === "string" ? { id: `err:${message}` } : {}), ...opts });
}

const isReadRequest = (input: RequestInfo | URL, init?: RequestInit) =>
  ((init?.method || (input instanceof Request ? input.method : "GET")) || "GET").toUpperCase() === "GET";

// Many pages only handle `data.success` and silently ignore a failure, so a
// failed *load* would leave an empty screen with no reason. Server-side
// failures (5xx) on reads are therefore always announced once, globally.
function announceReadFailure(message: string) {
  toast.error(message, { duration: 6000 });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function isApiRequest(url: string): boolean {
  // Only our own backend — third-party APIs (maps, etc.) are left untouched.
  return (!!BACKEND_URL && url.startsWith(BACKEND_URL)) || url.startsWith("/api/");
}

function networkError(cause: unknown): TypeError {
  const offline = isOffline();
  const err = new TypeError(offline ? NO_INTERNET_MESSAGE : SERVER_UNREACHABLE_MESSAGE);
  (err as any).isNetworkError = true;
  (err as any).cause = cause;
  if (!offline) markServerDown(SERVER_UNREACHABLE_MESSAGE);
  return err;
}

async function normalizeFailedResponse(res: Response): Promise<Response> {
  if (res.type === "opaque" || res.status < 400) return res;

  const text = await res.clone().text().catch(() => "");
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null; // HTML error page from a proxy, plain text, ...
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    markServerDown(friendlyMessage(res.status, body));
  }

  const isObject = body && typeof body === "object" && !Array.isArray(body);
  const current = isObject ? extractBodyMessage(body) : "";
  const needsFix = !isObject || isGenericMessage(current) || isInternalMessage(current) || typeof body.message !== "string";
  if (!needsFix) return res;

  const message = friendlyMessage(res.status, isObject ? body : null);
  const fixed: any = isObject ? { ...body } : { success: false };
  fixed.message = message;
  if (typeof fixed.error === "string") fixed.error = message;
  else if (fixed.error && typeof fixed.error === "object") fixed.error = { ...fixed.error, message };

  const headers = new Headers(res.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");
  const out = new Response(JSON.stringify(fixed), { status: res.status, statusText: res.statusText, headers });
  try {
    Object.defineProperty(out, "url", { value: res.url });
  } catch {
    /* ignore */
  }
  return out;
}

function installFetchInterceptor() {
  const w = window as any;
  if (w.__qmFetchPatched) return;
  w.__qmFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isApiRequest(url)) return originalFetch(input, init);

    let res: Response;
    try {
      res = await originalFetch(input, init);
    } catch (err: any) {
      if (err?.name === "AbortError") throw err;
      throw networkError(err);
    }
    if (res.ok) {
      markServerUp();
      return res;
    }
    const normalized = await normalizeFailedResponse(res);
    if (res.status >= 500 && ![502, 503, 504].includes(res.status) && isReadRequest(input, init)) {
      const body = await normalized.clone().json().catch(() => null);
      announceReadFailure(friendlyMessage(res.status, body));
    }
    return normalized;
  };
}

function installAxiosInterceptor() {
  const ax = axios as any;
  if (ax.__qmPatched) return;
  ax.__qmPatched = true;

  axios.interceptors.response.use(
    (response) => {
      markServerUp();
      return response;
    },
    (error) => {
      if (axios.isCancel(error)) return Promise.reject(error);
      if (!error.response) {
        const net = networkError(error);
        error.message = net.message;
        error.isNetworkError = true;
      } else {
        const { status, data } = error.response;
        if (status === 502 || status === 503 || status === 504) markServerDown(friendlyMessage(status, data));
        const message = friendlyMessage(status, data);
        error.message = message;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          if (typeof data.message !== "string" || isGenericMessage(data.message) || isInternalMessage(data.message)) {
            data.message = message;
          }
        } else {
          error.response.data = { success: false, message };
        }
      }
      return Promise.reject(error);
    },
  );
}

// Install as soon as this module loads on the client — before any page's
// effects run their first fetch.
if (typeof window !== "undefined") {
  dedupeErrorToasts();
  installFetchInterceptor();
  installAxiosInterceptor();
}

export function GlobalErrorHandling() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(isOffline());

    const goOffline = () => {
      setOffline(true);
      // The banner explains it; drop stale "server unreachable" toasts.
      if (serverDownToastId) toast.dismiss(serverDownToastId);
      serverDownToastId = null;
    };
    const goOnline = () => {
      setOffline(false);
      toast.success("You're back online.", { id: CONNECTIVITY_TOAST_ID, duration: 3000 });
    };
    // A network error nobody caught was already explained by the toast /
    // banner — keep it from surfacing as an unhandled crash.
    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (e.reason?.isNetworkError) e.preventDefault();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[10000] flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow-md"
    >
      <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      You are offline. Check your internet connection — data will not load or save until you reconnect.
    </div>
  );
}
