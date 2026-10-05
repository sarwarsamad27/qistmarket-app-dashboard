// Client copy of the backend installment formula engine
// (qistmarket-app-backend/src/utils/installmentFormulaUtils.js). The formula itself
// (tiers, profit/advance %, rounding) is NOT hard-coded here — it's fetched from
// GET /api/admin-panel/installment-formula and edited on the EMI Calculator page,
// so order creation, convert-sale, self-pickup, inventory and the officer app all
// produce the same numbers. Keep calculateInstallmentPlans/roundAmount in step
// with the backend.

import { useEffect, useState } from "react";
import Cookies from "js-cookie";

export interface FormulaPlan {
  months: number;
  profit: number; // fraction, 0.35 = 35%
  advance: number; // fraction of cash price
}

export interface FormulaTier {
  name: string;
  category: string | null; // null = any category
  min_price: number | null; // exclusive
  max_price: number | null; // inclusive
  plans: FormulaPlan[];
}

export interface InstallmentFormula {
  rounding: { step: number; mode: "nearest" | "up" };
  tiers: FormulaTier[];
}

export interface EmiPlan extends FormulaPlan {
  advanceAmount: number;
  monthlyAmount: number;
  totalPrice: number;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
export const INSTALLMENT_FORMULA_API = `${BACKEND_URL}/api/admin-panel/installment-formula`;

// 'nearest': remainder <= step/2 rounds down, above rounds up (step 100: 1150 → 1100, 1151 → 1200).
// 'up': always the next step.
export function roundAmount(amount: number, rounding?: InstallmentFormula["rounding"] | null): number {
  const step = rounding?.step || 100;
  const value = Math.round(Number(amount) * 100) / 100;
  if (rounding?.mode === "up") return Math.ceil(value / step) * step;
  const base = Math.floor(value / step) * step;
  return value - base <= step / 2 ? base : base + step;
}

export function findTier(formula: InstallmentFormula, category: string, price: number): FormulaTier | null {
  const cat = (category || "").toLowerCase().trim();
  return (
    formula.tiers.find((t) => {
      if (t.category && t.category.toLowerCase().trim() !== cat) return false;
      if (t.min_price !== null && t.min_price !== undefined && !(price > t.min_price)) return false;
      if (t.max_price !== null && t.max_price !== undefined && !(price <= t.max_price)) return false;
      return true;
    }) || null
  );
}

// Plan amounts for one formula plan — also used when an officer overrides the advance.
export function computePlan(plan: FormulaPlan, price: number, advanceAmount: number, formula: InstallmentFormula): EmiPlan {
  const remaining = price - advanceAmount;
  const profitAmount = roundAmount(remaining * plan.profit, formula.rounding);
  const monthlyAmount = roundAmount((remaining + profitAmount) / plan.months, formula.rounding);
  return { ...plan, advanceAmount, monthlyAmount, totalPrice: advanceAmount + monthlyAmount * plan.months };
}

export function calculateInstallmentPlans(formula: InstallmentFormula | null, category: string, price: number): EmiPlan[] {
  if (!formula || !price || price <= 0) return [];
  const tier = findTier(formula, category, price);
  if (!tier) return [];
  return tier.plans.map((p) => computePlan(p, price, roundAmount(price * p.advance, formula.rounding), formula));
}

// Same shape the backend stores on inventory (OutletInventory.installment_plans).
export function toStoredPlans(plans: EmiPlan[]) {
  return plans.map((p) => ({
    advance: p.advanceAmount,
    monthlyAmount: p.monthlyAmount,
    totalPrice: p.totalPrice,
    months: p.months,
    isActive: true,
  }));
}

export async function fetchInstallmentFormula(): Promise<{ data: InstallmentFormula; defaults: InstallmentFormula } | null> {
  try {
    const res = await fetch(INSTALLMENT_FORMULA_API, {
      headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
    });
    const json = await res.json();
    return json.success ? { data: json.data, defaults: json.defaults } : null;
  } catch (err) {
    console.error("Failed to load installment formula:", err);
    return null;
  }
}

// Module-level cache so several screens don't refetch on every mount.
let cachedFormula: InstallmentFormula | null = null;
let inflight: Promise<InstallmentFormula | null> | null = null;

export function setCachedInstallmentFormula(formula: InstallmentFormula) {
  cachedFormula = formula;
}

export function useInstallmentFormula(): InstallmentFormula | null {
  const [formula, setFormula] = useState<InstallmentFormula | null>(cachedFormula);

  useEffect(() => {
    let active = true;
    if (!inflight) {
      inflight = fetchInstallmentFormula().then((r) => {
        if (r) cachedFormula = r.data;
        return cachedFormula;
      }).finally(() => {
        inflight = null;
      });
    }
    inflight.then((f) => {
      if (active && f) setFormula(f);
    });
    return () => {
      active = false;
    };
  }, []);

  return formula;
}

export const EMI_CATEGORIES = ["Mobiles", "Electronics", "Appliances", "Other"];
