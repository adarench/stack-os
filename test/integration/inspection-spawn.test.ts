/**
 * P4 inspection lifecycle integration test.
 *
 * Mocks Clerk auth, drives createInspection → addFinding (multiple) →
 * completeInspection (atomically spawns WOs) against real Neon.
 *
 * Auto-skipped without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_ORG = `org_test_p4_${Date.now()}`;
const TEST_CLERK_USER_ID = `user_test_p4_${Date.now()}`;

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
    primaryEmailAddress: { emailAddress: "p4-test@stack-os.example" },
    emailAddresses: [{ emailAddress: "p4-test@stack-os.example" }],
    firstName: "P4",
    lastName: "Test",
  })),
}));

import postgres from "postgres";
import { createProperty, createUnit } from "@/lib/server/properties";
import {
  createInspection,
  addFinding,
  completeInspection,
  reviewInspection,
  getInspection,
  listFindings,
  listSpawnedWorkOrders,
} from "@/lib/server/inspections";
import { createProject, listProjectWorkOrders, attachWorkOrderToProject, updateProjectStatus, getProject } from "@/lib/server/projects";

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
    await tx`delete from inspection_findings where org_id = ${TEST_ORG}`;
    await tx`delete from inspections where org_id = ${TEST_ORG}`;
    await tx`delete from work_orders where org_id = ${TEST_ORG}`;
    await tx`delete from projects where org_id = ${TEST_ORG}`;
    await tx`delete from units where org_id = ${TEST_ORG}`;
    await tx`delete from properties where org_id = ${TEST_ORG}`;
    await tx`delete from users where org_id = ${TEST_ORG}`;
  });
  await admin.end();
});

describe.skipIf(skip)("P4 inspection lifecycle", () => {
  let propertyId: string;
  let unitId: string;

  beforeAll(async () => {
    if (skip) return;
    const p = await createProperty({ name: "P4 Insp Property", city: "Boise", state: "ID" });
    propertyId = p.id;
    const u = await createUnit({ propertyId, label: "P4-Unit-1" });
    unitId = u.id;
  });

  it("creates an inspection in 'scheduled'", async () => {
    const ins = await createInspection({
      kind: "move_out",
      propertyId,
      unitId,
      notes: "First test inspection",
    });
    expect(ins.status).toBe("scheduled");
    expect(ins.kind).toBe("move_out");
  });

  it(
    "addFinding transitions scheduled → in_progress on first finding",
    async () => {
      const ins = await createInspection({ kind: "annual", propertyId, unitId });
      expect(ins.status).toBe("scheduled");
      await addFinding({
        inspectionId: ins.id,
        area: "kitchen",
        description: "Faucet drips",
        severity: "actionable",
        pass: false,
      });
      const fresh = await getInspection(ins.id);
      expect(fresh?.status).toBe("in_progress");
      expect(fresh?.startedAt).toBeTruthy();
    },
    20_000,
  );

  it(
    "completeInspection atomically spawns one WO per actionable+failed finding",
    async () => {
      const ins = await createInspection({ kind: "ad_hoc", propertyId, unitId });
      // 5 findings: 2 critical fail, 1 actionable fail, 1 observation fail, 1 info pass
      await addFinding({
        inspectionId: ins.id,
        area: "kitchen",
        description: "Cabinet damage",
        severity: "critical",
        pass: false,
      });
      await addFinding({
        inspectionId: ins.id,
        area: "bath",
        description: "Tile cracked",
        severity: "critical",
        pass: false,
      });
      await addFinding({
        inspectionId: ins.id,
        area: "exterior",
        description: "Loose railing",
        severity: "actionable",
        pass: false,
      });
      await addFinding({
        inspectionId: ins.id,
        description: "Light bulb burned out",
        severity: "observation",
        pass: false,
      });
      await addFinding({
        inspectionId: ins.id,
        description: "Carpet looks new",
        severity: "info",
        pass: true,
      });

      const r = await completeInspection(ins.id);
      // 2 critical + 1 actionable = 3 spawned
      expect(r.spawnedWorkOrderIds.length).toBe(3);

      const spawned = await listSpawnedWorkOrders(ins.id);
      expect(spawned.length).toBe(3);
      // Critical → urgent priority
      const urgents = spawned.filter((w) => w.priority === "urgent");
      expect(urgents.length).toBe(2);

      const fresh = await getInspection(ins.id);
      expect(fresh?.status).toBe("completed");
      expect(fresh?.completedAt).toBeTruthy();

      // Findings have spawnedWorkOrderId set
      const findings = await listFindings(ins.id);
      const spawnableSet = findings.filter(
        (f) => !f.pass && (f.severity === "critical" || f.severity === "actionable"),
      );
      for (const f of spawnableSet) {
        expect(f.spawnedWorkOrderId).toBeTruthy();
      }
    },
    30_000,
  );

  it(
    "completeInspection is idempotent — re-completing a completed inspection doesn't double-spawn",
    async () => {
      const ins = await createInspection({ kind: "ad_hoc", propertyId, unitId });
      await addFinding({
        inspectionId: ins.id,
        description: "Single finding",
        severity: "actionable",
        pass: false,
      });
      const r1 = await completeInspection(ins.id);
      expect(r1.spawnedWorkOrderIds.length).toBe(1);
      const r2 = await completeInspection(ins.id);
      // Returns the same set; doesn't spawn again
      expect(r2.spawnedWorkOrderIds.length).toBe(1);
      const spawned = await listSpawnedWorkOrders(ins.id);
      expect(spawned.length).toBe(1);
    },
    30_000,
  );

  it("rejects adding findings to a completed inspection", async () => {
    const ins = await createInspection({ kind: "ad_hoc", propertyId, unitId });
    await addFinding({
      inspectionId: ins.id,
      description: "x",
      severity: "info",
      pass: true,
    });
    await completeInspection(ins.id);
    await expect(
      addFinding({
        inspectionId: ins.id,
        description: "late",
        severity: "info",
        pass: true,
      }),
    ).rejects.toThrow(/inspection_locked/);
  }, 30_000);

  it("review transitions completed → reviewed", async () => {
    const ins = await createInspection({ kind: "ad_hoc", propertyId, unitId });
    await addFinding({
      inspectionId: ins.id,
      description: "x",
      severity: "info",
      pass: true,
    });
    await completeInspection(ins.id);
    await reviewInspection(ins.id);
    const fresh = await getInspection(ins.id);
    expect(fresh?.status).toBe("reviewed");
    expect(fresh?.reviewedAt).toBeTruthy();
  }, 30_000);
});

describe.skipIf(skip)("P4 projects", () => {
  let propertyId: string;

  beforeAll(async () => {
    if (skip) return;
    const p = await createProperty({ name: "P4 Project Property", city: "Boise", state: "ID" });
    propertyId = p.id;
  });

  it("creates a project in 'planning'", async () => {
    const p = await createProject({
      name: "Cedar Ridge unit turn",
      kind: "unit_turn",
      propertyId,
    });
    expect(p.status).toBe("planning");
    expect(p.kind).toBe("unit_turn");
  });

  it("walks status transitions: planning → active → punch_list → closing → closed", async () => {
    const p = await createProject({ name: "Lifecycle test", propertyId });
    const path = ["active", "punch_list", "closing", "closed"] as const;
    for (const to of path) {
      const updated = await updateProjectStatus(p.id, to);
      expect(updated.status).toBe(to);
    }
    const closed = await getProject(p.id);
    expect(closed?.closedAt).toBeTruthy();
  }, 20_000);

  it("rejects invalid transitions", async () => {
    const p = await createProject({ name: "Invalid trans", propertyId });
    await expect(updateProjectStatus(p.id, "closed")).rejects.toThrow(/invalid_transition/);
  });

  it("attachWorkOrderToProject wires a WO to a project", async () => {
    const p = await createProject({ name: "Attach test", propertyId });
    // Create a WO via inspection so we have one to attach
    const ins = await createInspection({ kind: "ad_hoc", propertyId });
    await addFinding({
      inspectionId: ins.id,
      description: "to attach",
      severity: "actionable",
      pass: false,
    });
    const r = await completeInspection(ins.id);
    const woId = r.spawnedWorkOrderIds[0]!;
    await attachWorkOrderToProject({ workOrderId: woId, projectId: p.id });
    const wos = await listProjectWorkOrders(p.id);
    expect(wos.length).toBe(1);
    expect(wos[0]!.id).toBe(woId);
  }, 30_000);
});
