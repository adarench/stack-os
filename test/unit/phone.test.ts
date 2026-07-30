import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/server/phone";

describe("normalizePhone (E.164)", () => {
  it("normalizes bare US 10-digit + common formats", () => {
    expect(normalizePhone("385-221-1268")).toBe("+13852211268");
    expect(normalizePhone("(503) 915-1351")).toBe("+15039151351");
    expect(normalizePhone("801.380.9434")).toBe("+18013809434");
    expect(normalizePhone("3859857065")).toBe("+13859857065");
  });

  it("normalizes 1 + 10 digits and already-+ forms", () => {
    expect(normalizePhone("1 801 380 9434")).toBe("+18013809434");
    expect(normalizePhone("+1 (385) 985-7065")).toBe("+13859857065");
    expect(normalizePhone("+447911123456")).toBe("+447911123456"); // int'l kept
  });

  it("rejects junk / ambiguous input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("call me maybe")).toBeNull();
    expect(normalizePhone("12345678901234567")).toBeNull(); // too long
  });
});
