type ValuedUnit = { quantity: number; purchase_price: number; status: string };
export const stockValue = (units: ValuedUnit[]) => units.reduce((sum, unit) =>
    sum + (unit.status === "In Stock" || unit.status === "Used Stock" ? unit.quantity * unit.purchase_price : 0), 0);
