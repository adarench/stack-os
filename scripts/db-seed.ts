/**
 * Seed realistic operational data for a Clerk org.
 *
 *   pnpm --filter web db:seed -- <clerk_org_id>
 *     # or:
 *   SEED_ORG_ID=org_2abc... pnpm --filter web db:seed
 *
 * Sized to "real Stack scale" — 8 properties · ~30 units · 10 vendors ·
 * ~40 work orders across all statuses · 6 inspections · 3 projects ·
 * pending approvals · notifications · COIs.
 *
 * Re-runnable: wipes all rows for the given org_id (in FK-safe order),
 * then re-inserts. Connects with the unpooled URL via postgres-js — same
 * pattern as the integration test cleanup helpers. Bypasses RLS because
 * the seed runs without a Clerk session.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const __script_dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__script_dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__script_dir, "..", "web", ".env"), quiet: true });

// pnpm passes a literal "--" separator before user args, so accept any of
//   pnpm db:seed org_xxx           // direct
//   pnpm db:seed -- org_xxx        // pnpm separator
//   SEED_ORG_ID=org_xxx pnpm db:seed
const ORG_ID = process.argv
  .slice(2)
  .find((a) => a !== "--" && a.length > 0) ?? process.env.SEED_ORG_ID;
if (!ORG_ID) {
  console.error(
    "[db:seed] missing org_id. Usage: pnpm --filter web db:seed -- <clerk_org_id>",
  );
  process.exit(1);
}

const URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!URL) {
  console.error("[db:seed] DATABASE_URL not set in web/.env.local");
  process.exit(1);
}

const sql = postgres(URL, { ssl: "require", max: 1 });

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

/* -------------------- properties + units -------------------- */

interface PropertySeed {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  units: string[];
}

const PROPERTIES: PropertySeed[] = [
  {
    name: "247 Maple Lane",
    addressLine1: "247 Maple Lane",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11215",
    units: ["1A", "1B", "2A", "2B", "3"],
  },
  {
    name: "312 Oak Street",
    addressLine1: "312 Oak Street",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11217",
    units: ["1", "2", "3", "4"],
  },
  {
    name: "89 Elm Way",
    addressLine1: "89 Elm Way",
    city: "Queens",
    state: "NY",
    postalCode: "11375",
    units: ["1A", "1B", "2A", "2B", "3A", "3B"],
  },
  {
    name: "1404 Pine Ridge",
    addressLine1: "1404 Pine Ridge Rd",
    city: "Queens",
    state: "NY",
    postalCode: "11385",
    units: ["A", "B", "C"],
  },
  {
    name: "56 Birch Terrace",
    addressLine1: "56 Birch Terrace",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11211",
    units: ["1", "2", "3", "4"],
  },
  {
    name: "22 Cedar Court",
    addressLine1: "22 Cedar Court",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    units: ["A", "B"],
  },
  {
    name: "789 Sycamore Ave",
    addressLine1: "789 Sycamore Avenue",
    city: "Manhattan",
    state: "NY",
    postalCode: "10025",
    units: ["3F", "4F", "5F"],
  },
  {
    name: "631 Willow Drive",
    addressLine1: "631 Willow Drive",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11231",
    units: ["1", "2", "3"],
  },
];

/* -------------------- vendors + COIs -------------------- */

interface VendorSeed {
  name: string;
  trade: string;
  /** "active" (valid COI), "expiring" (within 30d), "expired", or "none". */
  coiState: "active" | "expiring" | "expired" | "none";
}

const VENDORS: VendorSeed[] = [
  { name: "Stark Plumbing Co", trade: "plumbing", coiState: "active" },
  { name: "Volt Electric LLC", trade: "electric", coiState: "active" },
  { name: "Apex HVAC Services", trade: "hvac", coiState: "expiring" },
  { name: "Quicklock Locksmith", trade: "locksmith", coiState: "active" },
  { name: "Goldcoat Painters", trade: "paint", coiState: "expiring" },
  { name: "SparkleClean Co", trade: "cleaning", coiState: "active" },
  { name: "Greenleaf Landscaping", trade: "landscape", coiState: "expired" },
  { name: "Anchor Pest Control", trade: "pest", coiState: "none" },
  { name: "Bright Appliance Repair", trade: "appliance", coiState: "none" },
  { name: "Northstar GC", trade: "general", coiState: "active" },
];

