/**
 * Permanent Apple App Review demo account for **Stack OS**.
 *
 *   pnpm --filter web db:seed:apple-review        # writes to the DB in web/.env.local
 *
 * Creates a self-contained demo org (`org_stackos_demo`) with a realistic
 * resident account Apple can sign into and immediately understand the product:
 * a mix of completed / open / in-progress maintenance requests across
 * categories, with conversations, photos, timeline history, technician
 * assignments, and status changes.
 *
 * Design decisions:
 *  - **Isolated org.** The demo lives in its own `org_bedrock_demo`, NOT the
 *    real Lucid org, so it never pollutes real operators' work views and the
 *    reviewer only ever sees demo data. Tenant login resolves the org from the
 *    email, so the same production deployment serves this account transparently.
 *  - **Idempotent.** Re-running wipes and rebuilds only `org_bedrock_demo`
 *    (FK-safe) — no duplication, and the end state is identical every run. No
 *    real data is ever touched.
 *  - **No app-code coupling.** This is a seed script; the application has no
 *    review-specific branches or flags. Credentials are bcrypt-hashed (never
 *    stored plaintext); the password is overridable via APPLE_REVIEW_PASSWORD.
 *
 * Visibility note: residents see work orders by `unit_id` (RLS
 * `work_orders_tenant_self`), so every seeded WO is stamped with the reviewer's
 * unit — that's what makes them appear in the app.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__dir, "..", "web", ".env"), quiet: true });

const ORG = "org_stackos_demo";
const REVIEW_EMAIL = "apple-review@stackwithus.com";
const REVIEW_PASSWORD = process.env.APPLE_REVIEW_PASSWORD || "Review2026!";
const REVIEW_NAME = "Apple Reviewer";
const BCRYPT_COST = 12; // matches web/src/lib/server/password.ts

const DB = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!DB) {
  console.error("[seed:apple-review] DATABASE_URL not set (web/.env.local)");
  process.exit(1);
}
const sql = postgres(DB, { ssl: "require", max: 1 });

/* ---- time helpers (anchored to now) ---- */
const NOW = new Date();
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const hours = (n: number) => new Date(NOW.getTime() - n * 3_600_000);

/* ---- optional R2 for demo photos (skips cleanly if unconfigured) ---- */
const s3 =
  process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      })
    : null;
const BUCKET = process.env.S3_BUCKET ?? "stack-os-uploads";

/** A clean labeled placeholder "photo" for a work order, uploaded to R2. */
async function uploadDemoPhoto(woId: string, label: string, tint: string): Promise<{ key: string; size: number } | null> {
  if (!s3) return null;
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#0a0a0a"/></linearGradient></defs>
      <rect width="1024" height="768" fill="url(#g)"/>
      <text x="512" y="392" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="600"
        fill="#ffffff" text-anchor="middle" opacity="0.92">${label}</text>
      <text x="512" y="700" font-family="Helvetica, Arial, sans-serif" font-size="22"
        fill="#ffffff" text-anchor="middle" opacity="0.55">Stack OS · resident photo</text>
    </svg>`;
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    const safe = label.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${ORG}/work_order/${woId}/${randomUUID()}-${safe}.jpg`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: "image/jpeg", Body: jpeg }));
    return { key, size: jpeg.byteLength };
  } catch (e) {
    // Best-effort: a storage hiccup must never fail the whole seed.
    console.warn(`[seed:apple-review] photo upload skipped (${label}):`, e instanceof Error ? e.message : e);
    return null;
  }
}

/* ---- the demo work orders ---- */
type Msg = { from: "tenant" | "team"; ago: Date; body: string };
interface WO {
  number: number;
  category: string;
  title: string;
  description: string;
  status: "new" | "assigned" | "scheduled" | "in_progress" | "resolved" | "verified" | "closed";
  created: Date;
  started?: Date;
  completed?: Date;
  techIdx: number; // -1 = unassigned
  photo?: { label: string; tint: string };
  convo: Msg[];
  workPerformed?: string[];
}

