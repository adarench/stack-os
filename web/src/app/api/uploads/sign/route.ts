import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { signUploadUrl, storageConfigured } from "@/lib/server/storage";
import { POLYMORPHIC_TARGETS } from "@contracts/polymorphic";

const body = z.object({
  targetType: z.enum(POLYMORPHIC_TARGETS),
  targetId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "no_active_org" }, { status: 400 });

  if (!storageConfigured()) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "invalid_body", detail: String(err) }, { status: 400 });
  }

  const signed = await signUploadUrl({
    orgId,
    targetType: parsed.targetType,
    targetId: parsed.targetId,
    filename: parsed.filename,
    contentType: parsed.contentType,
  });
  return NextResponse.json(signed);
}
