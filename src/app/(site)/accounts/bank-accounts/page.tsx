"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Landmark, Plus, X, ArrowDownToLine, ArrowUpFromLine, ListOrdered, Building2, ArrowLeftRight, Upload, CheckCircle2, FileText, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { formatExactDate } from "@/utils/dateUtils";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface BankAccount {
  id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string | null;
  branch_code: string | null;
  current_balance: number;
  is_active: boolean;
  outlet: { id: number; name: string } | null;
}

interface LedgerTransaction {
  id: number;
  type: "credit" | "debit";
  amount: number;
  balance_after: number;
  description: string | null;
  reference: string | null;
  transaction_date: string;
  reconciled: boolean;
  created_by: { full_name: string } | null;
}
interface Statement { id: number; file_url: string; period_start: string | null; period_end: string | null; created_at: string; uploaded_by: { full_name: string } | null; _count: { transactions: number } }

const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("all");
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bank_name: "", account_title: "", account_number: "", iban: "", branch_code: "", outlet_id: "", opening_balance: "" });

  const [txnAccount, setTxnAccount] = useState<BankAccount | null>(null);
  const [txnForm, setTxnForm] = useState({ type: "credit" as "credit" | "debit", amount: "", description: "", reference: "" });

  const [ledgerAccount, setLedgerAccount] = useState<BankAccount | null>(null);
  const [ledgerTxns, setLedgerTxns] = useState<LedgerTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<"transactions" | "statements">("transactions");
  const [selectedTxnIds, setSelectedTxnIds] = useState<number[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [uploadingStatement, setUploadingStatement] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: "", description: "" });

  const fetchAccounts = async () => {
    const token = Cookies.get("auth_token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts?outletId=${outletId}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setAccounts(json.data);
    } catch (err) {
      console.error("Failed to load bank accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [outletId]);

  const totalBalance = accounts.filter((a) => a.is_active).reduce((acc, a) => acc + a.current_balance, 0);
  const filteredAccounts = accounts.filter((a) => `${a.bank_name} ${a.account_title} ${a.account_number}`.toLowerCase().includes(search.toLowerCase()));

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bank_name.trim() || !form.account_title.trim() || !form.account_number.trim()) {
      toast.error("Bank name, account title, and account number are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, opening_balance: parseFloat(form.opening_balance) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to add bank account.", json));
      toast.success("Bank account added.");
      setShowAddModal(false);
      setForm({ bank_name: "", account_title: "", account_number: "", iban: "", branch_code: "", outlet_id: "", opening_balance: "" });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnAccount || !txnForm.amount || parseFloat(txnForm.amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/transactions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ bank_account_id: txnAccount.id, ...txnForm, amount: parseFloat(txnForm.amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transaction failed.", json));
      toast.success(`${txnForm.type === "credit" ? "Deposit" : "Withdrawal"} recorded.`);
      setTxnAccount(null);
      setTxnForm({ type: "credit", amount: "", description: "", reference: "" });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (account: BankAccount) => {
    setLedgerAccount(account);
    setLedgerTab("transactions");
    setSelectedTxnIds([]);
    setLedgerLoading(true);
    try {
      const [ledgerRes, statementsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/accounts/bank-accounts/${account.id}/ledger`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements?bank_account_id=${account.id}`, { headers: authHeaders() }),
      ]);
      const ledgerJson = await ledgerRes.json();
      const statementsJson = await statementsRes.json();
      if (ledgerJson.success) setLedgerTxns(ledgerJson.data.transactions);
      if (statementsJson.success) setStatements(statementsJson.data);
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount) {
      toast.error("Please fill in both accounts and an amount.");
      return;
    }
    if (transferForm.from_account_id === transferForm.to_account_id) {
      toast.error("Source and destination accounts must differ.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/transfer`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...transferForm, amount: parseFloat(transferForm.amount) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transfer failed.", json));
      toast.success("Inter-bank transfer completed.");
      setShowTransferModal(false);
      setTransferForm({ from_account_id: "", to_account_id: "", amount: "", description: "" });
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadStatement = async () => {
    if (!ledgerAccount || !statementFile) {
      toast.error("Please choose a statement file first.");
      return;
    }
    setUploadingStatement(true);
    try {
      const formData = new FormData();
      formData.append("file", statementFile);
      formData.append("bank_account_id", String(ledgerAccount.id));
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Upload failed."));
      toast.success("Statement uploaded.");
      setStatementFile(null);
      openLedger(ledgerAccount);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingStatement(false);
    }
  };

  const toggleTxnSelection = (id: number) => {
    setSelectedTxnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleReconcile = async () => {
    if (selectedTxnIds.length === 0) {
      toast.error("Select at least one transaction to reconcile.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/reconcile`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ transaction_ids: selectedTxnIds }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Reconciliation failed."));
      toast.success(`${selectedTxnIds.length} transaction(s) marked reconciled.`);
      setSelectedTxnIds([]);
      if (ledgerAccount) openLedger(ledgerAccount);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Bank Accounts" />
      <PageHeader
        icon={Landmark}
        title="Bank Accounts"
        subtitle="Company bank accounts, balances, and transaction history."
        actions={
          <>
            <OutletSelector selectedId={outletId} onSelect={setOutletId} />
            <button onClick={() => setShowTransferModal(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">
              <ArrowLeftRight className="size-4" /> Transfer
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-opacity-90">
              <Plus className="size-4" /> Add Account
            </button>
          </>
        }
      />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-transparent">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600">
          <Landmark className="size-6" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600/80">Total Bank Balance</p>
          <p className="text-3xl font-black leading-tight text-indigo-700 dark:text-indigo-400">{PKR(totalBalance)}</p>
        </div>
      </div>

      {!loading && accounts.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bank, title, account number..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : filteredAccounts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((a) => (
            <div key={a.id} className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-boxdark">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                    <Building2 className="size-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-dark dark:text-white">{a.bank_name}</p>
                    <p className="text-xs text-gray-500">{a.account_title}</p>
                  </div>
                </div>
                {!a.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-white/10">Inactive</span>}
              </div>

              <div>
                <p className="font-mono text-xs text-gray-400">{a.account_number}</p>
                <p className="text-[11px] text-gray-400">{a.outlet?.name || "Head Office"}</p>
              </div>

              <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Balance</p>
                <p className="text-xl font-black text-dark dark:text-white">{PKR(a.current_balance)}</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setTxnAccount(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <ArrowDownToLine className="size-3.5" /> Transaction
                </button>
                <button onClick={() => openLedger(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">
                  <ListOrdered className="size-3.5" /> Ledger
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Landmark} title="No bank accounts yet" description="Add your first company bank account to start tracking balances." />
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark">
            <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
              <h2 className="text-xl font-black text-gray-800 dark:text-white">Add Bank Account</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <Field label="Bank Name *" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} placeholder="e.g. Meezan Bank" />
              <Field label="Account Title *" value={form.account_title} onChange={(v) => setForm({ ...form, account_title: v })} placeholder="e.g. Qist Market Pvt Ltd" />
              <Field label="Account Number *" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} placeholder="Account number" />
              <Field label="IBAN" value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} placeholder="PK00XXXX0000000000000000" />
              <Field label="Branch Code" value={form.branch_code} onChange={(v) => setForm({ ...form, branch_code: v })} placeholder="Branch code" />
              <Field label="Opening Balance" value={form.opening_balance} onChange={(v) => setForm({ ...form, opening_balance: v })} placeholder="0" type="number" />
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
                {saving ? "Saving..." : "Add Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {txnAccount && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark">
            <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white">Record Transaction</h2>
                <p className="text-xs text-gray-500">{txnAccount.bank_name} — {txnAccount.account_number}</p>
              </div>
              <button onClick={() => setTxnAccount(null)} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleRecordTransaction} className="space-y-4 p-6">
              <div className="flex gap-2">
                <button type="button" onClick={() => setTxnForm({ ...txnForm, type: "credit" })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${txnForm.type === "credit" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>
                  <ArrowDownToLine className="size-4" /> Deposit
                </button>
                <button type="button" onClick={() => setTxnForm({ ...txnForm, type: "debit" })} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${txnForm.type === "debit" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>
                  <ArrowUpFromLine className="size-4" /> Withdrawal
                </button>
              </div>
              <Field label="Amount *" value={txnForm.amount} onChange={(v) => setTxnForm({ ...txnForm, amount: v })} placeholder="0" type="number" />
              <Field label="Description" value={txnForm.description} onChange={(v) => setTxnForm({ ...txnForm, description: v })} placeholder="e.g. Vendor payment, salary transfer" />
              <Field label="Reference" value={txnForm.reference} onChange={(v) => setTxnForm({ ...txnForm, reference: v })} placeholder="Cheque #, transfer ref" />
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
                {saving ? "Saving..." : "Record Transaction"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerAccount && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark">
            <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white">Transaction Ledger</h2>
                <p className="text-xs text-gray-500">{ledgerAccount.bank_name} — {ledgerAccount.account_number}</p>
              </div>
              <button onClick={() => setLedgerAccount(null)} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500">
                <X size={22} />
              </button>
            </div>

            <div className="flex gap-1 border-b border-stroke px-6 pt-3 dark:border-strokedark">
              {(["transactions", "statements"] as const).map((t) => (
                <button key={t} onClick={() => setLedgerTab(t)} className={`rounded-t-lg px-4 py-2 text-sm font-semibold capitalize transition ${ledgerTab === t ? "border-b-2 border-[#ff3d3d] text-[#ff3d3d]" : "text-gray-500"}`}>{t}</button>
              ))}
            </div>

            {ledgerTab === "transactions" && (
              <>
                {selectedTxnIds.length > 0 && (
                  <div className="flex items-center justify-between bg-emerald-50 px-6 py-2 text-sm dark:bg-emerald-500/10">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{selectedTxnIds.length} selected</span>
                    <button onClick={handleReconcile} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                      <CheckCircle2 className="size-3.5" /> Mark Reconciled
                    </button>
                  </div>
                )}
                <div className="max-h-[55vh] overflow-y-auto">
                  {ledgerLoading ? (
                    <TableSkeleton rows={4} cols={4} />
                  ) : ledgerTxns.length > 0 ? (
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3"></th>
                          <th className="px-2 py-3 font-bold">Date</th>
                          <th className="px-6 py-3 font-bold">Description</th>
                          <th className="px-6 py-3 text-right font-bold">Amount</th>
                          <th className="px-6 py-3 text-right font-bold">Balance</th>
                          <th className="px-6 py-3 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerTxns.map((t) => (
                          <tr key={t.id} className="border-t border-slate-50 dark:border-white/5">
                            <td className="px-4 py-3.5">
                              {!t.reconciled && <input type="checkbox" checked={selectedTxnIds.includes(t.id)} onChange={() => toggleTxnSelection(t.id)} className="size-4 rounded" />}
                            </td>
                            <td className="px-2 py-3.5 text-gray-500">{formatExactDate(t.transaction_date, 'DD MMM YYYY, hh:mm A')}</td>
                            <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{t.description || "—"}</td>
                            <td className={`px-6 py-3.5 text-right tabular-nums font-bold ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                              {t.type === "credit" ? "+" : "−"}{PKR(t.amount)}
                            </td>
                            <td className="px-6 py-3.5 text-right tabular-nums text-gray-500">{PKR(t.balance_after)}</td>
                            <td className="px-6 py-3.5">
                              {t.reconciled ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/10">Reconciled</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/10">Pending</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState icon={ListOrdered} title="No transactions yet" />
                  )}
                </div>
              </>
            )}

            {ledgerTab === "statements" && (
              <div className="max-h-[55vh] overflow-y-auto p-6">
                <div className="mb-4 flex items-center gap-2">
                  <input type="file" onChange={(e) => setStatementFile(e.target.files?.[0] || null)} className="flex-1 rounded-xl border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                  <button onClick={handleUploadStatement} disabled={uploadingStatement} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
                    <Upload className="size-4" /> {uploadingStatement ? "Uploading..." : "Upload"}
                  </button>
                </div>
                {statements.length > 0 ? (
                  <div className="space-y-2">
                    {statements.map((s) => (
                      <a key={s.id} href={`${BACKEND_URL}${s.file_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                        <FileText className="size-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium text-dark dark:text-white">Statement uploaded {formatExactDate(s.created_at, 'DD MMM YYYY, hh:mm A')}</p>
                          <p className="text-xs text-gray-400">{s._count.transactions} transaction(s) reconciled against this statement · by {s.uploaded_by?.full_name || "—"}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={FileText} title="No statements uploaded yet" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inter-Bank Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark">
            <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
              <h2 className="text-xl font-black text-gray-800 dark:text-white">Inter-Bank Transfer</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">From Account</label>
                <select value={transferForm.from_account_id} onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">To Account</label>
                <select value={transferForm.to_account_id} onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_number}</option>)}
                </select>
              </div>
              <Field label="Amount *" value={transferForm.amount} onChange={(v) => setTransferForm({ ...transferForm, amount: v })} placeholder="0" type="number" />
              <Field label="Description" value={transferForm.description} onChange={(v) => setTransferForm({ ...transferForm, description: v })} placeholder="Reason for transfer" />
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-3 font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
                {saving ? "Processing..." : "Transfer Funds"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      />
    </div>
  );
}