const WORK_ORDERS: WO[] = [
  // ---- 4 COMPLETED ----
  {
    number: 1001, category: "electrical", title: "Outlet in living room not working",
    description: "The outlet by the TV stopped working yesterday. Nothing plugged into it turns on.",
    status: "verified", created: days(21), completed: days(18), started: days(19), techIdx: 0,
    photo: { label: "Living room outlet", tint: "#3a2f1a" },
    convo: [
      { from: "tenant", ago: days(21), body: "Hi, the outlet by the TV isn't working. Could someone take a look?" },
      { from: "team", ago: days(20), body: "Thanks for reporting — we've scheduled an electrician for tomorrow morning." },
      { from: "team", ago: days(18), body: "All fixed! It was a tripped GFCI upstream. Everything's live again — let us know if anything else comes up." },
      { from: "tenant", ago: days(18), body: "Confirmed, it's working now. Thank you!" },
    ],
    workPerformed: ["Reset tripped GFCI outlet feeding the living-room circuit.", "Tested every outlet on the circuit — all live."],
  },
  {
    number: 1002, category: "plumbing", title: "Kitchen faucet leaking",
    description: "Water drips from the base of the kitchen faucet whenever it's turned on.",
    status: "closed", created: days(30), completed: days(26), started: days(27), techIdx: 1,
    photo: { label: "Kitchen faucet leak", tint: "#16304a" },
    convo: [
      { from: "tenant", ago: days(30), body: "The kitchen faucet leaks from the base every time I turn it on." },
      { from: "team", ago: days(29), body: "Got it — we'll bring a replacement cartridge and O-ring set." },
      { from: "team", ago: days(26), body: "Replaced the worn cartridge and O-ring. No more leak — thanks for your patience!" },
    ],
    workPerformed: ["Replaced worn cartridge and O-ring in the kitchen faucet.", "Verified no leak under full pressure."],
  },
  {
    number: 1003, category: "hvac", title: "AC not cooling upstairs",
    description: "The upstairs rooms stay warm even with the AC running all day.",
    status: "verified", created: days(14), completed: days(11), started: days(12), techIdx: 0,
    convo: [
      { from: "tenant", ago: days(14), body: "The upstairs bedrooms won't cool down even with the AC on all day." },
      { from: "team", ago: days(13), body: "Sounds like airflow — we'll check the filter and condensate line." },
      { from: "team", ago: days(11), body: "Replaced a very clogged filter and cleared the condensate line. Getting a strong cold split now." },
      { from: "tenant", ago: days(11), body: "Much better upstairs now, thanks!" },
    ],
    workPerformed: ["Replaced clogged return-air filter.", "Cleared blocked condensate line.", "Confirmed ~20°F split at the upstairs vents."],
  },
  {
    number: 1004, category: "general", title: "Loose cabinet door under bathroom sink",
    description: "The cabinet door under the bathroom sink is hanging loose on its hinge.",
    status: "resolved", created: days(5), completed: days(2), started: days(3), techIdx: 1,
    convo: [
      { from: "tenant", ago: days(5), body: "The cabinet door under the bathroom sink is coming off its hinge." },
      { from: "team", ago: days(4), body: "We'll get that re-secured this week." },
      { from: "team", ago: days(2), body: "Re-seated both hinges with longer screws — solid now. Please confirm it's good on your end." },
    ],
    workPerformed: ["Re-seated and tightened both hinges; added longer screws for a durable hold."],
  },
  // ---- 1 IN PROGRESS ----
  {
    number: 1005, category: "plumbing", title: "Bathroom sink draining slowly",
    description: "The bathroom sink takes a long time to drain and sometimes backs up.",
    status: "in_progress", created: days(3), started: days(1), techIdx: 1,
    photo: { label: "Bathroom sink", tint: "#123a34" },
    convo: [
      { from: "tenant", ago: days(3), body: "The bathroom sink is draining really slowly and backing up a bit." },
      { from: "team", ago: days(2), body: "Assigned to our plumber — they'll be out within a couple of days." },
      { from: "team", ago: hours(6), body: "On site now taking a look. Will update you shortly." },
    ],
  },
  // ---- 3 OPEN ----
  {
    number: 1006, category: "electrical", title: "Flickering hallway light",
    description: "The hallway light flickers on and off, especially in the evening.",
    status: "assigned", created: days(2), techIdx: 0,
    convo: [
      { from: "tenant", ago: days(2), body: "The hallway light keeps flickering, mostly in the evenings." },
      { from: "team", ago: days(1), body: "Thanks — we've assigned an electrician and will schedule a visit soon." },
    ],
  },
  {
    number: 1007, category: "hvac", title: "Thermostat screen unresponsive",
    description: "The thermostat screen is blank and won't respond to any buttons.",
    status: "scheduled", created: days(1), techIdx: 0,
    convo: [
      { from: "tenant", ago: days(1), body: "The thermostat screen is completely blank and none of the buttons do anything." },
      { from: "team", ago: hours(18), body: "We've scheduled a technician for Thursday to check the wiring and battery." },
    ],
  },
  {
    number: 1008, category: "general", title: "Front door squeaks loudly",
    description: "The front door squeaks loudly every time it opens.",
    status: "new", created: hours(4), techIdx: -1,
    convo: [
      { from: "tenant", ago: hours(4), body: "The front door squeaks really loudly whenever it opens — could someone oil the hinges?" },
    ],
  },
];

