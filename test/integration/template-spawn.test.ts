/**
 * P3 template spawn integration test.
 *
 * Auto-skipped without DATABASE_URL. Mocks Clerk auth so server actions
 * run outside an HTTP context.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_p3_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_p3_${Date.now()}`;

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({
    userId: TEST_CLERK_USER_ID,
    orgId: TEST_ORG,
    sessionClaims: {},
    orgRole: "org:admin",
    orgSlug: null,
    has: () => false,
  })),
  currentUser: vi.fn(async () => ({
    id: TEST_CLERK_USER_ID,
    primaryEmailAddress: { emailAddress: "p3-test@stack-os.example" },
    emailAddresses: [{ emailAddress: "p3-test@stack-os.example" }],
    firstName: "P3",
    lastName: "Test",
  })),
}));

import postgres from "postgres";
import { createProperty } from "@/lib/server/properties";
import {
  createTemplate,
  spawnTemplateNow,
  setTemplateActive,
  listTemplates,
  listTemplateFires,
  runDueTemplates,
} from "@/lib/server/templates";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;

let admin: postgres.Sql | null = null;

beforeAll(async () => {
  if (skip || !url) return;
  if (!process.env.VENDOR_MAGIC_LINK_SECRET) {
    process.env.VENDOR_MAGIC_LINK_SECRET = "test_secret_at_least_32_characters_long_xxx";
  }
  admin = postgres(url, { max: 1 });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await tx`select set_config('app.actor_type', 'system', true)`;
    await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
    await tx`set local role app_user`;
    await tx`delete from audit_log where org_id = ${TEST_ORG}`;
    await tx`delete from task_template_fires where org_id = ${TEST_ORG}`;
    await tx`delete from task_templates where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("P3 template spawn", () => {
  let propertyId: string;
  let templateId: string;

  it("creates a template with a valid cron + computed nextFireAt", async () => {
    const prop = await createProperty({
      name: "P3 test property",
      city: "Boise",
      state: "ID",
    });
    propertyId = prop.id;

    const t = await createTemplate({
      name: "Weekly common-area walkthrough",
      description: "Inspect common areas, take photos",
      cron: "0 9 * * 1",
      timezone: "America/New_York",
      defaultTitle: "Walkthrough",
      defaultPriority: "normal",
      defaultPropertyId: propertyId,
      leadTimeHours: 24,
    });
    expect(t.id).toBeTruthy();
    expect(t.isActive).toBe(true);
    expect(t.timesFired).toBe(0);
    expect(t.nextFireAt).toBeTruthy();
    templateId = t.id;
  });

  it("rejects invalid cron expressions", async () => {
    await expect(
      createTemplate({
        name: "bad cron",
        cron: "not a cron",
        defaultTitle: "x",
      } as never),
    ).rejects.toThrow(/invalid_cron/);
  });

  it("spawnTemplateNow creates a WO and advances state", async () => {
    const before = (await listTemplates()).find((t) => t.id === templateId)!;
    const r = await spawnTemplateNow(templateId);
    expect(r.workOrderId).toBeTruthy();

    const after = (await listTemplates()).find((t) => t.id === templateId)!;
    expect(after.timesFired).toBe(before.timesFired + 1);
    expect(after.lastFiredAt).toBeTruthy();

    // Fire row recorded
    const fires = await listTemplateFires(templateId);
    expect(fires.length).toBe(1);
    expect(fires[0]!.spawnedWorkOrderId).toBe(r.workOrderId);
  });

  it("paused template skips spawning", async () => {
    await setTemplateActive(templateId, false);
    // Run the cron — it should not fire a paused template
    const r = await runDueTemplates();
    // Even if the template's nextFireAt is past, isActive=false filters it out
    expect(r.spawned).toBe(0);
    await setTemplateActive(templateId, true);
  });

  it("spawn is idempotent on the same fire_at", async () => {
    if (!admin) return;
    // Use admin to set nextFireAt to a known past time
    const knownFireAt = new Date("2026-05-01T13:00:00Z");
    await admin.begin(async (tx) => {
      await tx`select set_config('app.actor_type', 'system', true)`;
      await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
      await tx`set local role app_user`;
      await tx`update task_templates set next_fire_at = ${knownFireAt} where id = ${templateId}`;
    });

    const r1 = await runDueTemplates(new Date());
    expect(r1.spawned).toBeGreaterThanOrEqual(1);

    // Reset nextFireAt back to the same fire-at to simulate a re-run hitting
    // the same period (it shouldn't double-spawn).
    await admin.begin(async (tx) => {
      await tx`select set_config('app.actor_type', 'system', true)`;
      await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
      await tx`set local role app_user`;
      await tx`update task_templates set next_fire_at = ${knownFireAt} where id = ${templateId}`;
    });

    const r2 = await runDueTemplates(new Date());
    // Idempotent: 0 actually-spawned (skipped due to dedupe key)
    expect(r2.skipped).toBeGreaterThanOrEqual(1);
    expect(r2.spawned).toBe(0);
  }, 30_000);
});
