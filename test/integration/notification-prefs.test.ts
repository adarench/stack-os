/**
 * Notification preferences write path — a staff opt-out actually suppresses the
 * channel in dispatch. Guards the gap the audit found: the read side honored
 * notification_preferences but nothing could write it. Auto-skips without
 * DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_prefs_${Date.now()}`;
const OP_CLERK = `local:prefsop_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "admin" })),
  isOperatorAllowed: vi.fn(async () => true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import postgres from "postgres";
import { setMyNotificationPreference, getMyNotificationPreferences } from "@/lib/server/notification-prefs";
import { enabledChannels } from "@/lib/server/notifications";
import { withScope } from "@/lib/server/db";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
let userId = "";

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    const [u] = await tx<{ id: string }[]>`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${"Op"}, 'admin') returning id`;
    userId = u!.id;
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["notification_preferences", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("notification preferences write path", () => {
  it("defaults to all channels on for staff", async () => {
    const prefs = await getMyNotificationPreferences();
    expect(prefs.find((p) => p.channel === "email")?.enabled).toBe(true);
    expect(prefs.find((p) => p.channel === "sms")?.enabled).toBe(true);
  }, 30_000);

  it("an opt-out suppresses that channel in dispatch, and re-enable restores it", async () => {
    await setMyNotificationPreference("email", false);
    const prefs = await getMyNotificationPreferences();
    expect(prefs.find((p) => p.channel === "email")?.enabled).toBe(false);

    // The dispatch read path must now exclude email for this user.
    const channels = await withScope({ orgId: ORG, actorType: "system" }, (tx) =>
      enabledChannels(tx, ORG, { userId }),
    );
    expect(channels).not.toContain("email");
    expect(channels).toContain("in_app"); // untouched channels stay on

    // Flipping back on (upsert same row) restores it.
    await setMyNotificationPreference("email", true);
    const after = await withScope({ orgId: ORG, actorType: "system" }, (tx) =>
      enabledChannels(tx, ORG, { userId }),
    );
    expect(after).toContain("email");
  }, 30_000);
});