/* ---- status → the transition chain we stamp into the audit log ---- */
const CHAIN: Record<WO["status"], string[]> = {
  new: ["new"],
  assigned: ["new", "assigned"],
  scheduled: ["new", "assigned", "scheduled"],
  in_progress: ["new", "assigned", "scheduled", "in_progress"],
  resolved: ["new", "assigned", "scheduled", "in_progress", "resolved"],
  verified: ["new", "assigned", "scheduled", "in_progress", "resolved", "verified"],
  closed: ["new", "assigned", "scheduled", "in_progress", "resolved", "verified", "closed"],
};

async function main() {
  console.log(`[seed:apple-review] target org ${ORG}`);

  // 1) Idempotency — wipe the demo org only (FK-safe). No real data touched.
  await sql.begin(async (tx) => {
    for (const t of [
      "notifications", "comments", "attachments", "assignments", "audit_log",
      "task_costs", "work_orders", "tenant_users", "units", "properties",
      "org_settings", "users",
    ]) {
      await tx.unsafe(`delete from ${t} where org_id = '${ORG}'`);
    }
  });

  // 2) Demo staff (assignees + "team" message authors). No logins needed —
  //    Apple signs in only as the tenant.
  const staff = [
    { clerk: "local:bedrock_mgr", email: "manager@bedrock-demo.local", name: "Jordan Reyes", role: "manager" },
    { clerk: "local:bedrock_tech1", email: "marcus@bedrock-demo.local", name: "Marcus Bell", role: "technician" },
    { clerk: "local:bedrock_tech2", email: "diana@bedrock-demo.local", name: "Diana Cruz", role: "technician" },
  ];
  const staffIds: string[] = [];
  for (const s of staff) {
    const [row] = await sql`
      insert into users (org_id, clerk_user_id, email, name, role, status)
      values (${ORG}, ${s.clerk}, ${s.email}, ${s.name}, ${s.role}, 'active') returning id`;
    staffIds.push(row!.id);
  }
  const managerId = staffIds[0]!;
  const techIds = [staffIds[1]!, staffIds[2]!]; // techIdx 0,1

  // 3) Property + unit.
  const [prop] = await sql`
    insert into properties (org_id, name, address_line1, city, state, default_assignee_user_id)
    values (${ORG}, ${"Maple Court Apartments"}, ${"1200 Maple Court"}, ${"Austin"}, ${"TX"}, ${techIds[0]})
    returning id`;
  const propertyId = prop!.id;
  const [unit] = await sql`
    insert into units (org_id, property_id, label, floor)
    values (${ORG}, ${propertyId}, ${"Apt 204"}, ${"2"}) returning id`;
  const unitId = unit!.id;

  // 4) The reviewer tenant (bcrypt-hashed; password never stored plaintext).
  const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, BCRYPT_COST);
  const [tenant] = await sql`
    insert into tenant_users (org_id, unit_id, email, name, status, password_hash, email_verified_at)
    values (${ORG}, ${unitId}, ${REVIEW_EMAIL}, ${REVIEW_NAME}, 'active', ${passwordHash}, ${NOW})
    returning id`;
  const tenantId = tenant!.id;

  // org fallback so any future WO still routes.
  await sql`insert into org_settings (org_id, fallback_assignee_user_id) values (${ORG}, ${techIds[0]})`;

  // 5) Work orders + conversations + audit + assignments + photos + completion.
  let photoCount = 0;
  for (const w of WORK_ORDERS) {
    const techId = w.techIdx >= 0 ? techIds[w.techIdx]! : null;
    const acknowledgedAt = w.status !== "new" && techId ? w.started ?? w.created : null;

    const [row] = await sql`
      insert into work_orders (
        org_id, number, title, description, kind, status, priority, category,
        property_id, unit_id, created_at, updated_at, started_at, completed_at,
        created_by_actor_type, created_by_tenant_user_id,
        acknowledged_at, acknowledged_by_user_id, tenant_updated_at
      ) values (
        ${ORG}, ${w.number}, ${w.title}, ${w.description}, 'work_order', ${w.status}, 'normal', ${w.category},
        ${propertyId}, ${unitId}, ${w.created}, ${w.completed ?? w.started ?? w.created}, ${w.started ?? null}, ${w.completed ?? null},
        'tenant', ${tenantId},
        ${acknowledgedAt}, ${acknowledgedAt ? techId : null}, ${w.convo.at(-1)?.ago ?? w.created}
      ) returning id`;
    const woId = row!.id;

    // assignment (active) for anything past "new"
    if (techId && w.status !== "new") {
      await sql`
        insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id, assigned_by_user_id, assigned_at)
        values (${ORG}, 'work_order', ${woId}, 'user', ${techId}, ${managerId}, ${w.started ?? w.created})`;
    }

    // conversation (all resident-visible = external)
    for (const msg of w.convo) {
      const isTenant = msg.from === "tenant";
      await sql`
        insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility, created_at, updated_at)
        values (${ORG}, 'work_order', ${woId}, ${msg.body}, ${isTenant ? "tenant" : "user"},
          ${isTenant ? tenantId : techId ?? managerId}, 'external', ${msg.ago}, ${msg.ago})`;
    }

    // photo(s)
    let photoKey: string | null = null;
    if (w.photo) {
      const up = await uploadDemoPhoto(woId, w.photo.label, w.photo.tint);
      if (up) {
        photoKey = up.key;
        photoCount++;
        await sql`
          insert into attachments (org_id, target_type, target_id, kind, storage_key, content_type, size_bytes, filename, ordering, uploaded_by_actor_type, uploaded_by_user_id)
          values (${ORG}, 'work_order', ${woId}, 'general', ${up.key}, 'image/jpeg', ${up.size}, ${w.photo.label + ".jpg"}, 0, 'tenant', null)`;
      }
    }

    // timeline (audit) — created + each status change, timestamped along the way
    const chain = CHAIN[w.status];
    await sql`
      insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG}, 'work_order', ${woId}, 'created', 'tenant', ${tenantId},
        ${sql.json({ to: { status: "new", title: w.title, category: w.category } })}, ${w.created}, ${w.created})`;
    for (let i = 1; i < chain.length; i++) {
      const from = chain[i - 1]!;
      const to = chain[i]!;
      // spread the changes between created and completed/now
      const span = (w.completed ?? NOW).getTime() - w.created.getTime();
      const at = new Date(w.created.getTime() + (span * i) / chain.length);
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG}, 'work_order', ${woId}, 'status_changed', ${to === "verified" ? "tenant" : "user"},
          ${to === "verified" ? tenantId : techId ?? managerId}, ${sql.json({ from, to })}, ${at}, ${at})`;
    }

    // structured completion summary on completed WOs (SUM-001 shape)
    if (w.status === "resolved" || w.status === "verified" || w.status === "closed") {
      const summary = {
        version: 1,
        woNumber: w.number,
        title: w.title,
        category: w.category,
        originalIssue: w.description,
        location: { property: "Maple Court Apartments", floor: "2", suite: null, unit: "Apt 204" },
        requester: REVIEW_NAME,
        technician: staff[w.techIdx + 1]?.name ?? "Marcus Bell",
        workPerformed: w.workPerformed ?? [],
        photoKeys: photoKey ? [photoKey] : [],
        completedAt: (w.completed ?? NOW).toISOString(),
        completedByUserId: techId,
        finalStatus: "resolved",
      };
      await sql`update work_orders set completion_summary = ${sql.json(summary)} where id = ${woId}`;
    }
  }

  // 6) Summary (never prints the password).
  const counts = {
    completed: WORK_ORDERS.filter((w) => ["resolved", "verified", "closed"].includes(w.status)).length,
    open: WORK_ORDERS.filter((w) => ["new", "assigned", "scheduled"].includes(w.status)).length,
    inProgress: WORK_ORDERS.filter((w) => w.status === "in_progress").length,
  };
  console.log(`[seed:apple-review] done.`);
  console.log(`  org:       ${ORG}`);
  console.log(`  account:   ${REVIEW_EMAIL}  (password set from APPLE_REVIEW_PASSWORD or the documented default)`);
  console.log(`  property:  Maple Court Apartments · Apt 204`);
  console.log(`  staff:     ${staff.length} (1 manager + 2 technicians)`);
  console.log(`  workOrders: ${WORK_ORDERS.length} — ${counts.completed} completed, ${counts.open} open, ${counts.inProgress} in progress`);
  console.log(`  photos:    ${photoCount} uploaded${s3 ? "" : " (R2 not configured — skipped)"}`);
  await sql.end();
}

main().catch(async (e) => {
  console.error("[seed:apple-review] FAILED:", e instanceof Error ? e.message : e);
  try { await sql.end(); } catch { /* ignore */ }
  process.exit(1);
});
