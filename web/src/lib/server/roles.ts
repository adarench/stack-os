/**
 * Role model (M1 · SEC-002/003). `users.role` is a plain text column, so
 * `technician` needs no enum migration — it is a new allowed value.
 *
 * Two *different* questions get asked about a role; keep them apart:
 *
 *  1. "Can this person use the console?" → `hasConsoleAccess` (LR-014). Every
 *     internal staff member can, technicians included. `technician` is a *job*
 *     (they do the field work and own buildings), not a reduced access tier.
 *  2. "Is this person on the ops desk?" → `isOperatorRole` / OPERATOR_ROLES.
 *     Only used for team-wide notification fan-out, where techs are
 *     deliberately excluded so they hear about *their* jobs, not all of them
 *     (see `notifyOpsTeam`). Not an access boundary.
 *
 * `technician` still drives real behavior — property coverage, auto-routing,
 * the assignable-tech picker, SMS dispatch — it just doesn't hide the cockpit.
 */
export const OPERATOR_ROLES = ["staff", "dispatcher", "manager", "admin"] as const;
export const ALL_STAFF_ROLES = [...OPERATOR_ROLES, "technician"] as const;
export type StaffRole = (typeof ALL_STAFF_ROLES)[number];

/** Roles that get the full operator console. All internal staff (LR-014). */
export const CONSOLE_ROLES = ALL_STAFF_ROLES;

export function isStaffRole(role: string): role is StaffRole {
  return (ALL_STAFF_ROLES as readonly string[]).includes(role);
}
/**
 * Console/authorization gate. A null role means "no staff row resolved" — that
 * still blocks (unknown accounts get nothing).
 */
export function hasConsoleAccess(role: string | null | undefined): boolean {
  return !!role && (CONSOLE_ROLES as readonly string[]).includes(role);
}
/** Ops-desk membership — notification fan-out only, NOT an access check. */
export function isOperatorRole(role: string | null | undefined): boolean {
  return !!role && (OPERATOR_ROLES as readonly string[]).includes(role);
}
export function isTechnicianRole(role: string | null | undefined): boolean {
  return role === "technician";
}
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}
