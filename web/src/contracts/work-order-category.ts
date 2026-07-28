/**
 * Issue categories the tenant app offers on submit. Stored on
 * work_orders.category (nullable text — not every WO has one, e.g. ops-created
 * recurring tasks). Kept light on purpose: a resident taps one, ops gets a
 * clean triage signal.
 */
export const WORK_ORDER_CATEGORIES = [
  "plumbing",
  "electrical",
  "hvac",
  "appliance",
  "locks_doors",
  // Commercial categories (Lucid) — frequent requests so tenants tap instead of
  // re-describing every time.
  "cleaning",
  "supplies",
  "restroom_supplies",
  "beverage",
  "general",
] as const;

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number];

export const WORK_ORDER_CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "Heat / AC",
  appliance: "Appliance",
  locks_doors: "Locks & doors",
  cleaning: "Cleaning",
  supplies: "Supplies",
  restroom_supplies: "Restroom / soap out",
  beverage: "Beverage / soda machine",
  general: "Something else",
};

export function workOrderCategoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return WORK_ORDER_CATEGORY_LABELS[category as WorkOrderCategory] ?? category;
}
