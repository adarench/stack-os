import { describe, expect, it } from "vitest";
import {
  ALL_STAFF_ROLES,
  isAdminRole,
  isOperatorRole,
  isStaffRole,
  isTechnicianRole,
} from "@/lib/server/roles";

describe("roles (M1 · RBAC)", () => {
  it("classifies operator roles", () => {
    for (const r of ["staff", "dispatcher", "manager", "admin"]) {
      expect(isOperatorRole(r)).toBe(true);
    }
    expect(isOperatorRole("technician")).toBe(false);
    expect(isOperatorRole(null)).toBe(false);
    expect(isOperatorRole(undefined)).toBe(false);
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
