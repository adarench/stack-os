/**
 * Upload media normalization — HEIC/HEIF is transcoded to JPEG (so it renders on
 * desktop Chrome/Firefox + Android, not just iOS Safari), other images pass
 * through untouched, and the MIME allowlist gates what the server will store.
 * Uses sharp to synthesize real fixtures (no binary assets committed).
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  isAllowedUploadType,
  isAllowedStaffUploadType,
  normalizeImageUpload,
} from "@/lib/server/upload-media";

const RED = { create: { width: 16, height: 16, channels: 3 as const, background: { r: 220, g: 20, b: 20 } } };

async function jpegBytes() {
  return new Uint8Array(await sharp(RED).jpeg().toBuffer());
}
async function heicBytes() {
  // A real HEIF-family file (av1/avif brand) so the decode path is genuinely exercised.
  return new Uint8Array(await sharp(RED).heif({ compression: "av1", quality: 50 }).toBuffer());
}

describe("upload MIME allowlist", () => {
  it("accepts images + video on the tenant/tech path, rejects everything else", () => {
    for (const t of ["image/jpeg", "image/png", "image/heic", "image/heif", "video/mp4", "video/quicktime"]) {
      expect(isAllowedUploadType(t), t).toBe(true);
    }
    for (const t of ["application/pdf", "text/html", "application/octet-stream", "image/svg+xml"]) {
      expect(isAllowedUploadType(t), t).toBe(false);
    }
    // Parameters are ignored.
    expect(isAllowedUploadType("image/jpeg; charset=binary")).toBe(true);
  });

  it("also allows PDFs on the staff path (COIs/invoices) but still blocks junk", () => {
    expect(isAllowedStaffUploadType("application/pdf")).toBe(true);
    expect(isAllowedStaffUploadType("image/png")).toBe(true);
    expect(isAllowedStaffUploadType("text/html")).toBe(false);
  });
});

describe("normalizeImageUpload", () => {
  it("transcodes a HEIC/HEIF upload to JPEG", async () => {
    const bytes = await heicBytes();
    const out = await normalizeImageUpload({ bytes, contentType: "image/heic", filename: "IMG_1234.HEIC" });
    expect(out.contentType).toBe("image/jpeg");
    expect(out.filename).toBe("IMG_1234.jpg");
    // The result is a real, decodable JPEG.
    const meta = await sharp(out.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(16);
  });

  it("catches a HEIC mislabeled as image/jpeg via magic-byte sniff", async () => {
    const bytes = await heicBytes();
    const out = await normalizeImageUpload({ bytes, contentType: "image/jpeg", filename: "photo.jpg" });
    // Sniff spotted the ftyp brand → still transcoded.
    expect(out.contentType).toBe("image/jpeg");
    expect((await sharp(out.bytes).metadata()).format).toBe("jpeg");
  });

  it("passes a genuine JPEG through untouched", async () => {
    const bytes = await jpegBytes();
    const out = await normalizeImageUpload({ bytes, contentType: "image/jpeg", filename: "a.jpg" });
    expect(out.contentType).toBe("image/jpeg");
    expect(out.filename).toBe("a.jpg");
    expect(out.bytes).toBe(bytes); // same reference — no re-encode
  });

  it("keeps the original when a HEIC-typed upload can't be decoded (best-effort)", async () => {
    const bogus = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const out = await normalizeImageUpload({ bytes: bogus, contentType: "image/heic", filename: "x.heic" });
    // Undecodable → we don't throw and we don't lose the bytes.
    expect(out.bytes).toBe(bogus);
  });
});
