import "server-only";
import sharp from "sharp";
import { logError } from "./logger";

/**
 * Upload media normalization + validation, shared by every upload path (tenant,
 * technician, staff). Two jobs:
 *
 *  1. **HEIC → JPEG.** iPhones shoot HEIC by default; stored raw it renders
 *     broken on desktop Chrome/Firefox and Android (only iOS Safari decodes it).
 *     Operators triage on desktop, so we transcode to JPEG at upload time.
 *  2. **MIME allowlist.** The client `accept=` attribute is bypassable, so the
 *     server is the real gate — only image/video types the app can display.
 */

/** Browser-safe still images we accept (HEIC/HEIF are accepted then transcoded). */
const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
/** Video formats phones capture and browsers can play back. */
const ALLOWED_VIDEO = new Set(["video/mp4", "video/quicktime", "video/webm"]);
/** Documents staff attach (COIs, invoices) — never from the tenant/tech photo paths. */
const ALLOWED_DOCUMENT = new Set(["application/pdf"]);

/** Unified server-side upload cap (mirrors the per-route guards). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** HEIC/HEIF content types that must be transcoded for universal rendering. */
const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

/** Strip any `; charset=…` / parameters and lower-case for comparison. */
function baseType(contentType: string): string {
  return contentType.toLowerCase().split(";")[0]!.trim();
}

/** Media type allowed on the tenant/tech photo paths (image + video only). */
export function isAllowedUploadType(contentType: string): boolean {
  const ct = baseType(contentType);
  return ALLOWED_IMAGE.has(ct) || ALLOWED_VIDEO.has(ct);
}

/** Type allowed on the staff attachment path — also PDFs (COIs, invoices). */
export function isAllowedStaffUploadType(contentType: string): boolean {
  return isAllowedUploadType(contentType) || ALLOWED_DOCUMENT.has(baseType(contentType));
}

/**
 * Sniff the ISO-BMFF `ftyp` box for a HEIC/HEIF/AVIF brand, so a mislabeled
 * iPhone upload (declared image/jpeg but actually HEIC) is still caught and
 * transcoded. Layout: [size:4][`ftyp`:4][major_brand:4].
 */
function sniffHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return false; // not 'ftyp'
  }
  const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
  return ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1", "heif", "avif", "avis"].includes(brand);
}

export interface UploadMedia {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

/**
 * Transcode HEIC/HEIF uploads to JPEG (applying EXIF orientation so portrait
 * photos aren't sideways); pass everything else through untouched. Best-effort:
 * if a HEIC can't be decoded we keep the original rather than dropping the
 * resident's photo (no worse than today's behavior).
 */
export async function normalizeImageUpload(input: UploadMedia): Promise<UploadMedia> {
  const looksHeic = HEIC_TYPES.has(baseType(input.contentType)) || sniffHeic(input.bytes);
  if (!looksHeic) return input;
  try {
    const jpeg = await sharp(input.bytes, { failOn: "none" })
      .rotate() // bake in EXIF orientation
      .jpeg({ quality: 82 })
      .toBuffer();
    const filename = input.filename.replace(/\.(heic|heif)$/i, "") + ".jpg";
    return { bytes: new Uint8Array(jpeg), contentType: "image/jpeg", filename };
  } catch (e) {
    logError("upload.heic_transcode_failed", e, { filename: input.filename });
    return input; // never lose the photo — store the original
  }
}
