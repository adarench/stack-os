import { NextResponse } from "next/server";
import { z } from "zod";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { attachTenantUpload, tenantOwnsWorkOrder } from "@/lib/server/tenant-work-orders";
import { signUploadUrl, storageConfigured, uploadObject } from "@/lib/server/storage";

const body = z.object({
  workOrderId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

/**
 * Tenant upload presign. Mirrors /api/uploads/sign but gated on the tenant
 * session AND ownership of the target work order (a resident can only attach
 * to their own WO). targetType is fixed to work_order.
 */
export async function POST(req: Request) {
  const session = await readTenantSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!storageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return handleMultipartUpload(req, session);
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid_body", detail: String(err) }, { status: 400 });
  }

  if (!(await tenantOwnsWorkOrder(session, parsed.workOrderId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const signed = await signUploadUrl({
    orgId: session.orgId,
    targetType: "work_order",
    targetId: parsed.workOrderId,
    filename: parsed.filename,
    contentType: parsed.contentType,
  });
  return NextResponse.json(signed);
}

async function handleMultipartUpload(
  req: Request,
  session: NonNullable<Awaited<ReturnType<typeof readTenantSession>>>,
) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json({ error: "invalid_form", detail: String(err) }, { status: 400 });
  }

  const workOrderId = String(form.get("workOrderId") ?? "");
  const file = form.get("file");
  if (!z.string().uuid().safeParse(workOrderId).success) {
    return NextResponse.json({ error: "invalid_work_order" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (!(await tenantOwnsWorkOrder(session, workOrderId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const filename = file.name || `tenant-upload-${Date.now()}`;
  const type = file.type || "application/octet-stream";
  try {
    const stored = await uploadObject({
      orgId: session.orgId,
      targetType: "work_order",
      targetId: workOrderId,
      filename,
      contentType: type,
      body: new Uint8Array(await file.arrayBuffer()),
    });
    await attachTenantUpload(session, {
      workOrderId,
      storageKey: stored.key,
      contentType: type,
      filename,
      sizeBytes: file.size,
    });
    return NextResponse.json({ key: stored.key });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
