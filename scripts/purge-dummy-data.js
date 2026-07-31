/**
 * One-off: purge all seed/demo/test data from the Lucid prod org, keeping only
 * the real Lucid records (per Jen's request). KEEP:
 *   • buildings: Lucid Demo, Sojo North, Sojo South, YONIQUE (+ their units)
 *   • tenants:   @lucidchart.com, @lucid.co, adam.rencher12@gmail.com
 *   • staff:     @stackwithus.com, adam.rencher12@gmail.com
 *   • work orders: the 9 real Lucid WOs (submitted by Sam Lumpkins) + their
 *     comments/photos/notifications/audit
 *   • org_settings (routing config)
 * Everything else — seed buildings/units/tenants, test-harness WOs, your test
 * WOs, all vendors/projects/inspections/invoices/insurance, and the recurring
 * templates/checklists — is deleted. Atomic (one transaction; any error → no
 * change). Hard-guarded: aborts unless the keep-set is exactly as expected.
 * A full backup was taken first (scratchpad/org-backup.json).
 *
 * Run:  node scripts/purge-dummy-data.js
 */
const fs = require("fs");
const path = require("path");
const WEB = path.join(__dirname, "..", "web");
const req = require("module").createRequire(path.join(WEB, "package.json"));
const postgres = req("postgres");
const dburl = fs
  .readFileSync(path.join(WEB, ".env.local"), "utf8")
  .match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");
const ORG = "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0";
const KEEP_PROP = ["Lucid Demo", "Sojo North", "Sojo South", "YONIQUE"];

(async () => {
  const sql = postgres(dburl, { max: 1 });

  // ---- compute keep-sets ----
  const ids = (rows) => rows.map((r) => r.id);
  const keepPropIds = ids(await sql`select id from properties where org_id=${ORG} and name=any(${KEEP_PROP})`);
  const keepUnitIds = ids(await sql`select id from units where org_id=${ORG} and property_id=any(${keepPropIds})`);
  const keepTenantIds = ids(await sql`select id from tenant_users where org_id=${ORG} and (email like ${"%@lucidchart.com"} or email like ${"%@lucid.co"} or email=${"adam.rencher12@gmail.com"})`);
  const keepUserIds = ids(await sql`select id from users where org_id=${ORG} and (email like ${"%@stackwithus.com"} or email=${"adam.rencher12@gmail.com"})`);
  const [sam] = await sql`select id from tenant_users where org_id=${ORG} and email=${"slumpkins@lucidchart.com"}`;
  const keepWoIds = ids(await sql`select id from work_orders where org_id=${ORG} and created_by_tenant_user_id=${sam.id}`);

  // ---- HARD GUARDS: refuse to run if the keep-set isn't exactly what we verified ----
  const guard = (name, got, want) => { if (got !== want) throw new Error(`GUARD: ${name} expected ${want}, got ${got} — ABORTING, nothing deleted`); };
  guard("keep properties", keepPropIds.length, 4);
  guard("keep tenants", keepTenantIds.length, 4);
  guard("keep staff", keepUserIds.length, 4);
  guard("keep WOs (Sam)", keepWoIds.length, 9);
  console.log(`keep-set OK: ${keepWoIds.length} WOs, ${keepPropIds.length} buildings, ${keepUnitIds.length} units, ${keepTenantIds.length} tenants, ${keepUserIds.length} staff\n`);

  const results = [];
  await sql.begin(async (tx) => {
    const del = async (label, q) => { const r = await q; results.push([label, r.count]); };

    // A) seed-only tables — delete every org row
    await del("inspection_findings", tx`delete from inspection_findings where org_id=${ORG}`);
    await del("inspection_items", tx`delete from inspection_items where org_id=${ORG}`);
    await del("inspections", tx`delete from inspections where org_id=${ORG}`);
    await del("task_template_fires", tx`delete from task_template_fires where org_id=${ORG}`);
    await del("task_templates", tx`delete from task_templates where org_id=${ORG}`);
    await del("checklist_template_items", tx`delete from checklist_template_items where org_id=${ORG}`);
    await del("checklist_templates", tx`delete from checklist_templates where org_id=${ORG}`);
    await del("vendor_cois", tx`delete from vendor_cois where org_id=${ORG}`);
    await del("vendor_users", tx`delete from vendor_users where org_id=${ORG}`);
    await del("vendors", tx`delete from vendors where org_id=${ORG}`);
    await del("projects", tx`delete from projects where org_id=${ORG}`);
    await del("invoices", tx`delete from invoices where org_id=${ORG}`);
    await del("task_scopes", tx`delete from task_scopes where org_id=${ORG}`);

    // B) WO-child tables — keep only rows tied to a kept WO
    await del("task_costs", tx`delete from task_costs where org_id=${ORG} and coalesce(work_order_id = any(${keepWoIds}), false) = false`);
    await del("tenant_insurance_policies", tx`delete from tenant_insurance_policies where org_id=${ORG} and coalesce(tenant_user_id = any(${keepTenantIds}), false) = false`);
    await del("approvals", tx`delete from approvals where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);
    await del("follow_ups", tx`delete from follow_ups where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);
    await del("assignments", tx`delete from assignments where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);
    await del("comments", tx`delete from comments where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);
    await del("attachments", tx`delete from attachments where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);
    await del("notifications", tx`delete from notifications where org_id=${ORG} and coalesce(target_id = any(${keepWoIds}), false) = false`);
    await del("audit_log", tx`delete from audit_log where org_id=${ORG} and coalesce(target_type='work_order' and target_id = any(${keepWoIds}), false) = false`);

    // C) parents — child-first for the RESTRICT FKs (WOs → units → properties)
    await del("work_orders", tx`delete from work_orders where org_id=${ORG} and coalesce(id = any(${keepWoIds}), false) = false`);
    await del("push_subscriptions", tx`delete from push_subscriptions where org_id=${ORG} and coalesce(user_id = any(${keepUserIds}), false) = false`);
    await del("auth_events", tx`delete from auth_events where org_id=${ORG} and coalesce(subject_user_id = any(${keepUserIds}), false) = false and coalesce(subject_tenant_user_id = any(${keepTenantIds}), false) = false`);
    await del("tenant_users", tx`delete from tenant_users where org_id=${ORG} and coalesce(id = any(${keepTenantIds}), false) = false`);
    await del("units", tx`delete from units where org_id=${ORG} and coalesce(id = any(${keepUnitIds}), false) = false`);
    await del("properties", tx`delete from properties where org_id=${ORG} and coalesce(id = any(${keepPropIds}), false) = false`);
    await del("users", tx`delete from users where org_id=${ORG} and coalesce(id = any(${keepUserIds}), false) = false`);
  });

  console.log("Deleted (rows):");
  for (const [t, n] of results) if (n > 0) console.log(`  ${t}: ${n}`);

  // ---- post-purge verification ----
  const c = async (t) => (await sql`select count(*)::int n from ${sql(t)} where org_id=${ORG}`)[0].n;
  console.log("\nRemaining in org:");
  for (const t of ["properties", "units", "tenant_users", "users", "work_orders", "vendors", "projects", "inspections", "notifications", "comments", "attachments"])
    console.log(`  ${t}: ${await c(t)}`);
  await sql.end();
})().catch((e) => { console.error("PURGE FAILED (transaction rolled back):", String(e.message).slice(0, 160)); process.exit(1); });
