/**
 * Drawer status control — when an operator blocks a WO, the reason they pick
 * ("waiting on resident" etc.) must flow through setStatusAction to the row, so
 * the "Waiting on" field and the resident-facing label are meaningful instead of
 * defaulting to a generic "other" / "On hold". Auto-skips without DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ORG = `org_blk_${Date.now()}`;
const OP_CLERK = `local:opblk_${Date.now()}`;

vi.mock("@/lib/server/auth", () => ({
  auth: vi.fn(async () => ({ userId: OP_CLERK, orgId: ORG, email: "op@ops.test", name: "Op", role: "admin" })),
  isOperatorAllowed: vi.fn(async () => true),
}));
// revalidatePath needs a Next request context (absent in vitest) — no-op it.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import postgres from "postgres";
import { setStatusAction } from "@/app/(app)/_drawer/actions";
import { tenantStatusLabel } from "@/lib/labels";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const skip = !url;
let admin: postgres.Sql | null = null;
const ids = { woReason: 0, woDefault: 0, woReasonId: "", woDefaultId: "" };

async function sys(tx: postgres.Sql) {
  await tx`set local role app_user`;
  await tx`select set_config('app.actor_type', 'system', true)`;
  await tx`select set_config('app.org_id', ${ORG}, true)`;
}
async function blockedReasonOf(id: string) {
  const rows = await admin!.begin(async (tx) => {
    await sys(tx);
    return tx<{ r: string | null }[]>`select blocked_reason as r from work_orders where id=${id}`;
  });
  return rows[0]?.r ?? null;
}

beforeAll(async () => {
  if (skip || !url) return;
  admin = postgres(url, { max: 1 });
  await admin.begin(async (tx) => {
    await sys(tx);
    await tx`insert into users (org_id, clerk_user_id, email, name, role) values (${ORG}, ${OP_CLERK}, ${"op@ops.test"}, ${"Op"}, 'admin')`;
    const mk = async (num: number, title: string) => {
      const [w] = await tx<{ id: string }[]>`
        insert into work_orders (org_id, number, title, status, kind, priority, category, created_by_actor_type, started_at)
        values (${ORG}, ${num}, ${title}, 'in_progress', 'work_order', 'normal', 'plumbing', 'user', now()) returning id`;
      return w!.id;
    };
    ids.woReason = 9301; ids.woReasonId = await mk(ids.woReason, "Reason WO");
    ids.woDefault = 9302; ids.woDefaultId = await mk(ids.woDefault, "Default WO");
  });
});

afterAll(async () => {
  if (!admin) return;
  await admin.begin(async (tx) => {
    await sys(tx);
    for (const t of ["audit_log", "work_orders", "users"]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });
  await admin.end();
});

describe.skipIf(skip)("drawer blocked-reason", () => {
  it("forwards the operator's chosen reason to the row", async () => {
    const r = await setStatusAction({ ref: `WO-${ids.woReason}`, to: "blocked", blockedReason: "waiting_tenant" });
    expect(r.ok).toBe(true);
    expect(await blockedReasonOf(ids.woReasonId)).toBe("waiting_tenant");
    // …which is what makes the resident's text actionable, not generic.
    expect(tenantStatusLabel("blocked", "waiting_tenant")).toBe("Waiting on you");
  }, 30_000);

  it("falls back to 'other' when no reason is given (unchanged safety net)", async () => {
    const r = await setStatusAction({ ref: `WO-${ids.woDefault}`, to: "blocked" });
    expect(r.ok).toBe(true);
    expect(await blockedReasonOf(ids.woDefaultId)).toBe("other");
    expect(tenantStatusLabel("blocked", "other")).toBe("On hold");
  }, 30_000);
});
