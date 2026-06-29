import { NextResponse } from "next/server";
import { z } from "zod";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { tenantOwnsWorkOrder } from "@/lib/server/tenant-work-orders";
import { signUploadUrl, storageConfigured } from "@/lib/server/storage";

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
