"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  Landmark, Plus, X, ArrowDownToLine, ArrowUpFromLine, ListOrdered, Building2, ArrowLeftRight, Scale, FileText, Search, FileSpreadsheet, ChevronRight, Pencil,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";
import BankLedger from "./_components/BankLedger";
import StatementImport from "./_components/StatementImport";
import Reconciliation from "./_components/Reconciliation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface BankAccount {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string | null;
  branch_code: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  notes: string | null;
}
interface Statement { id: number; file_url: string; file_name: string | null; period_start: string | null; period_end: string | null; created_at: string; uploaded_by: { full_name: string } | null; _count: { transactions: number; lines: number }; line_status: Record<string, number> }

type TxnKind = "deposit" | "withdrawal" | "adjustment";

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const KIND_INFO: Record<TxnKind, { title: string; help: string; icon: any; color: string }> = {
  deposit: { title: "Record Deposit", help: "Money received into this account (cheque, cash deposited at the branch, transfer received). Outlet / Head Office cash deposits come through Deposit Requests instead.", icon: ArrowDownToLine, color: "bg-emerald-600" },
  withdrawal: { title: "Record Withdrawal / Payment", help: "Money that left this account — a cheque issued, cash withdrawn, a payment sent.", icon: ArrowUpFromLine, color: "bg-rose-600" },
  adjustment: { title: "Balance Adjustment", help: "Only to correct the system balance so it agrees with the bank (an opening difference, an entry recorded twice...). Not for real money in or out. A reason is required and it is logged.", icon: Scale, color: "bg-amber-600" },
};

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const blankForm = { bank_name: "", account_title: "", account_number: "", iban: "", branch_code: "", opening_balance: "", notes: "" };
  const [form, setForm] = useState(blankForm);

  const [txn, setTxn] = useState<{ account: BankAccount; kind: TxnKind } | null>(null);
  const [txnForm, setTxnForm] = useState({ direction: "credit" as "credit" | "debit", amount: "", description: "", reference: "", party: "", transaction_date: "" });

  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [panel, setPanel] = useState<"ledger" | "statements">("ledger");
  const [refreshKey, setRefreshKey] = useState(0);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [openStatement, setOpenStatement] = useState<number | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: "", description: "", transaction_date: "" });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data);
        setSelected((s) => (s ? json.data.find((a: BankAccount) => a.id === s.id) || null : s));
      }
    } catch (err) {
      console.error("Failed to load bank accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatements = (accountId: number) => {
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements?bank_account_id=${accountId}`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) setStatements(j.data); });
  };

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { if (selected && panel === "statements") fetchStatements(selected.id); }, [selected?.id, panel, refreshKey]);

  const refreshAll = () => { fetchAccounts(); setRefreshKey((k) => k + 1); };

  const activeAccounts = accounts.filter((a) => a.is_active);
  const totalBalance = activeAccounts.reduce((acc, a) => acc + a.current_balance, 0);
  const filteredAccounts = accounts
    .filter((a) => showInactive || a.is_active)
    .filter((a) => `${a.bank_name} ${a.account_title} ${a.account_number} ${a.iban || ""}`.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditing(null); setForm(blankForm); setShowAddModal(true); };
  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({ bank_name: a.bank_name, account_title: a.account_title, account_number: a.account_number, iban: a.iban || "", branch_code: a.branch_code || "", opening_balance: String(a.opening_balance || 0), notes: a.notes || "" });
    setShowAddModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bank_name.trim() || !form.account_title.trim() || !form.account_number.trim()) {
      toast.error("Bank name, account title, and account number are required.");
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/${editing.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ bank_name: form.bank_name, account_title: form.account_title, iban: form.iban, branch_code: form.branch_code, notes: form.notes }) })
        : await fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ ...form, opening_balance: parseFloat(form.opening_balance) || 0 }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to save bank account."));
      toast.success(editing ? "Bank account updated." : "Bank account added.");
      setShowAddModal(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: BankAccount) => {
    if (!confirm(`${a.is_active ? "Deactivate" : "Activate"} ${a.bank_name} ${a.account_number}?${a.is_active ? " Outlets won't be able to deposit into it." : ""}`)) return;
    const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/${a.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ is_active: !a.is_active }) });
    if (res.ok) { toast.success("Updated."); fetchAccounts(); } else toast.error(await apiErrorMessage(res, "Update failed."));
  };

  const openTxn = (account: BankAccount, kind: TxnKind) => {
    setTxn({ account, kind });
    setTxnForm({ direction: kind === "withdrawal" ? "debit" : "credit", amount: "", description: "", reference: "", party: "", transaction_date: "" });
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txn || !txnForm.amount || parseFloat(txnForm.amount) <= 0) { toast.error("Please enter a valid amount."); return; }
    if (txn.kind === "adjustment" && !txnForm.description.trim()) { toast.error("Enter the reason for this adjustment."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/transactions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ bank_account_id: txn.account.id, category: txn.kind, type: txnForm.direction, amount: parseFloat(txnForm.amount), description: txnForm.description, reference: txnForm.reference, party: txnForm.party, transaction_date: txnForm.transaction_date || undefined }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transaction failed."));
      const j = await res.json();
      toast.success(`${KIND_INFO[txn.kind].title.replace("Record ", "")} saved — ${j.data.transaction.transaction_no}`);
      setTxn(null);
      refreshAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount) { toast.error("Please fill in both accounts and an amount."); return; }
    if (transferForm.from_account_id === transferForm.to_account_id) { toast.error("Source and destination accounts must differ."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/transfer`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ ...transferForm, amount: parseFloat(transferForm.amount), transaction_date: transferForm.transaction_date || undefined }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transfer failed."));
      toast.success("Inter-bank transfer completed.");
      setShowTransferModal(false);
      setTransferForm({ from_account_id: "", to_account_id: "", amount: "", description: "", transaction_date: "" });
      refreshAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const select = (a: BankAccount) => { setSelected(a); setPanel("ledger"); setOpenStatement(null); };

  return (
    <>
      <Breadcrumb pageName="Bank Accounts" />
      <PageHeader
        icon={Landmark}
        title="Bank Accounts"
        subtitle="Head Office bank accounts — balances, detailed statements and reconciliation with the bank."
        actions={
          <>
            <button onClick={() => setShowTransferModal(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">
              <ArrowLeftRight className="size-4" /> Inter-bank Transfer
            </button>
            <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-opacity-90">
              <Plus className="size-4" /> Add Account
            </button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600"><Landmark className="size-6" strokeWidth={2.25} /></div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-600/80">Total Bank Balance</p>
            <p className="text-3xl font-black leading-tight text-indigo-700 dark:text-indigo-400">{PKR(totalBalance)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">{activeAccounts.length} active account(s)</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bank, title, account number, IBAN..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-3.5 accent-[#ff3d3d]" /> Show inactive</label>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filteredAccounts.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAccounts.map((a) => (
            <div key={a.id} className={`flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-boxdark ${selected?.id === a.id ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><Building2 className="size-4" strokeWidth={2.25} /></div>
                  <div>
                    <p className="text-sm font-bold text-dark dark:text-white">{a.bank_name}</p>
                    <p className="text-xs text-gray-500">{a.account_title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!a.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-white/10">Inactive</span>}
                  <button onClick={() => openEdit(a)} title="Edit" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="size-3.5" /></button>
                </div>
              </div>
              <div>
                <p className="font-mono text-xs text-gray-500">{a.account_number}</p>
                {a.iban && <p className="font-mono text-[11px] text-gray-400">{a.iban}</p>}
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Balance</p>
                <p className="text-xl font-black text-dark dark:text-white">{PKR(a.current_balance)}</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button disabled={!a.is_active} onClick={() => openTxn(a, "deposit")} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-400"><ArrowDownToLine className="size-3.5" /> Deposit</button>
                <button disabled={!a.is_active} onClick={() => openTxn(a, "withdrawal")} className="flex items-center justify-center gap-1 rounded-lg bg-rose-50 px-2 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:bg-rose-500/10 dark:text-rose-400"><ArrowUpFromLine className="size-3.5" /> Withdraw</button>
                <button onClick={() => openTxn(a, "adjustment")} className="flex items-center justify-center gap-1 rounded-lg bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400"><Scale className="size-3.5" /> Adjust</button>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => select(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"><ListOrdered className="size-3.5" /> Statement & Reconcile <ChevronRight className="size-3.5" /></button>
                <button onClick={() => toggleActive(a)} className="rounded-lg px-2 py-2 text-[11px] font-semibold text-gray-400 hover:text-gray-600">{a.is_active ? "Deactivate" : "Activate"}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Landmark} title="No bank accounts yet" description="Add the company's (Head Office) bank accounts to start tracking balances." />
        </div>
      )}

      {selected && (
        <div className="rounded-2xl border border-slate-100 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-boxdark/60 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-dark dark:text-white">{selected.bank_name} — {selected.account_number}</h2>
              <p className="text-xs text-gray-500">{selected.account_title}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
                <button onClick={() => setPanel("ledger")} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold ${panel === "ledger" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}><ListOrdered className="size-3.5" /> Statement</button>
                <button onClick={() => { setPanel("statements"); setOpenStatement(null); }} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold ${panel === "statements" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}><FileSpreadsheet className="size-3.5" /> Bank Statements & Reconciliation</button>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
            </div>
          </div>

          {panel === "ledger" && <BankLedger account={selected} refreshKey={refreshKey} />}

          {panel === "statements" && (
            openStatement ? (
              <Reconciliation statementId={openStatement} onBack={() => { setOpenStatement(null); fetchStatements(selected.id); }} onChanged={refreshAll} />
            ) : (
              <div className="space-y-4">
                <StatementImport account={selected} onImported={(id) => { refreshAll(); setOpenStatement(id); }} />
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Imported statements</h3>
                  {statements.length > 0 ? (
                    <div className="space-y-2">
                      {statements.map((s) => {
                        const total = s._count.lines;
                        const done = (s.line_status.matched || 0) + (s.line_status.ignored || 0);
                        return (
                          <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                            <FileText className="size-4 text-gray-400" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-dark dark:text-white">{s.file_name || `Statement #${s.id}`} <span className="text-xs font-normal text-gray-400">{day(s.period_start)} – {day(s.period_end)}</span></p>
                              <p className="text-xs text-gray-400">
                                {total ? `${done}/${total} lines reconciled${s.line_status.unmatched ? ` · ${s.line_status.unmatched} open` : ""}` : "File only (uploaded before statement import) — re-import it to reconcile"} · by {s.uploaded_by?.full_name || "—"} on {day(s.created_at)}
                              </p>
                            </div>
                            {s.file_url && <a href={`${BACKEND_URL}${s.file_url}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gray-500 hover:underline">File</a>}
                            {total > 0 && <button onClick={() => setOpenStatement(s.id)} className="rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-bold text-white hover:bg-opacity-90">Reconcile</button>}
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyState icon={FileText} title="No statements imported yet" />}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Add / Edit Account */}
      {showAddModal && (
        <Modal title={editing ? "Edit Bank Account" : "Add Bank Account"} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleSaveAccount} className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/5">Bank accounts are Head Office accounts. Outlets only deposit into them (Deposit Requests).</p>
            <Field label="Bank Name *" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} placeholder="e.g. Meezan Bank" />
            <Field label="Account Title *" value={form.account_title} onChange={(v) => setForm({ ...form, account_title: v })} placeholder="e.g. Qist Market Pvt Ltd" />
            <Field label="Account Number *" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} placeholder="Account number" disabled={!!editing} />
            <Field label="IBAN" value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} placeholder="PK00XXXX0000000000000000" />
            <Field label="Branch Code" value={form.branch_code} onChange={(v) => setForm({ ...form, branch_code: v })} placeholder="Branch code" />
            {!editing && <Field label="Opening Balance" value={form.opening_balance} onChange={(v) => setForm({ ...form, opening_balance: v })} placeholder="0" type="number" />}
            <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Optional" />
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">{saving ? "Saving..." : editing ? "Save Changes" : "Add Account"}</button>
          </form>
        </Modal>
      )}

      {/* Deposit / Withdrawal / Adjustment */}
      {txn && (
        <Modal title={KIND_INFO[txn.kind].title} subtitle={`${txn.account.bank_name} — ${txn.account.account_number}`} onClose={() => setTxn(null)}>
          <form onSubmit={handleRecordTransaction} className="space-y-4 p-6">
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/5">{KIND_INFO[txn.kind].help}</p>
            {txn.kind === "adjustment" && (
              <div className="flex gap-2">
                <button type="button" onClick={() => setTxnForm({ ...txnForm, direction: "credit" })} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${txnForm.direction === "credit" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Increase balance</button>
                <button type="button" onClick={() => setTxnForm({ ...txnForm, direction: "debit" })} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${txnForm.direction === "debit" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Decrease balance</button>
              </div>
            )}
            <Field label="Amount *" value={txnForm.amount} onChange={(v) => setTxnForm({ ...txnForm, amount: v })} placeholder="0" type="number" />
            <Field label="Date" value={txnForm.transaction_date} onChange={(v) => setTxnForm({ ...txnForm, transaction_date: v })} type="date" />
            {txn.kind !== "adjustment" && <Field label={txn.kind === "deposit" ? "Received from (party)" : "Paid to (party)"} value={txnForm.party} onChange={(v) => setTxnForm({ ...txnForm, party: v })} placeholder="Customer, vendor, person, bank..." />}
            <Field label={txn.kind === "adjustment" ? "Reason *" : "Description"} value={txnForm.description} onChange={(v) => setTxnForm({ ...txnForm, description: v })} placeholder={txn.kind === "adjustment" ? "Why the system balance needs correcting" : "e.g. Vendor payment, salary transfer"} />
            <Field label="Reference" value={txnForm.reference} onChange={(v) => setTxnForm({ ...txnForm, reference: v })} placeholder="Cheque #, transfer ref, slip no." />
            <button type="submit" disabled={saving} className={`w-full rounded-xl py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50 ${KIND_INFO[txn.kind].color}`}>{saving ? "Saving..." : "Save"}</button>
          </form>
        </Modal>
      )}

      {/* Inter-Bank Transfer */}
      {showTransferModal && (
        <Modal title="Inter-Bank Transfer" onClose={() => setShowTransferModal(false)}>
          <form onSubmit={handleTransfer} className="space-y-4 p-6">
            <SelectField label="From Account" value={transferForm.from_account_id} onChange={(v) => setTransferForm({ ...transferForm, from_account_id: v })} options={activeAccounts.map((a) => ({ value: String(a.id), label: `${a.bank_name} — ${a.account_number} (${PKR(a.current_balance)})` }))} />
            <SelectField label="To Account" value={transferForm.to_account_id} onChange={(v) => setTransferForm({ ...transferForm, to_account_id: v })} options={activeAccounts.filter((a) => String(a.id) !== transferForm.from_account_id).map((a) => ({ value: String(a.id), label: `${a.bank_name} — ${a.account_number}` }))} />
            <Field label="Amount *" value={transferForm.amount} onChange={(v) => setTransferForm({ ...transferForm, amount: v })} placeholder="0" type="number" />
            <Field label="Date" value={transferForm.transaction_date} onChange={(v) => setTransferForm({ ...transferForm, transaction_date: v })} type="date" />
            <Field label="Description" value={transferForm.description} onChange={(v) => setTransferForm({ ...transferForm, description: v })} placeholder="Reason for transfer" />
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">{saving ? "Processing..." : "Transfer Funds"}</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark">
        <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">{label}</label>
      <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] disabled:opacity-60 dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
        <option value="">Select account</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
