/**
 * Role model (M1 · SEC-002/003). `users.role` is a plain text column, so
 * `technician` needs no enum migration — it is a new allowed value.
 *
 * - operator roles (staff → admin) run the desktop cockpit; `admin` manages
 *   config/accounts.
 * - `technician` is the internal field role (LR-005); NOT a vendor.
 */
export const OPERATOR_ROLES = ["staff", "dispatcher", "manager", "admin"] as const;
export const ALL_STAFF_ROLES = [...OPERATOR_ROLES, "technician"] as const;
export type StaffRole = (typeof ALL_STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (ALL_STAFF_ROLES as readonly string[]).includes(role);
}
export function isOperatorRole(role: string | null | undefined): boolean {
  return !!role && (OPERATOR_ROLES as readonly string[]).includes(role);
}
export function isTechnicianRole(role: string | null | undefined): boolean {
  return role === "technician";
}
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}
