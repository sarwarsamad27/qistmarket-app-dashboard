import Cookies from "js-cookie";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export async function employeeFetch(path: string, options: RequestInit = {}) {
  const token = Cookies.get("employee_auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/**
 * Fetches an authenticated file (e.g. a salary slip PDF) as a Blob — a plain
 * <a href> can't send the Bearer token. `who` picks the employee or HR session.
 */
async function fetchAuthedBlob(path: string, who: "employee" | "hr"): Promise<Blob> {
  const token = Cookies.get(who === "employee" ? "employee_auth_token" : "auth_token");
  // Ask for the file as base64 inside JSON: download-manager extensions (IDM
  // etc.) hijack responses that look like file downloads and abort the page's
  // request ("Failed to fetch"); a JSON response is left alone.
  const sep = path.includes("?") ? "&" : "?";
  let res: Response;
  try {
    res = await fetch(`${API}/api${path}${sep}format=base64`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error("Could not reach the server. If a download manager (e.g. IDM) is installed, disable its browser extension and try again.");
  }
  if (!res.ok) {
    let message = "Download failed";
    try { message = (await res.json()).message || message; } catch {}
    throw new Error(message);
  }
  let blob: Blob;
  if ((res.headers.get("content-type") || "").includes("application/json")) {
    const body = await res.json();
    const bytes = Uint8Array.from(atob(body.data), (c) => c.charCodeAt(0));
    blob = new Blob([bytes], { type: body.contentType || "application/pdf" });
  } else {
    blob = await res.blob();
  }
  return blob;
}

export async function downloadAuthedFile(path: string, filename: string, who: "employee" | "hr" = "employee") {
  const url = URL.createObjectURL(await fetchAuthedBlob(path, who));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Opens an authenticated file (PDF, image) in a new tab. The tab is opened
 * straight away, inside the click, so pop-up blockers allow it; the file is
 * loaded into it once fetched.
 */
export async function viewAuthedFile(path: string, who: "employee" | "hr" = "employee") {
  const tab = window.open("", "_blank");
  if (tab) tab.document.write("<p style=\"font-family:sans-serif;padding:24px;color:#555\">Loading document…</p>");
  try {
    const url = URL.createObjectURL(await fetchAuthedBlob(path, who));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/**
 * Opens the browser's print dialog for an authenticated PDF, so "Print"
 * prints the same branded document as "Download".
 */
export async function printAuthedFile(path: string, who: "employee" | "hr" = "employee") {
  const url = URL.createObjectURL(await fetchAuthedBlob(path, who));
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank"); // fallback: open the PDF and print from the viewer
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  };
  document.body.appendChild(frame);
}

export async function hrFetch(path: string, options: RequestInit = {}) {
  const token = Cookies.get("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api/hr${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
