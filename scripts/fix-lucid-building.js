/**
 * One-off: correct the Lucid/Sojo model per the owner —
 *   "Sojo is a building; Lucid is a tenant (company) inside it."
 * Actions (org-scoped, targeted):
 *   1. rename the real building 'Lucid Demo' → 'Sojo' (keeps its unit + WOs)
 *   2. create tenant company 'Lucid' (idempotent on the unique name)
 *   3. put the real Lucid residents (Sam, Ben, Janet) under the Lucid company
 *   4. delete the two EMPTY seed placeholders 'Sojo North' / 'Sojo South'
 *      (units first — units.property_id is RESTRICT). YONIQUE is kept.
 * Guarded: aborts if the placeholders aren't actually empty.
 *
 * Run:  node scripts/fix-lucid-building.js
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
const PLACEHOLDERS = ["Sojo North", "Sojo South"];
const LUCID_EMAILS = ["slumpkins@lucidchart.com", "bjames@lucidchart.com", "janet@lucid.co"];

(async () => {
  const sql = postgres(dburl, { max: 1 });

  // Guard: the placeholders must be empty (no tenants, no WOs) before deletion.
  const [busy] = await sql`
    select count(*)::int c from properties p
    where p.org_id=${ORG} and p.name = any(${PLACEHOLDERS})
      and (exists(select 1 from work_orders w where w.property_id=p.id)
        or exists(select 1 from tenant_users t join units u on u.id=t.unit_id where u.property_id=p.id))`;
  if (busy.c > 0) throw new Error("ABORT: a Sojo placeholder is not empty");

  await sql.begin(async (tx) => {
    // 1) rename the real building
    const r1 = await tx`update properties set name=${"Sojo"} where org_id=${ORG} and name=${"Lucid Demo"}`;
    console.log(`renamed 'Lucid Demo' → 'Sojo': ${r1.count} building`);

    // 2) tenant company 'Lucid' (idempotent)
    await tx`insert into tenant_companies (org_id, name) values (${ORG}, ${"Lucid"}) on conflict (org_id, name) do nothing`;
    const [lucid] = await tx`select id from tenant_companies where org_id=${ORG} and name=${"Lucid"}`;
    console.log(`tenant company 'Lucid': ${lucid.id}`);

    // 3) put the real residents under Lucid
    const r3 = await tx`update tenant_users set company_id=${lucid.id} where org_id=${ORG} and email = any(${LUCID_EMAILS})`;
    console.log(`assigned ${r3.count} residents to Lucid`);

    // 4) delete the empty placeholders (units first — RESTRICT FK)
    const ru = await tx`delete from units where org_id=${ORG} and property_id in (select id from properties where org_id=${ORG} and name = any(${PLACEHOLDERS}))`;
    const rp = await tx`delete from properties where org_id=${ORG} and name = any(${PLACEHOLDERS})`;
    console.log(`deleted placeholders: ${rp.count} buildings, ${ru.count} units`);
  });

  console.log("\n=== buildings now ===");
  for (const p of await sql`select name, coalesce(u.name,${"— none"}) tech from properties p left join users u on u.id=p.default_assignee_user_id where p.org_id=${ORG} order by name`)
    console.log(`  ${p.name} → ${p.tech}`);
  console.log("=== Lucid residents (company) ===");
  for (const t of await sql`select tu.name, tu.email, c.name company from tenant_users tu left join tenant_companies c on c.id=tu.company_id where tu.org_id=${ORG} order by tu.email`)
    console.log(`  ${t.name || t.email} — company: ${t.company || "—"}`);
  await sql.end();
})().catch((e) => { console.error("FAILED (rolled back):", String(e.message).slice(0, 160)); process.exit(1); });
