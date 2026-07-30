import { describe, expect, it } from "vitest";
import {
  ALL_STAFF_ROLES,
  hasConsoleAccess,
  isAdminRole,
  isOperatorRole,
  isStaffRole,
  isTechnicianRole,
} from "@/lib/server/roles";

describe("roles (M1 · RBAC)", () => {
  it("classifies ops-desk roles (notification fan-out, not access)", () => {
    for (const r of ["staff", "dispatcher", "manager", "admin"]) {
      expect(isOperatorRole(r)).toBe(true);
    }
    // Techs are off the team-wide notify list on purpose (notifyOpsTeam) —
    // this says nothing about what they can see (LR-014).
    expect(isOperatorRole("technician")).toBe(false);
    expect(isOperatorRole(null)).toBe(false);
    expect(isOperatorRole(undefined)).toBe(false);
  });

  it("gives every staff role — technicians included — console access", () => {
    for (const r of ALL_STAFF_ROLES) expect(hasConsoleAccess(r)).toBe(true);
    expect(hasConsoleAccess("technician")).toBe(true);
    // Non-staff identities and unresolved sessions still get nothing.
    expect(hasConsoleAccess("vendor")).toBe(false);
    expect(hasConsoleAccess("tenant")).toBe(false);
    expect(hasConsoleAccess(null)).toBe(false);
    expect(hasConsoleAccess(undefined)).toBe(false);
  });

  it("classifies technician and admin distinctly", () => {
    expect(isTechnicianRole("technician")).toBe(true);
    expect(isTechnicianRole("staff")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("manager")).toBe(false);
  });

  it("includes technician in the staff role set", () => {
    expect(ALL_STAFF_ROLES).toContain("technician");
    expect(isStaffRole("technician")).toBe(true);
    expect(isStaffRole("vendor")).toBe(false);
  });
});
