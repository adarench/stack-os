/**
 * Seed a realistic Trello/email/text follow-up layer into follow_ups so the
 * Daily Operating Command's "Follow-up needed" lane feels real. Idempotent:
 * re-running deletes the prior seed (external_id LIKE 'seed-fu-%') and rebuilds.
 *
 *   NODE_PATH=web/node_modules node scripts/seed-followups.mjs
 *
 * This SIMULATES the messy Trello/email/text layer — not a real Trello import.
 * source_channel + source_url + external_id mirror what a real import would set.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: "/Users/arench/Desktop/STACK_OS/web/.env.local", quiet: true });
const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
});
const ORG = process.env.SEED_ORG_ID ?? "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0";
const NOW = new Date();
const days = (n) => new Date(NOW.getTime() + n * 86_400_000);

async function main() {
  console.log(`[seed-followups] org = ${ORG}`);

  const [principal] = await sql`select id from users where org_id = ${ORG} order by created_at asc limit 1`;
  const me = principal?.id ?? null;

  // Best-effort entity resolution — link a follow-up to a real WO/unit/vendor
  // when we can; leave target null otherwise. Never fail on a miss.
  const woId = async (n) =>
    (await sql`select id from work_orders where org_id = ${ORG} and number = ${n} limit 1`)[0]?.id ?? null;
  const greenleaf =
    (await sql`select id from vendors where org_id = ${ORG} and name ilike '%green%' limit 1`)[0]?.id ?? null;
  const oak3 =
    (await sql`select u.id from units u join properties p on p.id = u.property_id
               where u.org_id = ${ORG} and p.name = '312 Oak Street' and u.label = '3' limit 1`)[0]?.id ?? null;

  const [woFloor, woDish, woDeadbolt] = await Promise.all([woId(1050), woId(1051), woId(1003)]);

  // Idempotent cleanup of the prior seed.
  await sql`delete from follow_ups where org_id = ${ORG} and external_id like 'seed-fu-%'`;

  const cards = [
    { ext: "001", channel: "trello", title: "Follow up with Northstar on flooring", next: "Text Northstar for ETA", tType: woFloor ? "work_order" : null, tId: woFloor, due: days(0), touched: days(-1), owner: me },
    { ext: "002", channel: "text", title: "Confirm tenant access for Oak #3", next: "Ask tenant for access window", tType: oak3 ? "unit" : null, tId: oak3, due: days(0), touched: days(-2), owner: null },
    { ext: "003", channel: "trello", title: "Get updated COI from Greenleaf", next: "Email Greenleaf for renewed COI", tType: greenleaf ? "vendor" : null, tId: greenleaf, due: days(-1), touched: days(-4), owner: me },
    { ext: "004", channel: "email", title: "Ask Jen to approve dishwasher replacement", next: "Forward estimate to Jen", tType: woDish ? "work_order" : null, tId: woDish, due: days(0), touched: days(-1), owner: me },
    { ext: "005", channel: "email", title: "Send owner update on Maple 2A leak", next: "Draft + send owner update", tType: null, tId: null, due: days(1), touched: days(-3), owner: me },
    { ext: "006", channel: "trello", title: "Confirm Quicklock completed deadbolt", next: "Confirm vendor completed work", tType: woDeadbolt ? "work_order" : null, tId: woDeadbolt, due: null, touched: days(-5), owner: null },
    { ext: "007", channel: "trello", title: "Check if inspection photos were uploaded", next: "Verify move-out inspection photos", tType: null, tId: null, due: days(2), touched: days(-6), owner: null },
  ];

  for (const c of cards) {
    await sql`
      insert into follow_ups (
        org_id, target_type, target_id, title, source_channel, source_url, external_id,
        owner_user_id, follow_up_at, status, next_action, last_touched_at, created_at, updated_at
      ) values (
        ${ORG}, ${c.tType}, ${c.tId}, ${c.title}, ${c.channel},
        ${c.channel === "trello" ? `https://trello.com/c/seed-fu-${c.ext}` : null},
        ${`seed-fu-${c.ext}`}, ${c.owner}, ${c.due}, 'open', ${c.next}, ${c.touched},
        ${c.touched}, ${c.touched}
      )`;
  }

  console.log(`[seed-followups] inserted ${cards.length} follow-ups.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