/* -------------------- work orders -------------------- */

interface WoSeed {
  title: string;
  description: string;
  status:
    | "new"
    | "triaged"
    | "assigned"
    | "scheduled"
    | "in_progress"
    | "blocked"
    | "resolved"
    | "verified"
    | "closed"
    | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  pIdx: number;
  uIdx: number;
  due: number;
  createdAgo: number;
}

const WORK_ORDERS: WoSeed[] = [
  { title: "Bathroom ceiling leak — water coming through", description: "Tenant reports active dripping in bathroom; bucket under leak.", status: "blocked", priority: "urgent", pIdx: 0, uIdx: 2, due: -3, createdAgo: -5 },
  { title: "Hot water heater not heating", description: "No hot water for 2 days. Tenant has tried reset.", status: "blocked", priority: "high", pIdx: 2, uIdx: 1, due: -2, createdAgo: -4 },
  { title: "Front door deadbolt jammed", description: "Tenant locked out twice this week. Deadbolt resists key.", status: "in_progress", priority: "high", pIdx: 1, uIdx: 0, due: -1, createdAgo: -3 },
  { title: "Mailbox lock broken", description: "Lock cylinder spinning freely; tenant cannot retrieve mail.", status: "assigned", priority: "normal", pIdx: 4, uIdx: 2, due: -1, createdAgo: -2 },
  { title: "Kitchen sink slow drain", description: "Drain backed up over weekend; standing water in basin.", status: "scheduled", priority: "normal", pIdx: 5, uIdx: 0, due: 0, createdAgo: -2 },
  { title: "Annual smoke detector test", description: "Code-required annual check across all bedrooms + hallway.", status: "scheduled", priority: "normal", pIdx: 0, uIdx: 0, due: 0, createdAgo: -7 },
  { title: "Replace HVAC filter — quarterly", description: "Routine quarterly filter change.", status: "scheduled", priority: "low", pIdx: 3, uIdx: 1, due: 1, createdAgo: -7 },
  { title: "Refrigerator buzzing loudly", description: "Tenant reports new noise; fridge still cooling.", status: "triaged", priority: "normal", pIdx: 6, uIdx: 1, due: 2, createdAgo: -1 },
  { title: "Outlet in kitchen sparking", description: "Single outlet near sink sparked when plugging in toaster.", status: "assigned", priority: "high", pIdx: 2, uIdx: 3, due: 1, createdAgo: -1 },
  { title: "Repaint hallway after water damage", description: "Drywall already replaced. Paint touchup needed.", status: "scheduled", priority: "normal", pIdx: 7, uIdx: 0, due: 3, createdAgo: -5 },
  { title: "Bedroom window stuck — won't open", description: "Window sash stuck on right side. Tenant unable to open.", status: "in_progress", priority: "normal", pIdx: 1, uIdx: 1, due: 4, createdAgo: -3 },
  { title: "Replace porch light fixture", description: "Fixture broken during recent storm. Bulb dangling.", status: "in_progress", priority: "low", pIdx: 4, uIdx: 3, due: 5, createdAgo: -2 },
  { title: "Pest treatment — kitchen ants", description: "Tenant reports ant trail along kitchen baseboard.", status: "in_progress", priority: "normal", pIdx: 2, uIdx: 2, due: 2, createdAgo: -2 },
  { title: "Caulk bathroom tub — mildew lines", description: "Routine maintenance: scrape and recaulk.", status: "in_progress", priority: "low", pIdx: 0, uIdx: 4, due: 6, createdAgo: -4 },
  { title: "Tenant request: install ceiling fan", description: "Tenant offering to pay. Need to confirm wiring + landlord OK.", status: "new", priority: "low", pIdx: 5, uIdx: 1, due: 14, createdAgo: -1 },
  { title: "Replace cracked tile in entryway", description: "Two tiles cracked near front door.", status: "new", priority: "normal", pIdx: 3, uIdx: 2, due: 10, createdAgo: -1 },
  { title: "Squeaky stair tread — 2nd floor", description: "Loud squeak; tenant requests fix when convenient.", status: "new", priority: "low", pIdx: 6, uIdx: 2, due: 21, createdAgo: 0 },
  { title: "Garage door opener intermittent", description: "Works ~80% of the time. May need new sensor.", status: "new", priority: "normal", pIdx: 4, uIdx: 0, due: 7, createdAgo: 0 },
  { title: "Bedroom radiator clanging", description: "Loud banging when heat kicks on. Tenant losing sleep.", status: "triaged", priority: "high", pIdx: 1, uIdx: 3, due: 1, createdAgo: -1 },
  { title: "Vacant unit turn — paint + clean", description: "Tenant moved out 4d ago. Standard turn.", status: "triaged", priority: "normal", pIdx: 7, uIdx: 1, due: 5, createdAgo: -4 },
  { title: "Replace stove burner", description: "Front-right burner not heating.", status: "resolved", priority: "normal", pIdx: 0, uIdx: 1, due: -7, createdAgo: -10 },
  { title: "Replace kitchen faucet aerator", description: "Clogged aerator. Quick swap.", status: "resolved", priority: "low", pIdx: 2, uIdx: 4, due: -5, createdAgo: -8 },
  { title: "Reset breaker — bedroom outlets", description: "Tripped breaker, no damage.", status: "verified", priority: "normal", pIdx: 5, uIdx: 0, due: -10, createdAgo: -12 },
  { title: "Clear bathroom drain hair clog", description: "Standard snaking job.", status: "verified", priority: "low", pIdx: 6, uIdx: 0, due: -12, createdAgo: -14 },
  { title: "Repair fence section — back yard", description: "Storm damage. Two posts replaced.", status: "closed", priority: "normal", pIdx: 7, uIdx: 2, due: -15, createdAgo: -20 },
  { title: "Annual furnace tune-up", description: "Yearly maintenance.", status: "closed", priority: "low", pIdx: 3, uIdx: 0, due: -20, createdAgo: -30 },
  { title: "Replace dishwasher filter", description: "Vendor swapped on-site.", status: "closed", priority: "low", pIdx: 0, uIdx: 3, due: -25, createdAgo: -35 },
  { title: "Install new doormat (declined)", description: "Tenant rescinded request.", status: "cancelled", priority: "low", pIdx: 5, uIdx: 1, due: 5, createdAgo: -5 },
  { title: "Hallway light flickering", description: "Likely loose connection. Needs check.", status: "new", priority: "normal", pIdx: 6, uIdx: 1, due: 4, createdAgo: 0 },
  { title: "Tenant complaint: noise from upstairs", description: "Tenant in 1A complains about footsteps. Possible rug rec.", status: "triaged", priority: "low", pIdx: 0, uIdx: 0, due: 10, createdAgo: -2 },
  { title: "Replace bathroom exhaust fan", description: "Fan motor died; mold risk.", status: "scheduled", priority: "normal", pIdx: 4, uIdx: 1, due: 6, createdAgo: -3 },
  { title: "Tighten bathroom faucet handle", description: "Handle loose. 5-min job.", status: "in_progress", priority: "low", pIdx: 7, uIdx: 2, due: 8, createdAgo: -1 },
  { title: "Replace dryer vent screen", description: "Lint screen torn.", status: "scheduled", priority: "low", pIdx: 2, uIdx: 5, due: 9, createdAgo: -2 },
  { title: "Repair drywall hole — bedroom", description: "Doorknob hole from missing wall stop.", status: "assigned", priority: "normal", pIdx: 1, uIdx: 2, due: 3, createdAgo: -2 },
  { title: "Garbage disposal jammed", description: "Won't spin. Probably foreign object.", status: "blocked", priority: "normal", pIdx: 3, uIdx: 2, due: -1, createdAgo: -3 },
  { title: "Roof gutter clogged", description: "Overflow during last rain. Need cleaning.", status: "scheduled", priority: "normal", pIdx: 0, uIdx: 3, due: 4, createdAgo: -5 },
  { title: "Cabinet door hinge broken", description: "Hinge sheared. Door won't close flush.", status: "new", priority: "low", pIdx: 5, uIdx: 0, due: 12, createdAgo: 0 },
  { title: "Bathroom mirror cracked", description: "Unsafe; replace.", status: "triaged", priority: "normal", pIdx: 6, uIdx: 2, due: 5, createdAgo: -1 },
  { title: "Tenant requests carbon monoxide detector test", description: "Routine quarterly test.", status: "scheduled", priority: "normal", pIdx: 4, uIdx: 0, due: 2, createdAgo: -2 },
];

