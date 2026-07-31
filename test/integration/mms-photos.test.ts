/**
 * Tenant photos → tech MMS. When a tech-facing notification sets attachWoPhotos,
 * the work order's still-image attachments are signed and passed to Twilio as
 * MMS media — HEIC and video excluded, capped to the carrier's 10-item limit.
 * Storage signing + the Twilio send are mocked; the DB + dispatch are real.
 * Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Deterministic signed URLs, storage always "configured" — env-independent.
vi.mock("@/lib/server/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/storage")>();
  return {
    ...actual,
    storageConfigured: () => true,
    signReadUrl: vi.fn(async (key: string) => `https://cdn.test/${encodeURIComponent(key)}`),
  };
});
// Capture the send instead of hitting Twilio.
vi.mock("@/lib/server/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sms")>();
  return { ...actual, sendSms: vi.fn(async () => ({ id: "SMtest" })) };
});

import postgres from "postgres";
import { sendSms } from "@/lib/server/sms";
import { dispatchInline } from "@/lib/server/notifications";

const smsMock = sendSms as unknown as ReturnType<typeof vi.fn>;
const ORG = `org_mms_${Date.now()}`;
const TECH_PHONE = "+13852211268";
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { techId: "", woId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

async function addAttachment(
  tx: postgres.Sql,
  target: string,
  key: string,
  contentType: string,
  ordering: number,
  sizeBytes: number,
) {
  await tx`insert into attachments (org_id, target_type, target_id, kind, storage_key, content_type, size_bytes, ordering)
           values (${ORG}, 'work_order', ${target}, 'general', ${key}, ${contentType}, ${sizeBytes}, ${ordering})`;
}

beforeEach(() => smsMock.mockClear());

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  ids.woId = crypto.randomUUID();
  await admin.begin(async (tx) => {
    await sys(tx);
    const [t] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role, phone) values (${ORG}, ${`local:osc_${Date.now()}`}, ${`oscar_${Date.now()}@stackwithus.com`}, ${"Oscar"}, 'technician', ${TECH_PHONE}) returning id`;
    ids.techId = t!.id;
    // Two carrier-safe images, plus a HEIC and a video that must be filtered out.
    await addAttachment(tx, ids.woId, "k/leak-1.jpg", "image/jpeg", 0, 120_000);
    await addAttachment(tx, ids.woId, "k/leak-2.png", "image/png", 1, 90_000);
    await addAttachment(tx, ids.woId, "k/leak-3.heic", "image/heic", 2, 200_000);
    await addAttachment(tx, ids.woId, "k/leak-clip.mp4", "video/mp4", 3, 3_000_000);
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`delete from notifications where org_id = ${ORG}`;
    await tx`delete from attachments where org_id = ${ORG}`;
    await tx`delete from users where org_id = ${ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("tenant photos → tech MMS", () => {
  it("attaches only still images when attachWoPhotos is set", async () => {
    await dispatchInline({
      orgId: ORG,
      recipientUserId: ids.techId,
      recipientPhone: TECH_PHONE,
      recipientEmail: null,
      kind: "wo_assigned",
      subject: "New WO-42",
      body: "Kitchen sink leak.",
      url: "/tech/WO-42",
      targetType: "work_order",
      targetId: ids.woId,
      attachWoPhotos: true,
      dedupeKey: `mms:${ids.woId}:a`,
    });
    expect(smsMock).toHaveBeenCalledTimes(1);
    const arg = smsMock.mock.calls[0]![0] as { mediaUrl?: string[] };
    expect(arg.mediaUrl).toBeDefined();
    expect(arg.mediaUrl).toHaveLength(2); // jpeg + png only
    expect(arg.mediaUrl!.some((u) => u.includes("leak-1.jpg"))).toBe(true);
    expect(arg.mediaUrl!.some((u) => u.includes("leak-2.png"))).toBe(true);
    expect(arg.mediaUrl!.some((u) => u.includes(".heic"))).toBe(false);
    expect(arg.mediaUrl!.some((u) => u.includes(".mp4"))).toBe(false);
    expect(arg.mediaUrl!.every((u) => u.startsWith("https://"))).toBe(true);
  }, 30_000);

  it("sends no media when attachWoPhotos is not set", async () => {
    await dispatchInline({
      orgId: ORG,
      recipientUserId: ids.techId,
      recipientPhone: TECH_PHONE,
      recipientEmail: null,
      kind: "wo_message",
      subject: "New message on WO-42",
      body: "A resident replied.",
      url: "/tech/WO-42",
      targetType: "work_order",
      targetId: ids.woId,
      // attachWoPhotos omitted
      dedupeKey: `mms:${ids.woId}:b`,
    });
    expect(smsMock).toHaveBeenCalledTimes(1);
    const arg = smsMock.mock.calls[0]![0] as { mediaUrl?: string[] };
    expect(arg.mediaUrl).toBeUndefined();
  }, 30_000);
});
