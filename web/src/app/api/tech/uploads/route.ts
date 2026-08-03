import { NextResponse } from "next/server";
import { auth } from "@/lib/server/auth";
import { storageConfigured } from "@/lib/server/storage";
import { techAttachPhoto } from "@/lib/server/technician";
import { isAllowedUploadType, normalizeImageUpload } from "@/lib/server/upload-media";

/**
 * Technician photo upload (multipart). Gated on a staff session; `techAttachPhoto`
 * enforces that the WO is assigned to the caller, so a tech can only attach to
 * their own jobs. Fixed to work_order / after_photo.
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "no_active_org" }, { status: 400 });
  if (!storageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json({ error: "invalid_form", detail: String(err) }, { status: 400 });
  }
  const ref = String(form.get("ref") ?? "");
  const file = form.get("file");
  if (!ref) return NextResponse.json({ error: "missing_ref" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  const declaredType = file.type || "application/octet-stream";
  if (!isAllowedUploadType(declaredType)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  // Transcode HEIC → JPEG so a tech's iPhone photo renders everywhere.
  const media = await normalizeImageUpload({
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: declaredType,
    filename: file.name || `tech-upload-${Date.now()}`,
  });
  try {
    await techAttachPhoto(ref, orgId, {
      bytes: media.bytes,
      filename: media.filename,
      contentType: media.contentType,
      sizeBytes: media.bytes.byteLength,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error).message;
    // requireMyWo throws "not_found" when the WO isn't assigned to the caller.
    return NextResponse.json({ error: msg }, { status: msg === "not_found" ? 403 : 500 });
  }
}