/* -------------------- inspections -------------------- */

interface InsSeed {
  kind: "move_in" | "move_out" | "annual" | "ad_hoc";
  status: "scheduled" | "in_progress" | "completed" | "reviewed" | "cancelled";
  pIdx: number;
  uIdx: number;
  scheduled: number;
  createdAgo: number;
}

const INSPECTIONS: InsSeed[] = [
  { kind: "annual", status: "scheduled", pIdx: 0, uIdx: 0, scheduled: -2, createdAgo: -10 },
  { kind: "move_out", status: "scheduled", pIdx: 2, uIdx: 3, scheduled: -1, createdAgo: -7 },
  { kind: "move_in", status: "scheduled", pIdx: 1, uIdx: 0, scheduled: 0, createdAgo: -3 },
  { kind: "annual", status: "scheduled", pIdx: 3, uIdx: 0, scheduled: 0, createdAgo: -7 },
  { kind: "ad_hoc", status: "in_progress", pIdx: 5, uIdx: 1, scheduled: -1, createdAgo: -2 },
  { kind: "annual", status: "in_progress", pIdx: 7, uIdx: 2, scheduled: 0, createdAgo: -1 },
];

/* -------------------- projects -------------------- */

interface PrjSeed {
  name: string;
  description: string;
  status: "planning" | "active" | "punch_list" | "closing" | "closed";
  kind: "general" | "unit_turn" | "capex" | "renovation" | "make_ready";
  pIdx: number;
  target: number;
  createdAgo: number;
}

