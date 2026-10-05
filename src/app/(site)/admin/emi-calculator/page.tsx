"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { PKR } from "@/components/Accounts/StatCard";
import { useAuth } from "../../../../../contexts/AuthContext";
import {
  calculateInstallmentPlans,
  EMI_CATEGORIES,
  fetchInstallmentFormula,
  findTier,
  INSTALLMENT_FORMULA_API,
  InstallmentFormula,
  setCachedInstallmentFormula,
} from "@/lib/emiCalculator";

const inputCls =
  "w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";
const cellInputCls =
  "w-full rounded-lg border border-stroke bg-white px-2.5 py-1.5 text-sm tabular-nums outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";

// Percent fields are edited as whole percentages (35) but stored as fractions (0.35).
const toPct = (v: number) => Math.round(v * 10000) / 100;
const fromPct = (v: string) => (v === "" ? NaN : Number(v) / 100);

const priceRangeLabel = (min: number | null, max: number | null) => {
  if (min === null && max === null) return "Any price";
  if (min === null) return `Up to ${max!.toLocaleString()}`;
  if (max === null) return `Above ${min.toLocaleString()}`;
  return `${(min + 1).toLocaleString()} – ${max.toLocaleString()}`;
};

export default function AdminEmiCalculatorPage() {
  const { user } = useAuth();
  const canEdit = (user?.role || "").toLowerCase() === "super admin";

  const [formula, setFormula] = useState<InstallmentFormula | null>(null);
  const [defaults, setDefaults] = useState<InstallmentFormula | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<InstallmentFormula | null>(null);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState(EMI_CATEGORIES[0]);
  const [price, setPrice] = useState("");

  useEffect(() => {
    fetchInstallmentFormula().then((r) => {
      if (r) {
        setFormula(r.data);
        setDefaults(r.defaults);
      } else {
        toast.error("Failed to load installment formula");
      }
      setLoading(false);
    });
  }, []);

  // While editing, the calculator previews the unsaved draft.
  const activeFormula = draft || formula;

  const plans = useMemo(() => {
    const p = parseFloat(price);
    if (!p || p <= 0) return [];
    return calculateInstallmentPlans(activeFormula, category, p);
  }, [activeFormula, category, price]);

  const matchedTier = useMemo(() => {
    const p = parseFloat(price);
    if (!activeFormula || !p || p <= 0) return null;
    return findTier(activeFormula, category, p);
  }, [activeFormula, category, price]);

  const updateDraft = (fn: (d: InstallmentFormula) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: InstallmentFormula = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(INSTALLMENT_FORMULA_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Cookies.get("auth_token")}` },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || json.error?.message || "Failed to save formula");
        return;
      }
      setFormula(json.data);
      setCachedInstallmentFormula(json.data);
      setDraft(null);
      toast.success("Installment formula updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save formula");
    } finally {
      setSaving(false);
    }
  };

  const editActions = canEdit && formula && (
    draft ? (
      <>
        <button
          onClick={() => defaults && setDraft(JSON.parse(JSON.stringify(defaults)))}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stroke bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-dark-3 dark:bg-gray-dark dark:text-gray-300"
        >
          <RotateCcw className="size-4" /> Reset to default
        </button>
        <button
          onClick={() => setDraft(null)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stroke bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-dark-3 dark:bg-gray-dark dark:text-gray-300"
        >
          <X className="size-4" /> Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#e63636] disabled:opacity-60"
        >
          <Save className="size-4" /> {saving ? "Saving..." : "Save Formula"}
        </button>
      </>
    ) : (
      <button
        onClick={() => setDraft(JSON.parse(JSON.stringify(formula)))}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#e63636]"
      >
        <Pencil className="size-4" /> Edit Formula
      </button>
    )
  );

  return (
    <>
      <Breadcrumb pageName="EMI Calculator" />
      <PageHeader
        icon={Calculator}
        title="EMI Calculator"
        subtitle="The same formula is used at order creation, inventory and the officer app."
        actions={editActions}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {EMI_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Cash Price (PKR)</label>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 85000" className={inputCls} />
        </div>
      </div>

      {draft && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          Previewing unsaved changes — click Save Formula to apply them everywhere.
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-gray-400 dark:border-white/10 dark:bg-boxdark">
          Loading formula...
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-gray-400 dark:border-white/10 dark:bg-boxdark">
          {parseFloat(price) > 0 ? "No tier matches this category and price." : "Enter a cash price to see installment plan options."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          {matchedTier && (
            <div className="border-b border-slate-50 px-4 py-2.5 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
              Matched tier: <span className="font-bold text-dark dark:text-white">{matchedTier.name}</span>
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">Months</th><th className="px-4 py-3 text-right font-bold">Advance</th><th className="px-4 py-3 text-right font-bold">Monthly</th><th className="px-4 py-3 text-right font-bold">Total Price</th><th className="px-4 py-3 text-right font-bold">Markup</th></tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.months} className="border-t border-slate-50 dark:border-white/5">
                  <td className="px-4 py-3.5 font-bold text-dark dark:text-white">{p.months}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(p.advanceAmount)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-[#ff3d3d]">{PKR(p.monthlyAmount)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(p.totalPrice)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600">{toPct(p.profit)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeFormula && (
        <div className="mt-8">
          <h2 className="mb-1 text-base font-black text-dark dark:text-white">Formula</h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Tiers are checked top to bottom — the first one matching the category and price is used. Advance = cash price × advance %,
            profit = (cash price − advance) × profit %, monthly = (remaining + profit) ÷ months. Advance, profit and monthly are rounded.
          </p>

          {/* Rounding */}
          <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-3 text-sm font-bold text-dark dark:text-white">Round Off</div>
            {draft ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Round to nearest (PKR)</label>
                  <input
                    type="number"
                    min={1}
                    value={Number.isFinite(draft.rounding.step) ? draft.rounding.step : ""}
                    onChange={(e) => updateDraft((d) => { d.rounding.step = e.target.value === "" ? NaN : Number(e.target.value); })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Mode</label>
                  <select
                    value={draft.rounding.mode}
                    onChange={(e) => updateDraft((d) => { d.rounding.mode = e.target.value as "nearest" | "up"; })}
                    className={inputCls}
                  >
                    <option value="nearest">Nearest (half or less rounds down)</option>
                    <option value="up">Always round up</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {activeFormula.rounding.mode === "up"
                  ? `Always rounded up to the next ${activeFormula.rounding.step}.`
                  : `Rounded to the nearest ${activeFormula.rounding.step} — remainder up to ${activeFormula.rounding.step / 2} rounds down, above it rounds up (e.g. ${activeFormula.rounding.step + activeFormula.rounding.step / 2} → ${activeFormula.rounding.step}, ${activeFormula.rounding.step + activeFormula.rounding.step / 2 + 1} → ${activeFormula.rounding.step * 2}).`}
              </p>
            )}
          </div>

          {/* Tiers */}
          <div className="space-y-4">
            {activeFormula.tiers.map((tier, ti) => (
              <div key={ti} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                {draft ? (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">Tier name</label>
                      <input value={tier.name} onChange={(e) => updateDraft((d) => { d.tiers[ti].name = e.target.value; })} className={cellInputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">Category (blank = any)</label>
                      <input
                        list="emi-category-options"
                        value={tier.category || ""}
                        onChange={(e) => updateDraft((d) => { d.tiers[ti].category = e.target.value.trim() ? e.target.value : null; })}
                        placeholder="Any"
                        className={cellInputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">Price above</label>
                      <input
                        type="number"
                        value={tier.min_price ?? ""}
                        onChange={(e) => updateDraft((d) => { d.tiers[ti].min_price = e.target.value === "" ? null : Number(e.target.value); })}
                        placeholder="No min"
                        className={cellInputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-gray-500">Price up to</label>
                      <input
                        type="number"
                        value={tier.max_price ?? ""}
                        onChange={(e) => updateDraft((d) => { d.tiers[ti].max_price = e.target.value === "" ? null : Number(e.target.value); })}
                        placeholder="No max"
                        className={cellInputCls}
                      />
                    </div>
                    <button
                      onClick={() => updateDraft((d) => { d.tiers.splice(ti, 1); })}
                      title="Remove tier"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-dark dark:text-white">{ti + 1}. {tier.name}</span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                      {tier.category || "Any category"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
                      {priceRangeLabel(tier.min_price, tier.max_price)}
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-2 py-2 font-bold">Months</th>
                        <th className="px-2 py-2 font-bold">Profit %</th>
                        <th className="px-2 py-2 font-bold">Advance %</th>
                        {draft && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {tier.plans.map((plan, pi) => (
                        <tr key={pi} className="border-t border-slate-50 dark:border-white/5">
                          {draft ? (
                            <>
                              <td className="px-2 py-1.5">
                                <input type="number" min={1} value={Number.isFinite(plan.months) ? plan.months : ""} onChange={(e) => updateDraft((d) => { d.tiers[ti].plans[pi].months = e.target.value === "" ? NaN : Number(e.target.value); })} className={cellInputCls} />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={0} step="0.01" value={Number.isFinite(plan.profit) ? toPct(plan.profit) : ""} onChange={(e) => updateDraft((d) => { d.tiers[ti].plans[pi].profit = fromPct(e.target.value); })} className={cellInputCls} />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={0} max={99} step="0.01" value={Number.isFinite(plan.advance) ? toPct(plan.advance) : ""} onChange={(e) => updateDraft((d) => { d.tiers[ti].plans[pi].advance = fromPct(e.target.value); })} className={cellInputCls} />
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  onClick={() => updateDraft((d) => { d.tiers[ti].plans.splice(pi, 1); })}
                                  title="Remove plan"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-2 py-2 font-bold text-dark dark:text-white">{plan.months}</td>
                              <td className="px-2 py-2 tabular-nums text-emerald-600">{toPct(plan.profit)}%</td>
                              <td className="px-2 py-2 tabular-nums text-gray-600 dark:text-gray-300">{toPct(plan.advance)}%</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {draft && (
                  <button
                    onClick={() => updateDraft((d) => {
                      const last = d.tiers[ti].plans[d.tiers[ti].plans.length - 1];
                      d.tiers[ti].plans.push({ months: (last?.months || 0) + 3, profit: last?.profit ?? 0.2, advance: last?.advance ?? 0.25 });
                    })}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#ff3d3d] transition hover:bg-[#ff3d3d]/10"
                  >
                    <Plus className="size-3.5" /> Add plan
                  </button>
                )}
              </div>
            ))}
          </div>

          {draft && (
            <button
              onClick={() => updateDraft((d) => {
                d.tiers.push({ name: `Tier ${d.tiers.length + 1}`, category: null, min_price: null, max_price: null, plans: [{ months: 3, profit: 0.2, advance: 0.4 }] });
              })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#ff3d3d]/40 px-4 py-2.5 text-sm font-semibold text-[#ff3d3d] transition hover:bg-[#ff3d3d]/5"
            >
              <Plus className="size-4" /> Add tier
            </button>
          )}

          <datalist id="emi-category-options">
            {EMI_CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      )}
    </>
  );
}
