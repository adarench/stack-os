/**
 * P3 template spawn integration test.
 *
 * Auto-skipped without DATABASE_URL. Mocks Clerk auth so server actions
 * run outside an HTTP context.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_p3_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_p3_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({
    userId: TEST_CLERK_USER_ID,
    orgId: TEST_ORG,
    email: "test@stack-os.example",
    name: "Test User",
  })),
  isOperatorAllowed: vi.fn(async () => true),
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
    // runDueTemplates() is an ORG-WIDE sweep, so its global `spawned` count is
    // polluted by any other org's due templates (e.g. seed data) — asserting on
    // it is non-isolated and flakes under the full suite. Assert instead on THIS
    // template's own fires: a paused template must not fire, regardless of what
    // else is due across the DB.
    const before = (await listTemplateFires(templateId)).length;
    await runDueTemplates();
    const after = (await listTemplateFires(templateId)).length;
    expect(after).toBe(before);
    await setTemplateActive(templateId, true);
  });

  it("spawn is idempotent on the same fire_at", async () => {
    if (!admin) return;
    const knownFireAt = new Date("2026-05-01T13:00:00Z");
    const armFireAt = async () => {
      await admin!.begin(async (tx) => {
        await tx`select set_config('app.actor_type', 'system', true)`;
        await tx`select set_config('app.org_id', ${TEST_ORG}, true)`;
        await tx`set local role app_user`;
        await tx`update task_templates set next_fire_at = ${knownFireAt} where id = ${templateId}`;
      });
    };

    // First sweep with this template due → it fires exactly once for this fire_at.
    // Assert on THIS template's fires (not the org-wide count) so other orgs'
    // templates are irrelevant and the test is deterministic under the full suite.
    await armFireAt();
    const before = (await listTemplateFires(templateId)).length;
    await runDueTemplates(new Date());
    const afterFirst = (await listTemplateFires(templateId)).length;
    expect(afterFirst).toBe(before + 1);

    // Re-arm the SAME fire_at and sweep again → dedupe on (template, fire_at)
    // means NO second fire for this template.
    await armFireAt();
    await runDueTemplates(new Date());
    const afterSecond = (await listTemplateFires(templateId)).length;
    expect(afterSecond).toBe(afterFirst);
  }, 30_000);
});
