// Which installment is open for payment — same rule as the backend's
// normalizeLedger (ledgerUtils.js), which also puts the arrears on this row:
//   - the running month = the first unpaid row whose due date hasn't passed;
//   - if every unpaid row is already past due, the LAST unpaid row, so the
//     final installment is never locked while money is still owed.
// Every unpaid month due before it is locked; its remainder is carried onto
// this row as arrears. Returns -1 when everything is paid.
type LedgerRowLike = {
  monthNumber?: number;
  month?: number;
  status?: string;
  dueDate?: string | null;
  due_date?: string | null;
};

export function findCurrentInstallmentIndex(rows: LedgerRowLike[], now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let lastUnpaid = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r.monthNumber ?? r.month ?? 0) <= 0) continue;
    if ((r.status || "").toLowerCase() === "paid") continue;
    lastUnpaid = i;
    const raw = r.dueDate || r.due_date;
    const d = raw ? new Date(raw) : null;
    if (!d || isNaN(d.getTime())) return i;
    d.setHours(0, 0, 0, 0);
    if (d >= today) return i;
  }
  return lastUnpaid;
}
