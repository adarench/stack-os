/**
 * One-off: deactivate seed/demo accounts in the Lucid prod org so the ops roster
 * and tenant list reflect only real people. Reversible (status flip, no deletes):
 *   • seed STAFF  (@stackdemo.test, @stack.local) → status 'deactivated'
 *   • seed TENANTS (@tenant.test)                 → status 'revoked'
 * Real accounts (@stackwithus.com, @lucidchart.com, @lucid.co) and the owner's
 * own adam.rencher12 accounts are never touched. Idempotent (only flips 'active').
 *
 * Run:  node scripts/deactivate-seed-accounts.js
 * Restore any account later via Admin › Team / Residents (the Activate toggle).
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

(async () => {
  const sql = postgres(dburl, { max: 1 });
  await sql.begin(async (tx) => {
    const staff = await tx`update users set status=${"deactivated"}
      where org_id=${ORG} and status=${"active"}
        and (email like ${"%@stackdemo.test"} or email like ${"%@stack.local"})
      returning email, name`;
    console.log(`Deactivated ${staff.length} seed staff:`);
    for (const s of staff) console.log(`  - ${s.name} (${s.email})`);

    const ten = await tx`update tenant_users set status=${"revoked"}
      where org_id=${ORG} and status=${"active"} and email like ${"%@tenant.test"}
      returning email, name`;
    console.log(`\nRevoked ${ten.length} seed tenants:`);
    for (const t of ten) console.log(`  - ${t.name} (${t.email})`);
  });

  console.log("\n=== ACTIVE ops roster now (gets broadcasts) ===");
  for (const u of await sql`select name,role,(phone is not null) as p from users where org_id=${ORG} and status=${"active"} and role in (${"staff"},${"dispatcher"},${"manager"},${"admin"}) order by role`)
    console.log(`  ${u.name} [${u.role}] ${u.p ? "✓ texts" : "email/in-app only"}`);
  console.log("=== ACTIVE tenants now ===");
  for (const t of await sql`select name,email,(phone is not null) as p from tenant_users where org_id=${ORG} and status=${"active"} order by email`)
    console.log(`  ${t.name || t.email} ${t.p ? "✓ texts" : "email/in-app only"}`);
  await sql.end();
})().catch((e) => { console.error("cleanup failed:", String(e.message).slice(0, 140)); process.exit(1); });
