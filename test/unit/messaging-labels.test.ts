import { describe, expect, it } from "vitest";
import {
  commentAuthorLabel,
  formatTenantNames,
  personLabel,
} from "@/lib/messaging-labels";

describe("messaging labels (ops #21)", () => {
  it("personLabel prefers name over email", () => {
    expect(personLabel({ id: "1", name: "Ada", email: "a@x.com" }, "Staff")).toBe("Ada");
    expect(personLabel({ id: "1", name: "  ", email: "a@x.com" }, "Staff")).toBe("a@x.com");
    expect(personLabel({ id: "1", name: null, email: null }, "Staff")).toBe("Staff");
    expect(personLabel(null, "Staff")).toBe("Staff");
  });

  it("commentAuthorLabel resolves staff and vendor maps", () => {
    const staff = new Map([
      ["s1", { id: "s1", name: "Oscar", email: "o@stack.test" }],
    ]);
    const vendors = new Map([
      ["v1", { id: "v1", name: null, email: "vendor@co.test" }],
    ]);
    expect(
      commentAuthorLabel({ actorType: "user", actorUserId: "s1" }, staff, vendors),
    ).toBe("Oscar");
    expect(
      commentAuthorLabel({ actorType: "vendor", actorUserId: "v1" }, staff, vendors),
    ).toBe("vendor@co.test");
    expect(
      commentAuthorLabel({ actorType: "user", actorUserId: "missing" }, staff, vendors),
    ).toBe("Staff");
    expect(
      commentAuthorLabel({ actorType: "system", actorUserId: null }, staff, vendors),
    ).toBe("System");
    expect(
      commentAuthorLabel({ actorType: "user", actorUserId: null }, staff, vendors),
    ).toBe("Unknown sender");
  });

  it("formatTenantNames returns null when unknown (no invented names)", () => {
    expect(formatTenantNames([])).toBeNull();
    expect(formatTenantNames([{ name: null, email: null }])).toBeNull();
    expect(formatTenantNames([{ name: "Rivera", email: "r@x.com" }])).toBe("Rivera");
    expect(
      formatTenantNames([
        { name: "Rivera", email: null },
        { name: null, email: "other@x.com" },
      ]),
    ).toBe("Rivera, other@x.com");
  });
});