const PROJECTS: PrjSeed[] = [
  { name: "Maple Lane lobby refresh", description: "New paint, lighting, intercom panel.", status: "active", kind: "capex", pIdx: 0, target: 30, createdAgo: -20 },
  { name: "Oak St unit 4 turn", description: "Full turn: paint, clean, replace fridge.", status: "punch_list", kind: "unit_turn", pIdx: 1, target: 7, createdAgo: -25 },
  { name: "Building-wide CO detector replacement", description: "Renovation: replace all detectors > 7yr old.", status: "planning", kind: "renovation", pIdx: 2, target: 45, createdAgo: -5 },
];

/* -------------------- approvals -------------------- */

interface ApSeed {
  reason: string;
  woIdx: number;
  amountCents: number;
  notes: string;
  createdAgo: number;
}

const APPROVALS: ApSeed[] = [
  { reason: "estimate_over_threshold", woIdx: 0, amountCents: 145_000, notes: "Stark Plumbing estimate; includes drywall repair after access.", createdAgo: -2 },
  { reason: "estimate_over_threshold", woIdx: 1, amountCents: 89_500, notes: "Replace water heater; brand options attached.", createdAgo: -1 },
  { reason: "vendor_change", woIdx: 8, amountCents: 32_000, notes: "Switching from Volt Electric to Quicklock for after-hours.", createdAgo: -3 },
  { reason: "estimate_over_threshold", woIdx: 9, amountCents: 540_000, notes: "Full hallway repaint with primer. Quote from Goldcoat.", createdAgo: -4 },
  { reason: "budget_exception", woIdx: 19, amountCents: 27_500, notes: "Standard turn going over due to flooring damage discovered.", createdAgo: 0 },
];

