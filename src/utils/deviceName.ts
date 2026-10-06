/**
 * Readable name for a stored device / user-agent string:
 *   "Dart/3.12 (dart:io)"                          -> "Mobile app"
 *   "Qist Market mobile app · device ab12 (Dart…)" -> "Mobile app · device ab12"
 *   "Mozilla/5.0 (Windows NT 10.0 …) Chrome/…"     -> "Windows · Chrome"
 */
export function deviceName(ua?: string | null): string {
  if (!ua) return "—";
  if (ua.startsWith("Qist Market mobile app")) return ua.replace(/^Qist Market mobile app/, "Mobile app").replace(/\s*\(.*\)\s*$/, "");
  if (/dart|okhttp/i.test(ua)) return "Mobile app";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /PostmanRuntime|curl|axios|node/i.test(ua) ? "API tool" : "";
  return `${os}${browser ? ` · ${browser}` : ""}`;
}

/** True for the Qist Market mobile app (as opposed to a web browser). */
export const isMobileApp = (ua?: string | null) => !!ua && (/dart|okhttp/i.test(ua) || ua.startsWith("Qist Market mobile app"));
