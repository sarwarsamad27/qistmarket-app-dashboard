"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  Search, ShoppingBag, User, Phone, CreditCard, Smartphone,
  CheckCircle2, X, ChevronLeft, ChevronRight, Receipt,
  Printer, Pencil, Ban, ShoppingCart,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { getErrorMessage } from "@/lib/apiErrors";

// Edit/Delete are only allowed within 3 days of the sale (mirrors the backend
// rule in cashSaleController.js) — used here just to grey the buttons out
// early instead of letting the user hit a 403 after filling the modal.
const EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const isWithinEditWindow = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) <= EDIT_WINDOW_MS;

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

const getAuthHeaders = () => {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const PKR = (val: number) => `PKR ${(val || 0).toLocaleString("en-PK")}`;

interface InventoryItem {
  id: number;
  product_name: string;
  category: string | null;
  imei_serial: string | null;
  color_variant: string | null;
  purchase_price: number;
  installment_price: number;
  sale_price?: number | null;
  suggested_price: number;
  is_used: boolean;
  status: string;
}

// Suggested cash-sale price: the API-recommended sale price if there is one,
// otherwise the installment price, then purchase price. Uses `||` (not `??`)
// deliberately — installment_price is a required column that's frequently
// left as 0 for items never priced for a qist plan (e.g. appliances added as
// outright-sale stock only), and 0 is never a real intended price here, so it
// must fall through the same way null/undefined would. Always editable below
// regardless of what it resolves to.
const suggestedPriceOf = (item: InventoryItem) =>
  item.sale_price || item.installment_price || item.purchase_price || 0;

// One line in a cart — decoupled from InventoryItem so it can represent
// either a freshly-picked search result or a product loaded back out of an
// existing sale being edited (which only has the CashSale snapshot fields,
// not the live inventory record's stock/pricing metadata).
interface CartItem {
  inventory_id: number;
  product_name: string;
  category: string | null;
  imei_serial: string | null;
  color_variant: string | null;
  quoted_price: number;
  final_price: number;
}

const cartItemFromInventory = (item: InventoryItem): CartItem => ({
  inventory_id: item.id,
  product_name: item.product_name,
  category: item.category,
  imei_serial: item.imei_serial,
  color_variant: item.color_variant,
  quoted_price: item.suggested_price,
  final_price: item.suggested_price,
});

// One row in the history table — a whole transaction (one or more products
// checked out together). `sale_group` non-null and `item_count` > 1 means
// several CashSale rows are collapsed into this one summary row.
interface CashSaleTxn {
  id: number;
  sale_group: string | null;
  item_count: number;
  product_name: string;
  imei_serial: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_cnic: string | null;
  final_price: number;
  created_at: string;
  sold_by: { username: string; full_name: string } | null;
  status: "active" | "cancelled";
  cancelled_at: string | null;
}

function ProductSearchBox({
  search,
  onSearchChange,
  onPick,
  placeholder = "Search in-stock product by name or IMEI...",
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onPick: (item: InventoryItem) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Reuses the exact same GET /api/outlet/inventory endpoint the Stock List
  // page calls, so Cash Sale can never show a product Stock List doesn't —
  // filtered here to just what Stock List itself treats as available
  // (status "In Stock", not flagged is_used; "Used Stock"/"Out Of
  // Stock"/"Sold" units are excluded, matching getInventory's own rule).
  useEffect(() => {
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/outlet/inventory?search=${encodeURIComponent(search.trim())}&limit=50&page=1`, {
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          const sellable: InventoryItem[] = (data.inventory || [])
            .filter((item: InventoryItem) => item.status === "In Stock" && !item.is_used)
            .map((item: InventoryItem) => ({ ...item, suggested_price: suggestedPriceOf(item) }));
          setResults(sellable);
        }
      } catch (err) {
        console.error("Product search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium"
      />

      {showResults && (
        <div className="absolute z-20 mt-2 w-full bg-white dark:bg-dark-2 rounded-2xl shadow-2xl border border-gray-100 dark:border-dark-3 max-h-72 overflow-y-auto">
          {isSearching ? (
            <div className="p-6 text-center text-sm text-gray-400 font-medium">Searching...</div>
          ) : results.length > 0 ? (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onPick(item);
                  setShowResults(false);
                }}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-dark-3 border-b border-gray-50 dark:border-dark-3 last:border-0 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-dark-3 flex items-center justify-center text-gray-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{item.imei_serial} {item.color_variant ? `• ${item.color_variant}` : ""}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-600 shrink-0">{PKR(item.suggested_price)}</span>
              </button>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-gray-400 font-medium">No in-stock items found</div>
          )}
        </div>
      )}
    </div>
  );
}

function CartList({
  items,
  onPriceChange,
  onRemove,
}: {
  items: CartItem[];
  onPriceChange: (inventory_id: number, price: number) => void;
  onRemove: (inventory_id: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="p-6 rounded-2xl border-2 border-dashed border-gray-200 dark:border-dark-3 text-center text-sm text-gray-400 font-medium">
        No products added yet — search above and pick one or more.
      </div>
    );
  }

  const total = items.reduce((s, it) => s + (it.final_price || 0), 0);

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div
          key={it.inventory_id}
          className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-900/30 flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 dark:text-white text-sm truncate">{it.product_name}</p>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {it.imei_serial && (
                <span className="text-[10px] font-bold text-gray-500 bg-white dark:bg-dark-2 px-2 py-0.5 rounded-lg font-mono">{it.imei_serial}</span>
              )}
              {it.color_variant && (
                <span className="text-[10px] font-bold text-gray-500 bg-white dark:bg-dark-2 px-2 py-0.5 rounded-lg">{it.color_variant}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-dark-2 rounded-xl px-3 py-2 shrink-0">
            <span className="text-xs font-bold text-gray-400">Rs.</span>
            <input
              type="number"
              value={it.final_price}
              onChange={(e) => onPriceChange(it.inventory_id, e.target.value === "" ? 0 : Number(e.target.value))}
              className="w-24 bg-transparent outline-none font-black text-sm text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(it.inventory_id)}
            className="p-2 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{items.length} item{items.length === 1 ? "" : "s"}</span>
        <span className="text-lg font-black text-gray-900 dark:text-white">{PKR(total)}</span>
      </div>
    </div>
  );
}

export default function CashSalePage() {
  const router = useRouter();

  // ── New Sale form state ──────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── History state ──────────────────────────────────────────────────
  const [history, setHistory] = useState<CashSaleTxn[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, hasNext: false, hasPrev: false });

  // ── Edit / Delete state ────────────────────────────────────────────
  const [editingSale, setEditingSale] = useState<CashSaleTxn | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerCnic, setEditCustomerCnic] = useState("");
  const [editProductSearch, setEditProductSearch] = useState("");
  const [editCartItems, setEditCartItems] = useState<CartItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const addToCart = (item: InventoryItem) => {
    setCartItems((prev) => (prev.some((c) => c.inventory_id === item.id) ? prev : [...prev, cartItemFromInventory(item)]));
    setProductSearch("");
  };
  const updateCartPrice = (inventory_id: number, price: number) => {
    setCartItems((prev) => prev.map((c) => (c.inventory_id === inventory_id ? { ...c, final_price: price } : c)));
  };
  const removeFromCart = (inventory_id: number) => {
    setCartItems((prev) => prev.filter((c) => c.inventory_id !== inventory_id));
  };

  const addToEditCart = (item: InventoryItem) => {
    setEditCartItems((prev) => (prev.some((c) => c.inventory_id === item.id) ? prev : [...prev, cartItemFromInventory(item)]));
    setEditProductSearch("");
  };
  const updateEditCartPrice = (inventory_id: number, price: number) => {
    setEditCartItems((prev) => prev.map((c) => (c.inventory_id === inventory_id ? { ...c, final_price: price } : c)));
  };
  const removeFromEditCart = (inventory_id: number) => {
    setEditCartItems((prev) => prev.filter((c) => c.inventory_id !== inventory_id));
  };

  // ── History fetch ───────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: historySearch.trim(),
      });
      const res = await fetch(`${API_BASE}/api/outlet/cash-sale/history?${params}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data.sales);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Fetch cash sale history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [page, limit, historySearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Debounce history search
  useEffect(() => {
    const handle = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(handle);
  }, [historySearch]);

  // ── Confirm sale ────────────────────────────────────────────────────
  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCnic("");
    setProductSearch("");
    setCartItems([]);
  };

  const handleConfirmSale = async () => {
    if (cartItems.length === 0) return toast.error("Add at least one product to sell");
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (cartItems.some((it) => !it.final_price || it.final_price <= 0)) return toast.error("Every item needs a valid final price");

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/cash-sale`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || undefined,
          customer_cnic: customerCnic.trim() || undefined,
          items: cartItems.map((it) => ({
            inventory_id: it.inventory_id,
            quoted_price: it.quoted_price,
            final_price: it.final_price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Sale failed");

      toast.success("Sale completed successfully!");
      resetForm();
      setPage(1);
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Sale failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Edit sale ───────────────────────────────────────────────────────
  const openEdit = async (sale: CashSaleTxn) => {
    setEditingSale(sale);
    setEditLoading(true);
    setEditCustomerName(sale.customer_name);
    setEditCustomerPhone(sale.customer_phone || "");
    setEditCustomerCnic(sale.customer_cnic || "");
    setEditProductSearch("");
    setEditCartItems([]);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/cash-sale/${sale.id}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setEditCartItems(
          (data.data.items || []).map((it: any) => ({
            inventory_id: it.inventory_id,
            product_name: it.product_name,
            category: it.category,
            imei_serial: it.imei_serial,
            color_variant: it.color_variant,
            quoted_price: it.quoted_price,
            final_price: it.final_price,
          }))
        );
      }
    } catch (err) {
      console.error("Fetch sale for edit error:", err);
      toast.error(getErrorMessage(err, "Failed to load sale details"));
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    setEditingSale(null);
    setEditProductSearch("");
    setEditCartItems([]);
  };

  const saveEdit = async () => {
    if (!editingSale) return;
    if (!editCustomerName.trim()) return toast.error("Customer name is required");
    if (editCartItems.length === 0) return toast.error("Add at least one product");
    if (editCartItems.some((it) => !it.final_price || it.final_price <= 0)) return toast.error("Every item needs a valid final price");

    setIsSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/cash-sale/${editingSale.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          customer_name: editCustomerName.trim(),
          customer_phone: editCustomerPhone.trim() || null,
          customer_cnic: editCustomerCnic.trim() || null,
          items: editCartItems.map((it) => ({
            inventory_id: it.inventory_id,
            quoted_price: it.quoted_price,
            final_price: it.final_price,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Update failed");

      toast.success("Sale updated successfully!");
      closeEdit();
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Cancel invoice ──────────────────────────────────────────────────
  const handleCancel = async (sale: CashSaleTxn) => {
    const label = sale.item_count > 1 ? `${sale.item_count} items` : `"${sale.product_name}"`;
    if (!confirm(`Cancel this invoice for ${label} sold to ${sale.customer_name}? Every item will be restored to stock and the amount reversed from today's Cash Register. The record will stay in history marked as Cancelled.`)) return;
    setDeletingId(sale.id);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/cash-sale/${sale.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || "Cancellation failed");

      toast.success("Invoice cancelled successfully!");
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Cancellation failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Cash Sale" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* ── New Sale Form ──────────────────────────────────────── */}
        <div className="xl:col-span-3 bg-white dark:bg-gray-dark rounded-[2rem] shadow-xl shadow-gray-100/50 dark:shadow-none border border-gray-100 dark:border-dark-3 p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-[#E31E24]">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">New Cash Sale</h3>
              <p className="text-gray-400 dark:text-dark-6 text-sm font-medium">Outright walk-in sale against branch stock — add one or more products</p>
            </div>
          </div>

          {/* Customer Details */}
          <div className="space-y-4 mb-8">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Customer Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative sm:col-span-2">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  placeholder="CNIC (optional)"
                  value={customerCnic}
                  onChange={(e) => setCustomerCnic(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium"
                />
              </div>
            </div>
          </div>

          {/* Product Search + Cart */}
          <div className="space-y-4 mb-8">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Products</p>
            <ProductSearchBox search={productSearch} onSearchChange={setProductSearch} onPick={addToCart} />
            <CartList items={cartItems} onPriceChange={updateCartPrice} onRemove={removeFromCart} />
          </div>

          <button
            onClick={handleConfirmSale}
            disabled={isSubmitting || cartItems.length === 0}
            className="w-full py-4 bg-[#E31E24] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-red-100 dark:shadow-none hover:bg-red-700 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <div className="size-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirm Sale
              </>
            )}
          </button>
        </div>

        {/* ── Side summary ───────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-gray-900 dark:bg-dark-2 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-emerald-400">
                <Receipt className="w-6 h-6" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">How it works</span>
              </div>
              <ul className="space-y-3 text-sm text-gray-300 font-semibold">
                <li className="flex gap-2"><span className="text-emerald-400">1.</span> Enter the customer's details.</li>
                <li className="flex gap-2"><span className="text-emerald-400">2.</span> Search &amp; add one or more products — only in-stock items appear.</li>
                <li className="flex gap-2"><span className="text-emerald-400">3.</span> Adjust each item's price if needed, then confirm.</li>
                <li className="flex gap-2"><span className="text-emerald-400">4.</span> Every item is marked Sold and removed from available stock.</li>
                <li className="flex gap-2"><span className="text-emerald-400">5.</span> The total is added to today's Cash Register automatically.</li>
              </ul>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-dark rounded-[2rem] shadow-xl shadow-gray-100/50 dark:shadow-none border border-gray-100 dark:border-dark-3 p-6">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Today</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{pagination.total} <span className="text-sm font-bold text-gray-400">total sale{pagination.total === 1 ? "" : "s"} on record</span></p>
          </div>
        </div>
      </div>

      {/* ── Sale History ─────────────────────────────────────────────── */}
      <div className="mt-6 bg-white dark:bg-gray-dark rounded-[2rem] shadow-xl shadow-gray-100/50 dark:shadow-none border border-gray-100 dark:border-dark-3 p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Cash Sale History</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white placeholder:text-gray-400 placeholder:font-medium w-56"
              />
            </div>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-3 py-2.5 bg-gray-50 dark:bg-dark-2 rounded-xl font-bold text-sm text-gray-700 dark:text-white outline-none border-2 border-transparent focus:border-[#E31E24]"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-dark-3">
                {["Date", "Product", "IMEI", "Customer", "Phone", "Price", "Sold By", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400 font-medium">Loading...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400 font-medium">No cash sales yet</td></tr>
              ) : (
                history.map((sale) => {
                  const isCancelled = sale.status === "cancelled";
                  const editable = isWithinEditWindow(sale.created_at) && !isCancelled;
                  return (
                    <tr key={sale.id} className={`border-b border-gray-50 dark:border-dark-3 hover:bg-gray-50/50 dark:hover:bg-dark-2/50 transition-colors ${isCancelled ? "opacity-60" : ""}`}>
                      <td className="py-3.5 px-3 whitespace-nowrap text-gray-500 dark:text-dark-6 font-medium">
                        {new Date(sale.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                        <div className="text-[10px] text-gray-400">{new Date(sale.created_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="py-3.5 px-3 font-bold text-gray-900 dark:text-white whitespace-nowrap max-w-[240px] truncate">
                        {sale.product_name}
                        {sale.item_count > 1 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-md align-middle">
                            <ShoppingCart className="w-2.5 h-2.5" /> {sale.item_count}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-xs text-gray-500 dark:text-dark-6 whitespace-nowrap">{sale.imei_serial || "—"}</td>
                      <td className="py-3.5 px-3 font-semibold text-gray-700 dark:text-dark-6 whitespace-nowrap">{sale.customer_name}</td>
                      <td className="py-3.5 px-3 text-gray-500 dark:text-dark-6 whitespace-nowrap">{sale.customer_phone || "—"}</td>
                      <td className="py-3.5 px-3 font-black text-emerald-600 whitespace-nowrap">{PKR(sale.final_price)}</td>
                      <td className="py-3.5 px-3 text-gray-500 dark:text-dark-6 whitespace-nowrap">{sale.sold_by?.full_name || sale.sold_by?.username || "—"}</td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">Cancelled</span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">Active</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Print / Download Invoice"
                            onClick={() => router.push(`/outlet/cash-sale/invoice/${sale.id}`)}
                            className="p-2 rounded-lg text-gray-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={isCancelled ? "This invoice is cancelled" : editable ? "Edit sale" : "Older than 3 days — can no longer be edited"}
                            onClick={() => editable && openEdit(sale)}
                            disabled={!editable}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={isCancelled ? "This invoice is already cancelled" : editable ? "Cancel Invoice" : "Older than 3 days — can no longer be cancelled"}
                            onClick={() => editable && handleCancel(sale)}
                            disabled={!editable || deletingId === sale.id}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            {deletingId === sale.id ? (
                              <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100 dark:border-dark-3">
          <p className="text-xs font-bold text-gray-400">
            Showing page {pagination.total === 0 ? 0 : page} of {pagination.totalPages} ({pagination.total} records)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="p-2 rounded-xl bg-gray-50 dark:bg-dark-2 text-gray-500 dark:text-dark-6 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-dark-3 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-[#E31E24] text-white font-black text-sm min-w-[2.5rem] text-center">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="p-2 rounded-xl bg-gray-50 dark:bg-dark-2 text-gray-500 dark:text-dark-6 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-dark-3 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Edit Sale Modal ───────────────────────────────────────────── */}
      {editingSale && (
        <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center p-4" onClick={closeEdit}>
          <div
            className="bg-white dark:bg-gray-dark rounded-[2rem] shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Edit Sale</h3>
              <button onClick={closeEdit} className="text-gray-300 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoading ? (
              <div className="py-16 text-center text-gray-400 font-medium text-sm">Loading sale details...</div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                      type="text"
                      placeholder="Customer Name *"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                      type="text"
                      placeholder="CNIC (optional)"
                      value={editCustomerCnic}
                      onChange={(e) => setEditCustomerCnic(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-dark-2 border-2 border-transparent focus:border-[#E31E24] rounded-2xl outline-none transition-all font-semibold text-sm text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Products</p>
                    <ProductSearchBox
                      search={editProductSearch}
                      onSearchChange={setEditProductSearch}
                      onPick={addToEditCart}
                      placeholder="Search to add another product..."
                    />
                    <div className="mt-3">
                      <CartList items={editCartItems} onPriceChange={updateEditCartPrice} onRemove={removeFromEditCart} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={saveEdit}
                  disabled={isSavingEdit}
                  className="w-full mt-6 py-3.5 bg-[#E31E24] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-red-700 active:scale-[0.99] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingEdit ? (
                    <div className="size-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Save Changes
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
