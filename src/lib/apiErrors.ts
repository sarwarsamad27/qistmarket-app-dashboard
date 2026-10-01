// Shared, user-facing error wording for every API call in the dashboard.
// The global fetch interceptor (components/GlobalErrorHandling.tsx) uses
// these so that a page showing `err.message` / `json.message` always shows a
// clear, professional reason: no internet, server unreachable, session
// expired, permission denied, server-side failure (with a support ref), etc.

export const NO_INTERNET_MESSAGE =
  "No internet connection. Please check your network and try again.";

export const SERVER_UNREACHABLE_MESSAGE =
  "Unable to connect to the server. It may be down or restarting — please try again in a moment.";

const STATUS_MESSAGES: Record<number, string> = {
  400: "The request could not be processed. Please check the entered details and try again.",
  401: "Your session has expired or you are not signed in. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested record could not be found.",
  405: "This action is not allowed.",
  408: "The request took too long. Please try again.",
  409: "This action conflicts with existing data. Please refresh and try again.",
  413: "The uploaded file or data is too large.",
  415: "This file type is not supported.",
  422: "Some of the entered details are invalid. Please review them and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on the server while processing your request. Please try again; if it keeps happening, contact support.",
  502: "The server is temporarily unavailable (it may be restarting). Please try again shortly.",
  503: "The service is temporarily unavailable. Please try again in a moment.",
  504: "The server took too long to respond. Please try again.",
};

export function statusMessage(status: number): string {
  return (
    STATUS_MESSAGES[status] ||
    (status >= 500 ? STATUS_MESSAGES[500] : STATUS_MESSAGES[400])
  );
}

const GENERIC_RE =
  /^(internal server error|server error|internal error|something went wrong|an error occurred|error occurred|unknown error|error|failed|request failed|route not found|not found|bad request|unauthorized|forbidden|failed to fetch)[.!]?$/i;

const INTERNAL_RE =
  /prisma|invocation|cannot read propert|is not a function|is not defined|is not iterable|unexpected token|ECONNREFUSED|ECONNRESET|ETIMEDOUT|syntax error|\n\s+at |\[object Object\]|<!doctype|<html/i;

export const isGenericMessage = (msg: unknown) =>
  typeof msg !== "string" || !msg.trim() || GENERIC_RE.test(msg.trim());

export const isInternalMessage = (msg: unknown) =>
  typeof msg === "string" && (msg.length > 300 || INTERNAL_RE.test(msg));

/** Best message already present in an error body, if any. */
export function extractBodyMessage(body: any): string {
  if (!body || typeof body !== "object") return "";
  if (typeof body.message === "string" && body.message) return body.message;
  if (typeof body.error === "string" && body.error) return body.error;
  if (typeof body.error?.message === "string" && body.error.message) return body.error.message;
  if (Array.isArray(body.errors) && body.errors.length) {
    const first = body.errors[0];
    return typeof first === "string" ? first : first?.msg || first?.message || "";
  }
  return "";
}

/** Clear message for a failed response, given its status and parsed body. */
export function friendlyMessage(status: number, body: any): string {
  const current = extractBodyMessage(body);
  if (current && !isGenericMessage(current) && !isInternalMessage(current)) {
    return current;
  }
  const base = statusMessage(status);
  const ref = body && typeof body === "object" && typeof body.ref === "string" ? body.ref : "";
  return ref && !base.includes(ref) ? `${base} (Ref: ${ref})` : base;
}

/**
 * Message to show for a failed `fetch` Response. Use instead of a hard-coded
 * `throw new Error("Failed.")` so the user sees the real reason.
 */
export async function apiErrorMessage(res: Response, fallback?: string, parsedBody?: any): Promise<string> {
  // Pass `parsedBody` when the caller already consumed the body with res.json().
  let body: any = parsedBody ?? null;
  if (body === null && !res.bodyUsed) {
    try {
      body = await res.clone().json();
    } catch {
      /* non-JSON body */
    }
  }
  const current = extractBodyMessage(body);
  if (current && !isGenericMessage(current) && !isInternalMessage(current)) return current;
  // The page's own fallback describes *what* failed; the status says *why*.
  if (fallback && res.status < 500 && res.status !== 401 && res.status !== 403) {
    return isGenericMessage(fallback) ? statusMessage(res.status) : fallback;
  }
  return friendlyMessage(res.status, body);
}

/** Message for anything caught in a try/catch around an API call. */
export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return NO_INTERNET_MESSAGE;
  const msg = (err as any)?.message ?? (typeof err === "string" ? err : "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return SERVER_UNREACHABLE_MESSAGE;
  }
  // Many call sites pass "Network error..." as their catch-all fallback; that
  // would blame the connection for what is really an app/data problem.
  const safeFallback = /network|connection|internet/i.test(fallback) && !(err as any)?.isNetworkError
    ? "Something went wrong while processing your request. Please try again."
    : fallback;
  if (!msg || isInternalMessage(msg) || isGenericMessage(msg)) return safeFallback;
  return msg;
}
