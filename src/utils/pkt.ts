// Calendar dates in Pakistan time (Asia/Karachi), whatever timezone the browser / PC is set to.
// `toISOString().slice(0, 10)` gives the UTC date (still "yesterday" until 5 AM in Pakistan), and
// local-time helpers follow the PC's clock settings — both made the day change at the wrong hour.
const TZ = "Asia/Karachi";
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of `d` (default: now) in Pakistan time. */
export const pktDate = (d: Date | string | number = new Date()): string => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
};

/** YYYY-MM-DD of the 1st of the current month in Pakistan time. */
export const pktMonthStart = (): string => `${pktDate().slice(0, 8)}01`;

/** YYYY-MM-DD `days` from today in Pakistan time (negative for the past). */
export const pktAddDays = (days: number): string => pktDate(Date.now() + days * DAY_MS);

/**
 * YYYY-MM-DD of the calendar day picked in a date picker (a local-midnight Date). Sending
 * `date.toISOString()` instead turns 1 Oct 00:00 into "30 Sep 19:00Z" — the server then had to
 * guess the day, and on a PC not set to Pakistan time it guessed the wrong one.
 */
export const pickedDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * dd/mm/yyyy of `d` in Pakistan time, for tables and exported files. A bare
 * `toLocaleDateString()` follows the PC's own settings — mm/dd/yyyy on a US-set
 * PC, and the wrong day near midnight on one not set to Pakistan time.
 */
export const pktDay = (d?: Date | string | number | null, empty = "—"): string => {
  if (d === null || d === undefined || d === "") return empty;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? empty : date.toLocaleDateString("en-GB", { timeZone: TZ });
};

/** dd/mm/yyyy, hh:mm am/pm of `d` in Pakistan time (see pktDay). */
export const pktDateTime = (d?: Date | string | number | null, empty = "—"): string => {
  if (d === null || d === undefined || d === "") return empty;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime())
    ? empty
    : date.toLocaleString("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};