/* -------------------- notifications -------------------- */

const NOTIFICATIONS: Array<{
  kind: string;
  subject: string;
  body: string;
  channel: "email" | "sms" | "push" | "in_app";
  agoHours: number;
}> = [
  { kind: "wo_blocked", subject: "WO-1001 blocked: waiting on COI", body: "Stark Plumbing has been requested but assign-gate failed.", channel: "in_app", agoHours: 2 },
  { kind: "wo_assigned", subject: "WO-1003 assigned to Quicklock", body: "Quicklock Locksmith accepted the deadbolt repair.", channel: "in_app", agoHours: 4 },
  { kind: "approval_requested", subject: "Approval requested: $1,450 estimate (WO-1001)", body: "Stark Plumbing submitted estimate over your $1,000 threshold.", channel: "in_app", agoHours: 5 },
  { kind: "wo_completed", subject: "WO-1021 marked resolved", body: "Stove burner replaced — needs verification walk.", channel: "in_app", agoHours: 8 },
  { kind: "coi_expiring", subject: "COI expiring: Apex HVAC (in 14 days)", body: "Vendor has been notified by automated sweep.", channel: "in_app", agoHours: 12 },
  { kind: "inspection_scheduled", subject: "Annual inspection scheduled — 247 Maple, Unit 1A", body: "Tenant has been notified.", channel: "in_app", agoHours: 18 },
  { kind: "wo_assigned", subject: "WO-1012 assigned to Apex HVAC", body: "Refrigerator buzz triage.", channel: "in_app", agoHours: 20 },
  { kind: "template_spawned", subject: "Quarterly filter change spawned for 1404 Pine Ridge", body: "WO-1007 created from recurring template.", channel: "in_app", agoHours: 22 },
  { kind: "coi_expired", subject: "COI expired: Greenleaf Landscaping", body: "Vendor blocked from new assignments until renewed.", channel: "in_app", agoHours: 26 },
  { kind: "tenant_insurance_received", subject: "Tenant insurance uploaded — 89 Elm Way, 2B", body: "Policy valid through next March.", channel: "in_app", agoHours: 30 },
  { kind: "wo_resolved", subject: "WO-1023 marked resolved", body: "Bathroom drain cleared.", channel: "in_app", agoHours: 36 },
  { kind: "approval_decided", subject: "Approval rejected: $5,400 hallway repaint", body: "Awaiting revised quote.", channel: "in_app", agoHours: 40 },
  { kind: "inspection_completed", subject: "Annual inspection completed — 56 Birch, Unit 1", body: "3 findings, 1 spawned to WO-1014.", channel: "in_app", agoHours: 48 },
  { kind: "wo_blocked", subject: "WO-1006 blocked: garbage disposal needs new unit", body: "Bright Appliance estimate pending.", channel: "in_app", agoHours: 60 },
  { kind: "wo_assigned", subject: "WO-1004 assigned to Stark Plumbing", body: "Hot water heater rebuild.", channel: "in_app", agoHours: 72 },
  { kind: "template_spawned", subject: "Smoke detector test spawned for 247 Maple, Unit 1A", body: "Annual code-required check.", channel: "in_app", agoHours: 84 },
  { kind: "vendor_accepted", subject: "Northstar GC accepted WO-1010 (hallway repaint)", body: "Scheduled for next week.", channel: "in_app", agoHours: 96 },
  { kind: "wo_created", subject: "New WO: Bedroom radiator clanging", body: "WO-1019 created from tenant request.", channel: "in_app", agoHours: 108 },
  { kind: "wo_overdue", subject: "WO-1003 is overdue (deadbolt repair, 1 day past due)", body: "Quicklock has not yet checked in.", channel: "in_app", agoHours: 24 },
  { kind: "coi_received", subject: "New COI uploaded: Stark Plumbing", body: "Valid through next year.", channel: "in_app", agoHours: 144 },
];

