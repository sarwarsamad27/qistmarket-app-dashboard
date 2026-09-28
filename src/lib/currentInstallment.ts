// Which installment is open for payment — same rule as the backend's
// findCurrentInstallmentIndex (ledgerUtils.js), which also puts the arrears on
// this row:
//   - the running cycle belongs to the month whose due date passed most
//     recently (due today counts) and stays open until the next due date;
//   - if that month is already paid, the next unpaid month opens (paying ahead);
//   - before the first due date, the first unpaid month;
//   - if nothing from the running month onward is unpaid, the LAST unpaid
//     month, so the final installment never stays locked while money is owed.
// Unpaid months before it are locked; their remainder is carried onto this
// row as arrears. Returns -1 when everything is paid.
type LedgerRowLike = {
  monthNumber?: number;
  month?: number;
  status?: string;
  dueDate?: string | null;
  due_date?: string | null;
};

export function findCurrentInstallmentIndex(rows: LedgerRowLike[], now: Date = new Date()): number {
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const isInstallment = (r: LedgerRowLike) => (r.monthNumber ?? r.month ?? 0) > 0;
  const isUnpaid = (r: LedgerRowLike) => (r.status || "").toLowerCase() !== "paid";

  let runningIdx = -1;
  let lastUnpaid = -1;
  rows.forEach((r, i) => {
    if (!isInstallment(r)) return;
    if (isUnpaid(r)) lastUnpaid = i;
    const raw = r.dueDate || r.due_date;
    const d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime()) && d <= todayEnd) runningIdx = i;
  });
  for (let i = Math.max(0, runningIdx); i < rows.length; i++) {
    if (isInstallment(rows[i]) && isUnpaid(rows[i])) return i;
  }
  return lastUnpaid;
}
