/**
 * Read-only work-order inventory for an org (diagnostic).
 *
 * SELECT statements only — makes NO writes of any kind, so it needs no
 * production-write guard. It has no hard-coded org: you must pass one
 * explicitly, so it can never accidentally read a default/production org.
 *
 *   STACK_ORG_ID=org_xxx  npx tsx scripts/audit-workorders.ts
 *   npx tsx scripts/audit-workorders.ts --org org_xxx
 *
 * Reads DATABASE_URL(_UNPOOLED) from web/.env.local. Point it at whatever org
 * you name; nothing is printed except work-order metadata for that org.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__dir, "..", "web", ".env"), quiet: true });

function usage(msg: string): never {
  console.error(`${msg}\n\nUsage:\n  STACK_ORG_ID=org_xxx npx tsx scripts/audit-workorders.ts\n  npx tsx scripts/audit-workorders.ts --org org_xxx`);
  process.exit(1);
}

// Explicit org only — no default. CLI `--org <id>` wins over STACK_ORG_ID.
const argOrgIdx = process.argv.indexOf("--org");
const ORG =
  (argOrgIdx >= 0 ? process.argv[argOrgIdx + 1] : undefined) ??
  process.env.STACK_ORG_ID;
if (!ORG) usage("No org specified. Pass --org <id> or set STACK_ORG_ID.");

const DB_URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DB_URL) usage("DATABASE_URL(_UNPOOLED) is not set (expected in web/.env.local).");

const sql = postgres(DB_URL, { ssl: "require", max: 1 });

const TEST_RE = /\b(test|demo|sample|qa|placeholder|asdf|qwer|lorem|ipsum|xxx+|foo|bar|dummy|delete me|ignore)\b/i;
const trunc = (s: string | null, n = 90) =>
  !s ? "" : s.replace(/\s+/g, " ").trim().slice(0, n);

async function main() {
  console.log("ORG:", ORG);
  const [{ total }] = await sql`select count(*)::int as total from work_orders where org_id=${ORG}`;
  console.log("TOTAL work_orders:", total, "\n");

  const rows = await sql`
    select
      wo.id, wo.number, wo.title, wo.description, wo.status, wo.priority,
      wo.created_by_actor_type as actor, wo.category,
      wo.spawned_from_inspection_id as from_insp,
      wo.created_at,
      p.name  as property,
      u.label as unit,
      tu.name  as tenant_name,
      tu.email as tenant_email,
      (select v.name from assignments a join vendors v on v.id=a.assignee_id
        where a.org_id=${ORG} and a.target_type='work_order' and a.target_id=wo.id
          and a.assignee_type='vendor' and a.unassigned_at is null limit 1) as vendor_company,
      (select vu.name from assignments a join vendor_users vu on vu.id=a.assignee_id
        where a.org_id=${ORG} and a.target_type='work_order' and a.target_id=wo.id
          and a.assignee_type='vendor_user' and a.unassigned_at is null limit 1) as vendor_user,
      (select us.name from assignments a join users us on us.id=a.assignee_id
        where a.org_id=${ORG} and a.target_type='work_order' and a.target_id=wo.id
          and a.assignee_type='user' and a.unassigned_at is null limit 1) as staff,
      (select count(*)::int from comments c where c.org_id=${ORG} and c.target_type='work_order' and c.target_id=wo.id) as comments,
      (select count(*)::int from attachments at where at.org_id=${ORG} and at.target_type='work_order' and at.target_id=wo.id) as files,
      (select count(*)::int from audit_log al where al.org_id=${ORG} and al.target_type='work_order' and al.target_id=wo.id) as audit
    from work_orders wo
    left join properties p on p.id=wo.property_id
    left join units u on u.id=wo.unit_id
    left join tenant_users tu on tu.id=wo.created_by_tenant_user_id
    where wo.org_id=${ORG}
    order by wo.created_at desc`;

  const flagged = rows.filter((r) => TEST_RE.test(`${r.title} ${r.description ?? ""}`));
  const tenantOrigin = rows.filter((r) => r.actor === "tenant");

  console.log("=== TEXT-FLAGGED (title/desc matches test|demo|sample|qa|placeholder|…) ===");
  for (const r of flagged) {
    console.log(
      `WO-${r.number} [${r.status}] actor=${r.actor} | "${r.title}"` +
        ` | ${r.property ?? "—"} / ${r.unit ?? "—"}` +
        ` | req=${r.tenant_name ?? r.tenant_email ?? "(operator)"}` +
        ` | owner=${r.vendor_company ?? r.vendor_user ?? r.staff ?? "—"}` +
        ` | c${r.comments}/f${r.files}/aud${r.audit}` +
        ` | ${new Date(r.created_at).toISOString().slice(0, 16)}`,
    );
  }
  console.log(`(${flagged.length} text-flagged)`);

  console.log("\n=== TENANT/RESIDENT-ORIGIN work orders (createdByActorType='tenant') ===");
  for (const r of tenantOrigin) {
    console.log(
      `WO-${r.number} [${r.status}] | "${r.title}"` +
        ` | ${r.property ?? "—"} / ${r.unit ?? "—"}` +
        ` | req=${r.tenant_name ?? r.tenant_email ?? "?"}` +
        ` | owner=${r.vendor_company ?? r.vendor_user ?? r.staff ?? "—"}` +
        ` | c${r.comments}/f${r.files}/aud${r.audit}`,
    );
  }
  console.log(`(${tenantOrigin.length} tenant-origin)`);

  console.log("\n=== distinct properties (work-order locations) ===");
  const props = await sql`
    select p.name, count(*)::int as n from work_orders wo
    left join properties p on p.id=wo.property_id
    where wo.org_id=${ORG} group by p.name order by n desc`;
  for (const p of props) console.log(`  ${p.n}× ${p.name ?? "(none)"}`);

  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
