/**
 * Seed ONE realistic, fully-wired unit-scoped TURN into the demo org so the
 * turn workflow can be walked end-to-end. Idempotent: re-running deletes the
 * prior turn (keyed on the project name + the chosen unit) and rebuilds it.
 *
 *   NODE_PATH=web/node_modules node scripts/seed-turn.mjs
 *
 * The turn at 312 Oak Street #3:
 *   - tenant moved out 6 days ago (unit vacant)
 *   - move-out inspection COMPLETED with findings that spawned make-ready WOs
 *   - make-ready WOs: paint, floors, dishwasher, clean, re-key, punch list
 *   - a VENDOR DELAY: hardwood refinish is blocked + overdue (GC rescheduled)
 *   - an APPROVAL BOTTLENECK: dishwasher replacement blocked on a pending
 *     over-threshold estimate
 *   - a FUTURE MOVE-IN: move-in inspection scheduled, target_completion set
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "/Users/arench/Desktop/STACK_OS/web/.env.local", quiet: true });
const URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const sql = postgres(URL, { ssl: "require", max: 1 });

const ORG = process.env.SEED_ORG_ID ?? "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0";
const PROPERTY_NAME = "312 Oak Street";
const UNIT_LABEL = "3";
const PROJECT_NAME = "312 Oak Street #3 turn";
const INS_SENTINEL = "[turn]"; // hidden marker in inspection notes for idempotent cleanup

const NOW = new Date();
const days = (n) => new Date(NOW.getTime() + n * 86_400_000);
const hours = (n) => new Date(NOW.getTime() + n * 3_600_000);
const mins = (n) => new Date(NOW.getTime() + n * 60_000);

async function main() {
  console.log(`[seed-turn] org = ${ORG}`);

  // ---- resolve unit, property, principal user, vendors ----
  const [unit] = await sql`
    select u.id, u.property_id, p.name as property
    from units u join properties p on p.id = u.property_id
    where u.org_id = ${ORG} and p.name = ${PROPERTY_NAME} and u.label = ${UNIT_LABEL}
    limit 1`;
  if (!unit) throw new Error(`unit ${PROPERTY_NAME} #${UNIT_LABEL} not found in ${ORG}`);
  const unitId = unit.id;
  const propertyId = unit.property_id;

  const [principal] = await sql`select id, name from users where org_id = ${ORG} order by created_at asc limit 1`;
  if (!principal) throw new Error("no staff user in org");
  const actor = principal.id;

  const vendorRows = await sql`select id, name from vendors where org_id = ${ORG}`;
  const vendorByHint = (hint) =>
    vendorRows.find((v) => v.name.toLowerCase().includes(hint))?.id ?? null;
  const vGold = vendorByHint("gold");     // paint
  const vGc = vendorByHint("north");      // general contractor
  const vClean = vendorByHint("sparkle"); // cleaning
  const vLock = vendorByHint("quick");    // locksmith

  // ---- idempotent cleanup of any prior turn on this unit ----
  console.log("[seed-turn] cleaning any prior turn...");
  // inspection findings first (they FK to WOs via spawned_work_order_id)
  await sql`delete from inspection_findings where org_id = ${ORG}
    and inspection_id in (select id from inspections where org_id = ${ORG} and unit_id = ${unitId} and notes like ${"%" + INS_SENTINEL + "%"})`;
  const [prior] = await sql`select id from projects where org_id = ${ORG} and name = ${PROJECT_NAME} and kind = 'unit_turn' limit 1`;
  if (prior) {
    const woFilter = sql`select id from work_orders where org_id = ${ORG} and project_id = ${prior.id}`;
    await sql`delete from approvals  where org_id = ${ORG} and target_type = 'work_order' and target_id in (${woFilter})`;
    await sql`delete from assignments where org_id = ${ORG} and target_type = 'work_order' and target_id in (${woFilter})`;
    await sql`delete from audit_log   where org_id = ${ORG} and target_type = 'work_order' and target_id in (${woFilter})`;
    await sql`delete from comments    where org_id = ${ORG} and target_type = 'work_order' and target_id in (${woFilter})`;
    await sql`delete from task_costs  where org_id = ${ORG} and work_order_id in (${woFilter})`;
    await sql`delete from work_orders where org_id = ${ORG} and project_id = ${prior.id}`;
    await sql`delete from audit_log   where org_id = ${ORG} and target_type = 'project' and target_id = ${prior.id}`;
    await sql`delete from comments    where org_id = ${ORG} and target_type = 'project' and target_id = ${prior.id}`;
    await sql`delete from projects    where id = ${prior.id}`;
  }
  await sql`delete from audit_log where org_id = ${ORG} and target_type = 'inspection'
    and target_id in (select id from inspections where org_id = ${ORG} and unit_id = ${unitId} and notes like ${"%" + INS_SENTINEL + "%"})`;
  await sql`delete from comments where org_id = ${ORG} and target_type = 'inspection'
    and target_id in (select id from inspections where org_id = ${ORG} and unit_id = ${unitId} and notes like ${"%" + INS_SENTINEL + "%"})`;
  await sql`delete from inspections where org_id = ${ORG} and unit_id = ${unitId} and notes like ${"%" + INS_SENTINEL + "%"}`;

  // ---- the turn project ----
  console.log("[seed-turn] inserting turn project...");
  const moveInDate = days(9); // future move-in
  const [prj] = await sql`
    insert into projects (org_id, name, description, kind, status, property_id, unit_id, budget_cents, target_completion, created_by_user_id, created_at, updated_at)
    values (${ORG}, ${PROJECT_NAME}, ${"Standard turn. Tenant moved out 6 days ago; new lease starts in 9 days. Floors + dishwasher at risk."}, 'unit_turn', 'active', ${propertyId}, ${unitId}, '450000', ${moveInDate}, ${actor}, ${days(-6)}, ${mins(-40)})
    returning id`;
  const prjId = prj.id;

  // ---- move-out inspection (completed) + findings ----
  console.log("[seed-turn] inserting move-out inspection + findings...");
  const [moRow] = await sql`
    insert into inspections (org_id, kind, status, property_id, unit_id, inspector_user_id, scheduled_for, started_at, completed_at, notes, created_at, updated_at)
    values (${ORG}, 'move_out', 'completed', ${propertyId}, ${unitId}, ${actor}, ${days(-5)}, ${days(-5)}, ${days(-5)}, ${"Move-out walk-through — turn 312 Oak #3 " + INS_SENTINEL}, ${days(-6)}, ${days(-5)})
    returning id`;
  const moveOutIns = moRow.id;
  const findings = [
    { area: "living_room", description: "Hardwood water-stained + warped under window — needs refinish.", severity: "actionable", pass: false },
    { area: "kitchen", description: "Dishwasher rusted, not draining — beyond repair, replace.", severity: "actionable", pass: false },
    { area: "whole_unit", description: "General wear; full repaint required before move-in.", severity: "actionable", pass: false },
    { area: "bathroom", description: "Caulk + grout acceptable.", severity: "observation", pass: true },
  ];
  const findingIds = [];
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const [row] = await sql`
      insert into inspection_findings (org_id, inspection_id, area, description, severity, pass, ordering)
      values (${ORG}, ${moveOutIns}, ${f.area}, ${f.description}, ${f.severity}, ${f.pass}, ${String(i)})
      returning id`;
    findingIds.push(row.id);
  }
  await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
    values (${ORG}, 'inspection', ${moveOutIns}, 'status_changed', 'user', ${actor}, ${sql.json({ from: "in_progress", to: "completed" })}, ${days(-5)}, ${days(-5)})`;

  // ---- make-ready work orders ----
  console.log("[seed-turn] inserting make-ready work orders...");
  const [{ m: maxNum }] = await sql`select coalesce(max(number), 1050) m from work_orders where org_id = ${ORG}`;
  let n = Number(maxNum) + 1;

  // WO factory
  async function wo({ title, description, status, priority, dueAt, vendorId, fromFinding, createdAt, updatedAt }) {
    const number = n++;
    const startedAt = ["in_progress"].includes(status) ? hours(-20) : null;
    const [row] = await sql`
      insert into work_orders (org_id, number, title, description, kind, status, priority, property_id, unit_id, project_id, spawned_from_inspection_id, spawned_from_finding_id, due_at, started_at, created_at, updated_at, created_by_user_id)
      values (${ORG}, ${number}, ${title}, ${description}, 'unit_turn_item', ${status}, ${priority}, ${propertyId}, ${unitId}, ${prjId},
        ${fromFinding != null ? moveOutIns : null}, ${fromFinding != null ? findingIds[fromFinding] : null},
        ${dueAt}, ${startedAt}, ${createdAt}, ${updatedAt}, ${actor})
      returning id`;
    // created + status audit
    await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG}, 'work_order', ${row.id}, 'created', 'user', ${actor}, ${sql.json({ to: { status: "new", title } })}, ${createdAt}, ${createdAt})`;
    if (status !== "new") {
      await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG}, 'work_order', ${row.id}, 'status_changed', 'user', ${actor}, ${sql.json({ from: "new", to: status })}, ${updatedAt}, ${updatedAt})`;
    }
    if (vendorId) {
      await sql`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id, assigned_by_user_id, assigned_at)
        values (${ORG}, 'work_order', ${row.id}, 'vendor', ${vendorId}, ${actor}, ${updatedAt})`;
      await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG}, 'work_order', ${row.id}, 'assigned', 'user', ${actor}, ${sql.json({ vendor_id: vendorId })}, ${updatedAt}, ${updatedAt})`;
    }
    return row.id;
  }

  const woPaint = await wo({ title: "Full interior repaint — 312 Oak #3", description: "Two-coat, all rooms + trim. Goldcoat scheduled.", status: "scheduled", priority: "normal", dueAt: days(3), vendorId: vGold, fromFinding: 2, createdAt: days(-5), updatedAt: hours(-30) });
  const woFloor = await wo({ title: "Refinish hardwood — living room water damage", description: "Sand + refinish warped boards under window. On critical path for move-in.", status: "blocked", priority: "high", dueAt: days(-1), vendorId: vGc, fromFinding: 0, createdAt: days(-5), updatedAt: hours(-6) });
  const woDish = await wo({ title: "Replace dishwasher — beyond repair", description: "Old unit rusted/not draining. Estimate $720 — over threshold, awaiting sign-off.", status: "blocked", priority: "normal", dueAt: days(2), vendorId: null, fromFinding: 1, createdAt: days(-5), updatedAt: hours(-26) });
  const woClean = await wo({ title: "Deep clean — full unit", description: "Post-make-ready turn clean. SparkleClean.", status: "scheduled", priority: "normal", dueAt: days(6), vendorId: vClean, fromFinding: null, createdAt: days(-4), updatedAt: hours(-48) });
  const woKey = await wo({ title: "Re-key all locks + mailbox", description: "New tenant security. Quicklock.", status: "scheduled", priority: "normal", dueAt: days(7), vendorId: vLock, fromFinding: null, createdAt: days(-4), updatedAt: hours(-50) });
  const woPunch = await wo({ title: "Punch list — touch-ups before move-in", description: "Nail holes, switch plates, final walk items.", status: "new", priority: "low", dueAt: days(8), vendorId: null, fromFinding: null, createdAt: days(-3), updatedAt: hours(-30) });

  // link the two spawned findings back to their WOs (mirrors completeInspection)
  await sql`update inspection_findings set spawned_work_order_id = ${woFloor} where id = ${findingIds[0]}`;
  await sql`update inspection_findings set spawned_work_order_id = ${woDish} where id = ${findingIds[1]}`;
  await sql`update inspection_findings set spawned_work_order_id = ${woPaint} where id = ${findingIds[2]}`;

  // ---- estimate cost + approval bottleneck on the dishwasher ----
  console.log("[seed-turn] inserting approval bottleneck...");
  await sql`insert into task_costs (org_id, work_order_id, kind, description, amount_cents, created_at)
    values (${ORG}, ${woDish}, 'materials', 'Dishwasher + install estimate', '72000', ${hours(-27)})`;
  await sql`insert into approvals (org_id, target_type, target_id, reason, amount_cents, status, requested_by_user_id, notes, created_at, updated_at)
    values (${ORG}, 'work_order', ${woDish}, 'estimate_over_threshold', '72000', 'pending', ${actor}, ${"Dishwasher replacement $720 — over $500 threshold. Blocks the turn until approved."}, ${hours(-26)}, ${hours(-26)})`;

  // ---- comments that tell the story (vendor delay + bottleneck) ----
  console.log("[seed-turn] inserting comments...");
  const comment = (woId, body, actorType, visibility, at) =>
    sql`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility, created_at, updated_at)
        values (${ORG}, 'work_order', ${woId}, ${body}, ${actorType}, ${actorType === "user" ? actor : null}, ${visibility}, ${at}, ${at})`;
  await comment(woFloor, "Northstar pushed to next week — their sander tech is out. This is now the long pole on the move-in.", "user", "internal", hours(-6));
  await comment(woFloor, "Can't start until the floor's done — paint has to follow refinish. Holding.", "vendor", "external", hours(-5));
  await comment(woDish, "Need sign-off on the $720 dishwasher before I can order. Sitting since yesterday.", "user", "internal", hours(-26));

  // ---- move-in inspection scheduled on the future move-in date ----
  console.log("[seed-turn] inserting future move-in inspection...");
  await sql`insert into inspections (org_id, kind, status, property_id, unit_id, inspector_user_id, scheduled_for, notes, created_at, updated_at)
    values (${ORG}, 'move_in', 'scheduled', ${propertyId}, ${unitId}, ${actor}, ${moveInDate}, ${"Move-in readiness walk — turn 312 Oak #3 " + INS_SENTINEL}, ${days(-2)}, ${days(-2)})`;

  console.log(`[seed-turn] done. Turn project ${prjId} on ${PROPERTY_NAME} #${UNIT_LABEL}`);
  console.log(`[seed-turn] move-in target: ${moveInDate.toISOString().slice(0, 10)} · WOs ${maxNum + 1}–${n - 1}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
