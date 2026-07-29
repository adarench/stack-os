/**
 * Idempotent user provisioning from a CSV roster.
 *
 *   pnpm --filter web exec tsx ../scripts/import-users.ts path/to/roster.csv
 *   (template: docs/lucid-rollout/user-import-template.csv)
 *
 * CSV columns: name,email,username,role,property,unit,coverage,active
 *   role: admin | manager | dispatcher | staff | technician | tenant
 *   property/unit: for tenants — the building + unit label they belong to
 *   coverage: for technicians — ";"-separated property names they cover
 *   active: true | false
 *
 * SAFE TO RE-RUN. It never resets an existing password or overwrites an existing
 * role→password: a temporary password is generated ONLY for a brand-new account
 * or one with no password yet. Reconciles by lower(email) (canonical identity).
 * Real passwords are never hard-coded — generated temp passwords are printed once
 * for you to hand over (users should reset via /forgot).
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(here, "..", "web", ".env"), quiet: true });

const STAFF_ROLES = new Set(["admin", "manager", "dispatcher", "staff", "technician"]);

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0]!.split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(","); // template has no quoted commas
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

const tempPassword = () => `Stack-${randomBytes(4).toString("hex")}`; // 14 chars

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const csvPath = process.argv[2] ?? resolve(here, "..", "docs", "lucid-rollout", "user-import-template.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const sql = postgres(url, { max: 1 });

  // Resolve the target org (single-org deployment).
  const orgId =
    process.env.STACK_ORG_ID && process.env.STACK_ORG_ID.length > 0
      ? process.env.STACK_ORG_ID
      : (await sql<{ org_id: string }[]>`select org_id from users group by org_id order by count(*) desc limit 1`)[0]?.org_id;
  if (!orgId) throw new Error("could not resolve org");

  const created: { email: string; role: string; password: string }[] = [];
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const email = (r.email ?? "").trim();
    const role = (r.role ?? "").trim().toLowerCase();
    const active = (r.active ?? "true").toLowerCase() !== "false";
    if (!email || !role) { skipped++; continue; }

    if (STAFF_ROLES.has(role)) {
      const [existing] = await sql<{ id: string; hp: boolean }[]>`
        select id, password_hash is not null hp from users where org_id=${orgId} and lower(email)=${email.toLowerCase()}`;
      if (existing) {
        await sql`update users set name=${r.name || null}, username=${r.username || null}, role=${role},
          status=${active ? "active" : "deactivated"} where id=${existing.id}`;
        if (!existing.hp) {
          const pw = tempPassword();
          await sql`update users set password_hash=${await bcrypt.hash(pw, 12)}, must_change_password=true, email_verified_at=now() where id=${existing.id}`;
          created.push({ email, role, password: pw });
        } else updated++;
      } else {
        const pw = tempPassword();
        await sql`insert into users (org_id, clerk_user_id, email, name, username, role, password_hash, status, must_change_password, email_verified_at)
          values (${orgId}, ${"local:" + randomBytes(8).toString("hex")}, ${email}, ${r.name || null}, ${r.username || null}, ${role}, ${await bcrypt.hash(pw, 12)}, ${active ? "active" : "deactivated"}, true, now())`;
        created.push({ email, role, password: pw });
      }
      // Technician coverage → covering tech on the named properties.
      if (role === "technician" && r.coverage) {
        const [u] = await sql<{ id: string }[]>`select id from users where org_id=${orgId} and lower(email)=${email.toLowerCase()}`;
        for (const propName of r.coverage.split(";").map((s) => s.trim()).filter(Boolean)) {
          await sql`update properties set default_assignee_user_id=${u!.id} where org_id=${orgId} and name=${propName}`;
        }
      }
    } else if (role === "tenant") {
      let unitId: string | null = null;
      if (r.unit) {
        const [unit] = await sql<{ id: string }[]>`
          select u.id from units u left join properties p on p.id=u.property_id
          where u.org_id=${orgId} and u.label=${r.unit} ${r.property ? sql`and p.name=${r.property}` : sql``} limit 1`;
        unitId = unit?.id ?? null;
      }
      const [existing] = await sql<{ id: string; hp: boolean }[]>`
        select id, password_hash is not null hp from tenant_users where org_id=${orgId} and lower(email)=${email.toLowerCase()} limit 1`;
      if (existing) {
        await sql`update tenant_users set name=${r.name || null}, ${unitId ? sql`unit_id=${unitId},` : sql``}
          status=${active ? "active" : "revoked"} where id=${existing.id}`;
        if (!existing.hp) {
          const pw = tempPassword();
          await sql`update tenant_users set password_hash=${await bcrypt.hash(pw, 12)}, must_change_password=true, email_verified_at=now() where id=${existing.id}`;
          created.push({ email, role, password: pw });
        } else updated++;
      } else {
        const pw = tempPassword();
        await sql`insert into tenant_users (org_id, unit_id, email, name, status, password_hash, must_change_password, email_verified_at)
          values (${orgId}, ${unitId}, ${email}, ${r.name || null}, ${active ? "active" : "revoked"}, ${await bcrypt.hash(pw, 12)}, true, now())`;
        created.push({ email, role, password: pw });
      }
    } else {
      skipped++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nimport-users: ${created.length} provisioned (new passwords), ${updated} updated, ${skipped} skipped\n`);
  if (created.length) {
    // eslint-disable-next-line no-console
    console.log("=== NEW / RESET-NEEDED ACCOUNTS — share these once ===");
    for (const c of created) console.log(`  ${c.role.padEnd(11)} ${c.email.padEnd(34)} ${c.password}`);
    console.log("\n(Existing accounts with a password were left untouched — safe to re-run.)");
  }
  await sql.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
