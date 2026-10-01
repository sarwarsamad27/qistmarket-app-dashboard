"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { 
    Plus, Trash2, Save, Calendar, 
    FileText, AlertCircle, CheckCircle2, 
    Wallet, CreditCard, Receipt, Package,
    ArrowLeft
} from "lucide-react";
import Loader from "@/components/common/Loader";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface ExpenseItemInput {
    tempId: string;
    category: string;
    amount: number;
    description: string;
}

export default function AddExpenseVoucherPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState("");

    const [items, setItems] = useState<ExpenseItemInput[]>([
        { tempId: Math.random().toString(), category: "General", amount: 0, description: "" }
    ]);

    const CATEGORIES = ["Rent", "Electricity", "Internet", "Water", "Fuel", "Salary", "Maintenance", "Tea/Entertainment", "Cleaning", "Stationery", "Other"];

    const addItem = () => {
        setItems([...items, { 
            tempId: Math.random().toString(), 
            category: "General", 
            amount: 0, 
            description: "" 
        }]);
    };

    const updateItem = (tempId: string, field: keyof ExpenseItemInput, value: any) => {
        setItems(items.map(item => 
            item.tempId === tempId ? { ...item, [field]: value } : item
        ));
    };

    const removeItem = (tempId: string) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.tempId !== tempId));
    };

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount.toString()) || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.some(i => i.amount <= 0)) {
            setError("All expense items must have an amount greater than zero.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`${API_BASE}/api/outlet/expenses`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    items,
                    payment_method: paymentMethod,
                    date,
                    notes
                }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess("Expense voucher recorded successfully!");
                setTimeout(() => router.push("/outlet/expenses"), 1500);
            } else {
                setError(data.message || "Failed to record expense voucher.");
            }
        } catch (err) {
            setError(getErrorMessage(err, "Connection error. Please try again."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl">
            <Breadcrumb pageName="Record New Expense" />

            <div className="mb-6 flex items-center justify-between">
                <button 
                    onClick={() => router.back()}
                    className="text-sm font-bold text-gray-500 hover:text-primary flex items-center gap-2 transition-all active:scale-95"
                >
                    <ArrowLeft size={16} /> Discard & Exit
                </button>
                <div className="flex items-center gap-2">
                    <Receipt className="text-primary w-6 h-6" />
                    <span className="text-xl font-black uppercase tracking-tight">New Expense Voucher</span>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 animate-shake">
                    <AlertCircle size={20} /> <span className="font-bold">{error}</span>
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-100 text-green-600 text-sm flex items-center gap-3 animate-fade-in">
                    <CheckCircle2 size={20} /> <span className="font-bold">{success}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* VOUCHER MASTER INFO */}
                <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden">
                    <div className="p-6 bg-gray-50/50 dark:bg-meta-4/20 border-b border-stroke dark:border-strokedark">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <CreditCard size={18} className="text-primary" /> Voucher Fundamentals
                        </h3>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Voucher Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Payment Method</label>
                            <div className="bg-gray-50 dark:bg-meta-4 p-1 rounded-2xl border border-stroke dark:border-strokedark">
                                <button 
                                    type="button"
                                    onClick={() => setPaymentMethod("Cash")}
                                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethod === 'Cash' ? 'bg-white dark:bg-boxdark shadow-sm text-primary' : 'text-gray-400'}`}
                                    disabled
                                >
                                    <Wallet size={16} /> Cash
                                </button>
                            </div>
                        </div>

                        <div className="md:col-span-2 lg:col-span-1">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Voucher Notes</label>
                            <div className="relative">
                                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Brief summary of this expense cluster..."
                                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* LINE ITEMS SPREADSHEET */}
                <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden min-h-[400px]">
                    <div className="p-6 border-b border-stroke dark:border-strokedark flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <Package size={20} className="text-primary" /> Cost Allocation Items ({items.length})
                        </h3>
                        <button 
                            type="button"
                            onClick={addItem}
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={16} strokeWidth={3} /> Add Line Item
                        </button>
                    </div>

                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-meta-4 text-[10px] uppercase font-black text-gray-500 tracking-wider">
                                    <th className="p-4 w-12 text-center text-gray-400">#</th>
                                    <th className="p-4 min-w-[200px]">Category</th>
                                    <th className="p-4 min-w-[150px] text-right">Amount (PKR)</th>
                                    <th className="p-4 min-w-[300px]">Memo / Description</th>
                                    <th className="p-4 w-12" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {items.map((item, index) => (
                                    <tr key={item.tempId} className="group animate-slide-in">
                                        <td className="p-4 text-center font-mono font-bold text-gray-300 text-xs">{index + 1}</td>
                                        <td className="p-4">
                                            <select 
                                                value={item.category}
                                                onChange={(e) => updateItem(item.tempId, 'category', e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-bold transition-all text-gray-800 dark:text-white"
                                            >
                                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <input 
                                                type="number"
                                                value={item.amount || ''}
                                                onChange={(e) => updateItem(item.tempId, 'amount', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-black text-right transition-all tabular-nums text-red-600"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <input 
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => updateItem(item.tempId, 'description', e.target.value)}
                                                placeholder="What is this expense for?"
                                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-medium transition-all"
                                            />
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                type="button"
                                                onClick={() => removeItem(item.tempId)}
                                                disabled={items.length === 1}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-20"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-900 text-white">
                                    <td colSpan={2} className="p-6 text-right text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Cumulative Voucher Amount</td>
                                    <td className="p-6 text-right text-2xl font-black tabular-nums">
                                        PKR {totalAmount.toLocaleString()}
                                    </td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-4 p-4">
                    <div className="flex flex-col text-right mr-4">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Authorized for Posting</div>
                        <div className="text-xs font-bold text-gray-500 italic">Financial integrity starts with accuracy.</div>
                    </div>
                    <button 
                        type="submit"
                        disabled={saving || totalAmount <= 0}
                        className="w-full sm:w-auto bg-primary text-white px-12 py-4 rounded-3xl text-sm font-black flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                    >
                        {saving ? <Loader text="" /> : <Save size={20} strokeWidth={3} />}
                        {saving ? "Posting Voucher..." : "Post Expense Voucher"}
                    </button>
                </div>
            </form>
        </div>
    );
}
