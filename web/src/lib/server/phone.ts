import "server-only";

/**
 * Normalize a phone number to E.164 (US default) for Twilio, which rejects
 * anything that isn't E.164. Every number we store or text goes through this.
 *
 *   "385-221-1268"      -> "+13852211268"
 *   "(503) 915-1351"    -> "+15039151351"
 *   "1 801 380 9434"    -> "+18013809434"
 *   "+44 7911 123456"   -> "+447911123456"  (already international — kept)
 *   "" / "123" / junk   -> null
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already international: keep the digits after "+".
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`; // bare US 10-digit
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; // 1 + US 10
  return null; // ambiguous / too short / too long — refuse rather than send junk
}