/* -------------------- runner -------------------- */

async function main() {
  console.log(`[db:seed] org_id = ${ORG_ID}`);
  console.log(`[db:seed] wiping existing rows for this org...`);

  // FK-safe delete order — children first.
  await sql`delete from audit_log where org_id = ${ORG_ID!}`;
  await sql`delete from notifications where org_id = ${ORG_ID!}`;
  await sql`delete from approvals where org_id = ${ORG_ID!}`;
  await sql`delete from task_costs where org_id = ${ORG_ID!}`;
  await sql`delete from task_time_entries where org_id = ${ORG_ID!}`;
  await sql`delete from invoices where org_id = ${ORG_ID!}`;
  await sql`delete from attachments where org_id = ${ORG_ID!}`;
  await sql`delete from comments where org_id = ${ORG_ID!}`;
  await sql`delete from inspection_findings where org_id = ${ORG_ID!}`;
  await sql`delete from inspections where org_id = ${ORG_ID!}`;
  await sql`delete from assignments where org_id = ${ORG_ID!}`;
  await sql`delete from work_orders where org_id = ${ORG_ID!}`;
  await sql`delete from projects where org_id = ${ORG_ID!}`;
  await sql`delete from task_templates where org_id = ${ORG_ID!}`;
  await sql`delete from task_scopes where org_id = ${ORG_ID!}`;
  await sql`delete from vendor_cois where org_id = ${ORG_ID!}`;
  await sql`delete from tenant_insurance_policies where org_id = ${ORG_ID!}`;
  await sql`delete from tenant_users where org_id = ${ORG_ID!}`;
  await sql`delete from vendor_users where org_id = ${ORG_ID!}`;
  await sql`delete from vendors where org_id = ${ORG_ID!}`;
  await sql`delete from units where org_id = ${ORG_ID!}`;
  await sql`delete from properties where org_id = ${ORG_ID!}`;

  /* ---- properties + units ---- */
  console.log(`[db:seed] inserting ${PROPERTIES.length} properties...`);
  const propertyIds: string[] = [];
  const unitIdsByProperty: string[][] = [];
  for (const p of PROPERTIES) {
    const [row] = await sql<{ id: string }[]>`
      insert into properties (org_id, name, address_line1, city, state, postal_code, country, timezone)
      values (${ORG_ID!}, ${p.name}, ${p.addressLine1}, ${p.city}, ${p.state}, ${p.postalCode}, 'US', 'America/New_York')
      returning id
    `;
    propertyIds.push(row!.id);
    const unitIds: string[] = [];
    for (const label of p.units) {
      const [u] = await sql<{ id: string }[]>`
        insert into units (org_id, property_id, label)
        values (${ORG_ID!}, ${row!.id}, ${label})
        returning id
      `;
      unitIds.push(u!.id);
    }
    unitIdsByProperty.push(unitIds);
  }
  const totalUnits = unitIdsByProperty.flat().length;
  console.log(`[db:seed]   ${totalUnits} units across ${PROPERTIES.length} properties`);

  /* ---- vendors + COIs ---- */
  console.log(`[db:seed] inserting ${VENDORS.length} vendors + COIs...`);
  const vendorIds: string[] = [];
  for (const v of VENDORS) {
    const [row] = await sql<{ id: string }[]>`
      insert into vendors (org_id, name, status, notes)
      values (${ORG_ID!}, ${v.name}, 'active', ${"Trade: " + v.trade})
      returning id
    `;
    vendorIds.push(row!.id);

    if (v.coiState !== "none") {
      const expiresAt =
        v.coiState === "active"
          ? days(180)
          : v.coiState === "expiring"
            ? days(15)
            : days(-10);
      const status =
        v.coiState === "active"
          ? "active"
          : v.coiState === "expiring"
            ? "expiring"
            : "expired";
      await sql`
        insert into vendor_cois (org_id, vendor_id, policy_number, carrier, coverage_amount_cents, effective_at, expires_at, status)
        values (${ORG_ID!}, ${row!.id}, ${`POL-${10000 + vendorIds.length}`}, ${"Hartford Liability"}, ${"100000000"}, ${days(-180)}, ${expiresAt}, ${status})
      `;
    }
  }

  /* ---- work orders ---- */
  console.log(`[db:seed] inserting ${WORK_ORDERS.length} work orders...`);
  const woIds: string[] = [];
  for (let i = 0; i < WORK_ORDERS.length; i++) {
    const w = WORK_ORDERS[i]!;
    const number = 1001 + i;
    const propertyId = propertyIds[w.pIdx]!;
    const unitId = unitIdsByProperty[w.pIdx]![w.uIdx]!;
    const dueAt = days(w.due);
    const createdAt = days(w.createdAgo);
    const completedAt =
      w.status === "closed" || w.status === "resolved" || w.status === "verified"
        ? hours(-Math.max(2, Math.abs(w.due) * 8))
        : null;
    const startedAt =
      w.status === "in_progress" ||
      w.status === "resolved" ||
      w.status === "verified" ||
      w.status === "closed"
        ? hours(-12)
        : null;
    const updatedAt = days(Math.max(w.createdAgo + 1, -1));

    const [row] = await sql<{ id: string }[]>`
      insert into work_orders (
        org_id, number, title, description, kind, status, priority,
        property_id, unit_id, due_at, started_at, completed_at,
        created_at, updated_at
      )
      values (
        ${ORG_ID!}, ${number}, ${w.title}, ${w.description},
        'work_order', ${w.status}, ${w.priority},
        ${propertyId}, ${unitId}, ${dueAt}, ${startedAt}, ${completedAt},
        ${createdAt}, ${updatedAt}
      )
      returning id
    `;
    woIds.push(row!.id);

    if (
      w.status === "resolved" ||
      w.status === "verified" ||
      w.status === "closed"
    ) {
      const amt = 5000 + Math.floor(Math.random() * 45000);
      await sql`
        insert into task_costs (org_id, work_order_id, kind, description, amount_cents)
        values (${ORG_ID!}, ${row!.id}, 'labor', ${"Vendor labor"}, ${String(amt)})
      `;
    }

    await sql`
      insert into audit_log (org_id, target_type, target_id, action, actor_type, diff, created_at, updated_at)
      values (${ORG_ID!}, 'work_order', ${row!.id}, 'created', 'user',
              ${sql.json({ to: { status: "new", title: w.title } })},
              ${createdAt}, ${createdAt})
    `;
    if (w.status !== "new") {
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, diff, created_at, updated_at)
        values (${ORG_ID!}, 'work_order', ${row!.id}, 'status_changed', 'user',
                ${sql.json({ to: { status: w.status } })},
                ${updatedAt}, ${updatedAt})
      `;
    }
  }

  /* ---- inspections ---- */
  console.log(`[db:seed] inserting ${INSPECTIONS.length} inspections...`);
  for (const ins of INSPECTIONS) {
    const propertyId = propertyIds[ins.pIdx]!;
    const unitId = unitIdsByProperty[ins.pIdx]![ins.uIdx]!;
    await sql`
      insert into inspections (
        org_id, kind, status, property_id, unit_id,
        scheduled_for, started_at, completed_at, reviewed_at,
        notes, created_at, updated_at
      )
      values (
        ${ORG_ID!}, ${ins.kind}, ${ins.status}, ${propertyId}, ${unitId},
        ${days(ins.scheduled)},
        ${ins.status === "in_progress" || ins.status === "completed" || ins.status === "reviewed" ? hours(-6) : null},
        ${ins.status === "completed" || ins.status === "reviewed" ? hours(-3) : null},
        ${ins.status === "reviewed" ? hours(-1) : null},
        ${`Routine ${ins.kind.replace(/_/g, " ")} inspection`},
        ${days(ins.createdAgo)},
        ${days(Math.max(ins.createdAgo + 1, -1))}
      )
    `;
  }

  /* ---- projects ---- */
  console.log(`[db:seed] inserting ${PROJECTS.length} projects...`);
  for (const p of PROJECTS) {
    await sql`
      insert into projects (
        org_id, name, description, kind, status,
        property_id, target_completion, created_at, updated_at
      )
      values (
        ${ORG_ID!}, ${p.name}, ${p.description}, ${p.kind}, ${p.status},
        ${propertyIds[p.pIdx]!}, ${days(p.target)},
        ${days(p.createdAgo)}, ${days(Math.max(p.createdAgo + 1, -1))}
      )
    `;
  }

  /* ---- approvals ---- */
  console.log(`[db:seed] inserting ${APPROVALS.length} approvals...`);
  for (const ap of APPROVALS) {
    const woId = woIds[ap.woIdx];
    if (!woId) continue;
    await sql`
      insert into approvals (
        org_id, target_type, target_id, reason, amount_cents,
        status, notes, created_at, updated_at
      )
      values (
        ${ORG_ID!}, 'work_order', ${woId}, ${ap.reason}, ${String(ap.amountCents)},
        'pending', ${ap.notes},
        ${days(ap.createdAgo)}, ${days(ap.createdAgo)}
      )
    `;
  }

  /* ---- notifications ---- */
  console.log(`[db:seed] inserting ${NOTIFICATIONS.length} notifications...`);
  const [existingUser] = await sql<{ id: string }[]>`
    select id from users where org_id = ${ORG_ID!} limit 1
  `;
  if (!existingUser) {
    console.log(
      `[db:seed]   skipped notifications — no staff user row yet for this org. Sign in once at the app, then re-run this seed to attach notifications.`,
    );
  } else {
    for (const n of NOTIFICATIONS) {
      await sql`
        insert into notifications (
          org_id, recipient_user_id, channel, kind, subject, body, status,
          created_at, updated_at
        )
        values (
          ${ORG_ID!}, ${existingUser.id}, ${n.channel}, ${n.kind}, ${n.subject},
          ${n.body}, 'sent',
          ${hours(-n.agoHours)}, ${hours(-n.agoHours)}
        )
      `;
    }
    console.log(`[db:seed]   ${NOTIFICATIONS.length} notifications attached to ${existingUser.id}`);
  }

  console.log(`[db:seed] done.`);
  console.log(``);
  console.log(`Summary for ${ORG_ID}:`);
  const [c1] = await sql<{ n: string }[]>`select count(*)::text as n from work_orders where org_id = ${ORG_ID!}`;
  const [c2] = await sql<{ n: string }[]>`select count(*)::text as n from inspections where org_id = ${ORG_ID!}`;
  const [c3] = await sql<{ n: string }[]>`select count(*)::text as n from projects where org_id = ${ORG_ID!}`;
  const [c4] = await sql<{ n: string }[]>`select count(*)::text as n from approvals where org_id = ${ORG_ID!} and status='pending'`;
  const [c5] = await sql<{ n: string }[]>`select count(*)::text as n from vendor_cois where org_id = ${ORG_ID!}`;
  const [c6] = await sql<{ n: string }[]>`select count(*)::text as n from properties where org_id = ${ORG_ID!}`;
  console.log(`  ${c6!.n} properties · ${totalUnits} units · ${VENDORS.length} vendors`);
  console.log(`  ${c1!.n} work orders · ${c2!.n} inspections · ${c3!.n} projects`);
  console.log(`  ${c4!.n} pending approvals · ${c5!.n} COIs`);
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error(err);
    await sql.end().catch(() => {});
    process.exit(1);
  });
