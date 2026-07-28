/**
 * Seed a believable "Tuesday 10:30am" operations state for the demo org.
 *
 *   pnpm db:seed                                  # uses DEFAULT_ORG_ID
 *   SEED_ORG_ID=org_xxx pnpm db:seed              # override
 *
 * All timestamps anchor to "now" — open work orders update_at within the
 * last 2h, the audit log streams events from −2m to −6h, notifications
 * span fresh-unread to old-but-recent. The data is asymmetric on purpose:
 * a few cold rows, a few overdue leaks, a few blocked items, recurring
 * spawns, contested approvals, a couple of expiring COIs.
 *
 * Phantom teammates (Sara, Diego, Maya) are inserted as users rows with
 * placeholder clerk_user_ids so the audit log and assignments can vary
 * actor — the activity strip on /now needs multiple humans to read alive.
 * The real signed-in user (Adam Rencher) is preserved and attached as
 * the notifications recipient.
 *
 * Re-runnable: wipes org-scoped rows in FK-safe order. Phantom users
 * survive cross-runs because they share the same clerk_user_id slugs.
 *
 * --orphans flag: also wipes data tagged with stale org_ids
 *                 (org_audit_walkthrough, '--', etc.) before reseeding.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

const __script_dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__script_dir, "..", "web", ".env.local"), quiet: true });
config({ path: resolve(__script_dir, "..", "web", ".env"), quiet: true });

const DEFAULT_ORG_ID = "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0";

const argv = process.argv.slice(2).filter((a) => a !== "--");
const ORG_ID =
  argv.find((a) => a.startsWith("org_")) ??
  process.env.SEED_ORG_ID ??
  DEFAULT_ORG_ID;
const WIPE_ORPHANS = argv.includes("--orphans");

const URL = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!URL) {
  console.error("[db:seed] DATABASE_URL not set in web/.env.local");
  process.exit(1);
}

const sql = postgres(URL, { ssl: "require", max: 1 });

/* -------------------- time helpers -------------------- */

const NOW = new Date();
const m = (n: number) => new Date(NOW.getTime() - n * 60_000); // minutesAgo
const h = (n: number) => new Date(NOW.getTime() - n * 3_600_000); // hoursAgo
const d = (n: number) => new Date(NOW.getTime() - n * 86_400_000); // daysAgo
const dFuture = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const hFuture = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

/* -------------------- staff -------------------- */

interface StaffSeed {
  clerkUserId: string;
  email: string;
  name: string;
  role: string;
  /** Initials for the activity feed actor tag. */
  initials: string;
  /** Mobile for SMS dispatch (techs). */
  phone?: string;
}

const PHANTOM_STAFF: StaffSeed[] = [
  // The maintenance team from the customer call. Fernando covers everything;
  // Oscar covers Sojo North/South. New work orders auto-route to them.
  {
    clerkUserId: "seed_phantom_fernando_reyes",
    email: "fernando@stackdemo.test",
    name: "Fernando Salazar",
    role: "manager",
    initials: "FR",
    phone: "+13855550142",
  },
  {
    clerkUserId: "seed_phantom_oscar_diaz",
    email: "oscar@stackdemo.test",
    name: "Oscar Banuelos",
    role: "staff",
    initials: "OD",
    phone: "+13855550178",
  },
  {
    clerkUserId: "seed_phantom_sara_yang",
    email: "sara.yang@stackdemo.test",
    name: "Sara Yang",
    role: "dispatcher",
    initials: "SY",
  },
  {
    clerkUserId: "seed_phantom_diego_martinez",
    email: "diego.martinez@stackdemo.test",
    name: "Diego Martinez",
    role: "manager",
    initials: "DM",
  },
  {
    clerkUserId: "seed_phantom_maya_patel",
    email: "maya.patel@stackdemo.test",
    name: "Maya Patel",
    role: "staff",
    initials: "MP",
  },
];

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
  // Oscar's buildings (the last two). Coverage is name-based in the runner:
  // anything starting "Sojo" routes to Oscar, everything else to Fernando.
  {
    name: "Sojo North",
    addressLine1: "1200 N Sojo Parkway",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84101",
    units: ["201", "202", "203", "Lobby"],
  },
  {
    name: "Sojo South",
    addressLine1: "1400 S Sojo Parkway",
    city: "Salt Lake City",
    state: "UT",
    postalCode: "84115",
    units: ["A", "B", "C", "D"],
  },
];

/* -------------------- vendors + COIs + vendor_users -------------------- */

interface VendorSeed {
  name: string;
  trade: string;
  primaryContact: string;
  primaryEmail: string;
  primaryPhone: string;
  coiState: "active" | "expiring" | "expired" | "none";
  vendorUsers: Array<{ email: string; name: string; status?: string }>;
}

const VENDORS: VendorSeed[] = [
  {
    name: "Stark Plumbing Co",
    trade: "plumbing",
    primaryContact: "Frank Stark",
    primaryEmail: "ops@starkplumbing.test",
    primaryPhone: "+1 718 555 0181",
    coiState: "active",
    vendorUsers: [
      { email: "frank@starkplumbing.test", name: "Frank Stark", status: "active" },
      { email: "carlos@starkplumbing.test", name: "Carlos Vega", status: "active" },
    ],
  },
  {
    name: "Volt Electric LLC",
    trade: "electric",
    primaryContact: "Jim Wirth",
    primaryEmail: "dispatch@voltelectric.test",
    primaryPhone: "+1 718 555 0144",
    coiState: "active",
    vendorUsers: [{ email: "jim@voltelectric.test", name: "Jim Wirth", status: "active" }],
  },
  {
    name: "Apex HVAC Services",
    trade: "hvac",
    primaryContact: "Renata Ruiz",
    primaryEmail: "ops@apexhvac.test",
    primaryPhone: "+1 347 555 0220",
    coiState: "expiring",
    vendorUsers: [{ email: "renata@apexhvac.test", name: "Renata Ruiz", status: "active" }],
  },
  {
    name: "Quicklock Locksmith",
    trade: "locksmith",
    primaryContact: "Tony Bauer",
    primaryEmail: "tony@quicklock.test",
    primaryPhone: "+1 718 555 0123",
    coiState: "active",
    vendorUsers: [{ email: "tony@quicklock.test", name: "Tony Bauer", status: "active" }],
  },
  {
    name: "Goldcoat Painters",
    trade: "paint",
    primaryContact: "Mei Lin",
    primaryEmail: "scheduling@goldcoat.test",
    primaryPhone: "+1 347 555 0102",
    coiState: "expiring",
    vendorUsers: [{ email: "mei@goldcoat.test", name: "Mei Lin", status: "active" }],
  },
  {
    name: "SparkleClean Co",
    trade: "cleaning",
    primaryContact: "Olu Adebayo",
    primaryEmail: "schedule@sparkleclean.test",
    primaryPhone: "+1 718 555 0140",
    coiState: "active",
    vendorUsers: [{ email: "olu@sparkleclean.test", name: "Olu Adebayo", status: "active" }],
  },
  {
    name: "Greenleaf Landscaping",
    trade: "landscape",
    primaryContact: "Pat Kelly",
    primaryEmail: "pat@greenleaf.test",
    primaryPhone: "+1 347 555 0177",
    coiState: "expired",
    vendorUsers: [{ email: "pat@greenleaf.test", name: "Pat Kelly", status: "active" }],
  },
  {
    name: "Anchor Pest Control",
    trade: "pest",
    primaryContact: "Devon Cole",
    primaryEmail: "devon@anchorpest.test",
    primaryPhone: "+1 718 555 0166",
    coiState: "none",
    vendorUsers: [{ email: "devon@anchorpest.test", name: "Devon Cole", status: "invited" }],
  },
  {
    name: "Bright Appliance Repair",
    trade: "appliance",
    primaryContact: "Hank Owens",
    primaryEmail: "hank@brightappliance.test",
    primaryPhone: "+1 347 555 0188",
    coiState: "none",
    vendorUsers: [{ email: "hank@brightappliance.test", name: "Hank Owens", status: "active" }],
  },
  {
    name: "Northstar GC",
    trade: "general",
    primaryContact: "Aisha Brown",
    primaryEmail: "aisha@northstargc.test",
    primaryPhone: "+1 718 555 0150",
    coiState: "active",
    vendorUsers: [{ email: "aisha@northstargc.test", name: "Aisha Brown", status: "active" }],
  },
];

/* -------------------- tenants -------------------- */

interface TenantSeed {
  pIdx: number;
  uIdx: number;
  name: string;
  email: string;
  insurance: "active" | "expiring" | "expired" | "none";
}

const TENANTS: TenantSeed[] = [
  { pIdx: 0, uIdx: 0, name: "Marcus Webb", email: "marcus.webb@tenant.test", insurance: "active" },
  { pIdx: 0, uIdx: 1, name: "Lila Park", email: "lila.park@tenant.test", insurance: "active" },
  { pIdx: 0, uIdx: 2, name: "Dani Liu", email: "dani.liu@tenant.test", insurance: "active" },
  { pIdx: 0, uIdx: 3, name: "Sam Khoury", email: "sam.khoury@tenant.test", insurance: "expiring" },
  { pIdx: 1, uIdx: 0, name: "Ana Ortega", email: "ana.ortega@tenant.test", insurance: "active" },
  { pIdx: 1, uIdx: 1, name: "Greg Sloane", email: "greg.sloane@tenant.test", insurance: "expired" },
  { pIdx: 2, uIdx: 1, name: "Priya Shah", email: "priya.shah@tenant.test", insurance: "active" },
  { pIdx: 2, uIdx: 3, name: "Jordan Wells", email: "jordan.wells@tenant.test", insurance: "none" },
  { pIdx: 3, uIdx: 0, name: "Casey Doan", email: "casey.doan@tenant.test", insurance: "active" },
  { pIdx: 4, uIdx: 1, name: "Mira Stone", email: "mira.stone@tenant.test", insurance: "expiring" },
  { pIdx: 5, uIdx: 0, name: "Theo Reyes", email: "theo.reyes@tenant.test", insurance: "active" },
  { pIdx: 6, uIdx: 0, name: "Jules Vidal", email: "jules.vidal@tenant.test", insurance: "active" },
  { pIdx: 7, uIdx: 0, name: "Imani Cole", email: "imani.cole@tenant.test", insurance: "active" },
];

/* -------------------- work orders -------------------- */

/**
 * Each WO carries the recency in *minutes-since-now* form so the seed
 * always renders as "right now" not "last month." Mix is intentional:
 *  - 2 urgent overdue with active blockers
 *  - 4 in-progress (vendor on-site or remote)
 *  - 4 blocked (waiting on parts, decision, COI, tenant)
 *  - 6 scheduled with dueAt today or tomorrow
 *  - 6 assigned and starting soon
 *  - 5 triaged but not yet assigned
 *  - 8 new (just filed)
 *  - 4 resolved (awaiting verify)
 *  - 3 closed (last week)
 */

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
  /** Due offset in *days* from now. Negative = overdue. */
  dueDays: number;
  /** Created offset in *days* from now. Always negative. */
  createdDays: number;
  /** Updated offset in *minutes* from now. Drives activity recency. */
  updatedMinutes: number;
  /** Optional vendor index for the active assignment. -1 = none. */
  vendorIdx: number;
  /** Force "seen" (acknowledged by the assigned tech). Status in_progress and
   *  beyond are implicitly seen; this opts an earlier-stage WO in. */
  seen?: boolean;
  /** Force a tenant-visible note (sets tenant_updated_at + an external note).
   *  Blocked WOs are implicitly tenant-noted ("waiting on vendor, told tenant"). */
  tenantNote?: boolean;
}

const WORK_ORDERS: WoSeed[] = [
  // ---- urgent overdue + active leaks ----
  { title: "Bathroom ceiling leak — water through 2A", description: "Active drip, tenant has bucket. Drywall stained. Need access today.", status: "blocked", priority: "urgent", pIdx: 0, uIdx: 2, dueDays: -2, createdDays: -3, updatedMinutes: 38, vendorIdx: 0 },
  { title: "No hot water — 3-day outage", description: "Heater not firing. Tenant escalated yesterday. Vendor estimate pending approval.", status: "blocked", priority: "urgent", pIdx: 2, uIdx: 1, dueDays: -1, createdDays: -3, updatedMinutes: 22, vendorIdx: 0 },

  // ---- overdue not-yet-blocked ----
  { title: "Deadbolt jammed — tenant locked out twice", description: "Quicklock dispatched once, deadbolt still resists. Needs replacement.", status: "in_progress", priority: "high", pIdx: 1, uIdx: 0, dueDays: -1, createdDays: -2, updatedMinutes: 12, vendorIdx: 3 },
  { title: "Mailbox lock spinning", description: "Cylinder spinning freely. Tenant cannot get mail.", status: "assigned", priority: "normal", pIdx: 4, uIdx: 2, dueDays: -1, createdDays: -1, updatedMinutes: 95, vendorIdx: 3 },
  { title: "Kitchen sink — standing water", description: "Drain backed up over weekend. Tenant patient but unhappy.", status: "scheduled", priority: "normal", pIdx: 5, uIdx: 0, dueDays: 0, createdDays: -2, updatedMinutes: 140, vendorIdx: 0 },

  // ---- in-progress vendor on-site ----
  { title: "Outlet sparking — kitchen, near sink", description: "Hot. Volt en route. Power killed at panel.", status: "in_progress", priority: "high", pIdx: 2, uIdx: 3, dueDays: 0, createdDays: -1, updatedMinutes: 5, vendorIdx: 1 },
  { title: "Bedroom window stuck", description: "Sash stuck right side. Northstar GC dispatched.", status: "in_progress", priority: "normal", pIdx: 1, uIdx: 1, dueDays: 3, createdDays: -3, updatedMinutes: 90, vendorIdx: 9 },
  { title: "Porch light fixture replacement", description: "Storm damage from last week. Volt on it.", status: "in_progress", priority: "low", pIdx: 4, uIdx: 3, dueDays: 4, createdDays: -2, updatedMinutes: 200, vendorIdx: 1 },
  { title: "Pest treatment — kitchen ants", description: "Anchor scheduled; initial treatment underway.", status: "in_progress", priority: "normal", pIdx: 2, uIdx: 2, dueDays: 2, createdDays: -2, updatedMinutes: 60, vendorIdx: 7 },
  { title: "Caulk bathroom tub", description: "Routine recaulk. Quick visit.", status: "in_progress", priority: "low", pIdx: 0, uIdx: 4, dueDays: 5, createdDays: -4, updatedMinutes: 320, vendorIdx: 5 },

  // ---- blocked ----
  { title: "Garbage disposal jammed — 1404B", description: "Won't spin, hot when checked. Likely needs full unit. Estimate pending.", status: "blocked", priority: "normal", pIdx: 3, uIdx: 2, dueDays: -1, createdDays: -3, updatedMinutes: 480, vendorIdx: 8 },
  { title: "Vacant unit turn — Willow 2", description: "Tenant moved out, flooring damage discovered. Going over budget.", status: "blocked", priority: "normal", pIdx: 7, uIdx: 1, dueDays: 4, createdDays: -4, updatedMinutes: 30, vendorIdx: 9 },

  // ---- scheduled (today + soon) ----
  { title: "Annual smoke detector test — Maple 1A", description: "Code-required annual check. All bedrooms + hallway.", status: "scheduled", priority: "normal", pIdx: 0, uIdx: 0, dueDays: 0, createdDays: -7, updatedMinutes: 480, vendorIdx: 6 },
  { title: "Quarterly HVAC filter swap — Pine Ridge", description: "Routine quarterly change. Tenant unit unaffected.", status: "scheduled", priority: "low", pIdx: 3, uIdx: 1, dueDays: 1, createdDays: -8, updatedMinutes: 720, vendorIdx: 2 },
  { title: "Hallway repaint — Willow 631", description: "Drywall already replaced. Goldcoat scheduled Tuesday.", status: "scheduled", priority: "normal", pIdx: 7, uIdx: 0, dueDays: 3, createdDays: -5, updatedMinutes: 240, vendorIdx: 4 },
  { title: "Roof gutter cleaning — Maple", description: "Overflow during last rain. Full gutter run.", status: "scheduled", priority: "normal", pIdx: 0, uIdx: 3, dueDays: 4, createdDays: -5, updatedMinutes: 540, vendorIdx: 6 },
  { title: "Bathroom exhaust fan replacement", description: "Motor died, mold risk. Apex scheduled.", status: "scheduled", priority: "normal", pIdx: 4, uIdx: 1, dueDays: 6, createdDays: -3, updatedMinutes: 360, vendorIdx: 2 },
  { title: "CO detector quarterly test", description: "All units in 56 Birch.", status: "scheduled", priority: "normal", pIdx: 4, uIdx: 0, dueDays: 2, createdDays: -2, updatedMinutes: 120, vendorIdx: 1 },

  // ---- assigned (recently picked up by a vendor) ----
  { title: "Bedroom radiator clanging — wakes tenant", description: "Loud banging when heat kicks on. Likely air in line.", status: "assigned", priority: "high", pIdx: 1, uIdx: 3, dueDays: 1, createdDays: -1, updatedMinutes: 15, vendorIdx: 2 },
  { title: "Repair drywall hole — bedroom Oak 3", description: "Doorknob hole. Stop missing on the wall.", status: "assigned", priority: "normal", pIdx: 1, uIdx: 2, dueDays: 3, createdDays: -2, updatedMinutes: 75, vendorIdx: 9 },
  { title: "Replace stove burner — Maple 1B", description: "Front-right burner not heating. Bright Appliance.", status: "assigned", priority: "normal", pIdx: 0, uIdx: 1, dueDays: 2, createdDays: -1, updatedMinutes: 180, vendorIdx: 8 },
  { title: "Replace dryer vent screen", description: "Lint screen torn.", status: "assigned", priority: "low", pIdx: 2, uIdx: 5, dueDays: 9, createdDays: -2, updatedMinutes: 280, vendorIdx: 8 },
  { title: "Bathroom mirror replacement — Sycamore 4F", description: "Cracked, unsafe.", status: "assigned", priority: "normal", pIdx: 6, uIdx: 2, dueDays: 5, createdDays: -1, updatedMinutes: 410, vendorIdx: 9 },

  // ---- triaged ----
  { title: "Refrigerator buzzing", description: "New noise from fridge. Cooling normal. Bright Appliance triage tomorrow.", status: "triaged", priority: "normal", pIdx: 6, uIdx: 1, dueDays: 2, createdDays: -1, updatedMinutes: 50, vendorIdx: -1 },
  { title: "Hallway light flickering", description: "Loose connection most likely. Needs Volt check.", status: "triaged", priority: "normal", pIdx: 6, uIdx: 1, dueDays: 4, createdDays: 0, updatedMinutes: 35, vendorIdx: -1 },
  { title: "Tenant noise complaint — 1A", description: "Complaint about footsteps from above. Possible rug recommendation.", status: "triaged", priority: "low", pIdx: 0, uIdx: 0, dueDays: 10, createdDays: -2, updatedMinutes: 600, vendorIdx: -1 },
  { title: "Squeaky stair tread — Oak 2", description: "Tenant requests fix when convenient.", status: "triaged", priority: "low", pIdx: 6, uIdx: 2, dueDays: 21, createdDays: 0, updatedMinutes: 220, vendorIdx: -1 },
  { title: "Vacant unit turn — Pine B", description: "Tenant moved out yesterday. Standard turn.", status: "triaged", priority: "normal", pIdx: 7, uIdx: 1, dueDays: 8, createdDays: -1, updatedMinutes: 16, vendorIdx: -1 },

  // ---- new (just filed) ----
  { title: "Ceiling fan install request — Birch 2", description: "Tenant offering to pay. Confirm wiring + landlord OK.", status: "new", priority: "low", pIdx: 4, uIdx: 1, dueDays: 14, createdDays: 0, updatedMinutes: 12, vendorIdx: -1 },
  { title: "Cracked entry tile — Pine A", description: "Two tiles cracked near front door.", status: "new", priority: "normal", pIdx: 3, uIdx: 2, dueDays: 10, createdDays: 0, updatedMinutes: 90, vendorIdx: -1 },
  { title: "Garage door opener intermittent", description: "Works ~80% of the time. May be sensor.", status: "new", priority: "normal", pIdx: 4, uIdx: 0, dueDays: 7, createdDays: 0, updatedMinutes: 175, vendorIdx: -1 },
  { title: "Cabinet hinge broken — Birch 1", description: "Sheared. Door won't close flush.", status: "new", priority: "low", pIdx: 4, uIdx: 0, dueDays: 12, createdDays: 0, updatedMinutes: 280, vendorIdx: -1 },
  { title: "Bedroom outlet not working", description: "Tested with phone charger, no power.", status: "new", priority: "normal", pIdx: 5, uIdx: 1, dueDays: 3, createdDays: 0, updatedMinutes: 8, vendorIdx: -1 },
  { title: "Sliding closet door off track", description: "Door drags on floor when opened.", status: "new", priority: "low", pIdx: 2, uIdx: 0, dueDays: 7, createdDays: 0, updatedMinutes: 45, vendorIdx: -1 },
  { title: "Front door weather stripping", description: "Light visible at bottom. Heat loss complaint.", status: "new", priority: "low", pIdx: 1, uIdx: 0, dueDays: 14, createdDays: 0, updatedMinutes: 110, vendorIdx: -1 },
  { title: "Bathroom faucet handle loose", description: "5-minute job. Will batch with other Sycamore work.", status: "new", priority: "low", pIdx: 6, uIdx: 1, dueDays: 14, createdDays: 0, updatedMinutes: 200, vendorIdx: -1 },

  // ---- resolved (awaiting verify) ----
  { title: "Stove burner replacement — Maple 1B", description: "Bright swapped element. Tested with pot.", status: "resolved", priority: "normal", pIdx: 0, uIdx: 1, dueDays: -3, createdDays: -6, updatedMinutes: 240, vendorIdx: 8 },
  { title: "Replace kitchen aerator — Elm 2A", description: "Clogged aerator swapped.", status: "resolved", priority: "low", pIdx: 2, uIdx: 4, dueDays: -2, createdDays: -5, updatedMinutes: 380, vendorIdx: 0 },
  { title: "Bathroom drain — hair clog cleared", description: "Snaked, water flow normal. Tenant signed off.", status: "resolved", priority: "low", pIdx: 6, uIdx: 0, dueDays: -2, createdDays: -4, updatedMinutes: 540, vendorIdx: 0 },
  { title: "Breaker reset — bedroom outlets", description: "Tripped breaker, no damage. Reset and tested.", status: "resolved", priority: "normal", pIdx: 5, uIdx: 0, dueDays: -3, createdDays: -5, updatedMinutes: 600, vendorIdx: 1 },

  // ---- verified ----
  { title: "Fence section repair — Willow", description: "Storm damage. Two posts replaced. Walked, holds.", status: "verified", priority: "normal", pIdx: 7, uIdx: 2, dueDays: -5, createdDays: -10, updatedMinutes: 1080, vendorIdx: 9 },
  { title: "Annual furnace tune-up — Pine", description: "Yearly preventive. Filter, ignitor, draft test.", status: "verified", priority: "low", pIdx: 3, uIdx: 0, dueDays: -7, createdDays: -14, updatedMinutes: 1440, vendorIdx: 2 },

  // ---- closed (recent) ----
  { title: "Dishwasher filter swap — Maple 2A", description: "Routine. On-site complete.", status: "closed", priority: "low", pIdx: 0, uIdx: 3, dueDays: -8, createdDays: -16, updatedMinutes: 2880, vendorIdx: 8 },
  { title: "Window screen replacement — Cedar A", description: "Torn screen replaced.", status: "closed", priority: "low", pIdx: 5, uIdx: 0, dueDays: -10, createdDays: -18, updatedMinutes: 4320, vendorIdx: 9 },

  // ---- cancelled ----
  { title: "Doormat install (rescinded)", description: "Tenant rescinded request.", status: "cancelled", priority: "low", pIdx: 5, uIdx: 1, dueDays: 5, createdDays: -5, updatedMinutes: 1440, vendorIdx: -1 },

  // ---- Sojo North/South — Oscar's buildings (pIdx 8, 9) ----
  // A realistic spread: seen, tenant-updated, waiting, aging.
  { title: "Suite 201 — AC not cooling", description: "Tenant reports office at 80°F. Oscar on site checking the rooftop unit.", status: "in_progress", priority: "high", pIdx: 8, uIdx: 0, dueDays: 0, createdDays: -1, updatedMinutes: 18, vendorIdx: -1, tenantNote: true },
  { title: "Lobby door closer broken", description: "North lobby door slams. Closer arm bent. Waiting on replacement part.", status: "blocked", priority: "normal", pIdx: 8, uIdx: 3, dueDays: 1, createdDays: -4, updatedMinutes: 220, vendorIdx: -1 },
  { title: "Parking lot light out — NE corner", description: "Tenant safety concern after dark. Submitted last week, not yet picked up.", status: "assigned", priority: "normal", pIdx: 8, uIdx: 1, dueDays: -2, createdDays: -11, updatedMinutes: 60, vendorIdx: -1 },
  { title: "Restroom faucet won't shut off — Ste 203", description: "Constant trickle, hot side. Just came in.", status: "new", priority: "normal", pIdx: 8, uIdx: 2, dueDays: 2, createdDays: 0, updatedMinutes: 9, vendorIdx: -1 },
  { title: "Suite B — thermostat unresponsive", description: "Tenant can't adjust temp. Oscar acknowledged, scheduling a visit.", status: "assigned", priority: "normal", pIdx: 9, uIdx: 1, dueDays: 1, createdDays: -2, updatedMinutes: 40, vendorIdx: -1, seen: true },
  { title: "Exterior signage panel cracked", description: "South entrance monument sign cracked. Aesthetic, low urgency, but lingering.", status: "new", priority: "low", pIdx: 9, uIdx: 0, dueDays: 7, createdDays: -14, updatedMinutes: 300, vendorIdx: -1 },
  { title: "Suite C — ceiling tile water stain", description: "Possible slow roof leak above Suite C. Waiting on roofer estimate.", status: "blocked", priority: "high", pIdx: 9, uIdx: 2, dueDays: 0, createdDays: -3, updatedMinutes: 120, vendorIdx: 8, tenantNote: true },

  // ---- Fernando aging (existing buildings, open >7d) ----
  { title: "Stairwell handrail loose — Elm 3A", description: "Wobbles, safety issue. Submitted over a week ago, still open.", status: "assigned", priority: "normal", pIdx: 2, uIdx: 4, dueDays: -3, createdDays: -9, updatedMinutes: 150, vendorIdx: -1 },
  { title: "Basement storage door won't lock — Birch", description: "Filed 12 days ago. Keeps slipping down the list.", status: "triaged", priority: "low", pIdx: 4, uIdx: 2, dueDays: 4, createdDays: -12, updatedMinutes: 800, vendorIdx: -1 },
];

/* -------------------- inspections + findings -------------------- */

interface InsSeed {
  kind: "move_in" | "move_out" | "annual" | "ad_hoc";
  status: "scheduled" | "in_progress" | "completed" | "reviewed" | "cancelled";
  pIdx: number;
  uIdx: number;
  /** Scheduled offset in days. */
  scheduledDays: number;
  createdDays: number;
  findings?: Array<{ area: string; description: string; severity: "info" | "observation" | "actionable" | "critical"; pass: boolean }>;
}

const INSPECTIONS: InsSeed[] = [
  { kind: "annual", status: "scheduled", pIdx: 0, uIdx: 0, scheduledDays: -1, createdDays: -10 },
  { kind: "move_out", status: "scheduled", pIdx: 2, uIdx: 3, scheduledDays: -1, createdDays: -7 },
  { kind: "move_in", status: "scheduled", pIdx: 1, uIdx: 0, scheduledDays: 0, createdDays: -3 },
  { kind: "annual", status: "scheduled", pIdx: 3, uIdx: 0, scheduledDays: 0, createdDays: -7 },
  {
    kind: "ad_hoc",
    status: "in_progress",
    pIdx: 5,
    uIdx: 1,
    scheduledDays: -1,
    createdDays: -2,
    findings: [
      { area: "kitchen", description: "Cabinet under sink stained — possible past leak.", severity: "actionable", pass: false },
      { area: "bathroom", description: "Caulk failing around tub.", severity: "observation", pass: true },
    ],
  },
  {
    kind: "annual",
    status: "in_progress",
    pIdx: 7,
    uIdx: 2,
    scheduledDays: 0,
    createdDays: -1,
    findings: [{ area: "exterior", description: "Fence post leaning at SW corner.", severity: "actionable", pass: false }],
  },
  {
    kind: "annual",
    status: "completed",
    pIdx: 4,
    uIdx: 1,
    scheduledDays: -3,
    createdDays: -5,
    findings: [
      { area: "kitchen", description: "Range hood filter coated.", severity: "actionable", pass: false },
      { area: "bathroom", description: "Exhaust fan loud, motor wear.", severity: "actionable", pass: false },
      { area: "smoke_detector", description: "All units tested OK.", severity: "info", pass: true },
    ],
  },
];

/* -------------------- projects -------------------- */

interface PrjSeed {
  name: string;
  description: string;
  status: "planning" | "active" | "punch_list" | "closing" | "closed";
  kind: "general" | "unit_turn" | "capex" | "renovation" | "make_ready";
  pIdx: number;
  targetDays: number;
  createdDays: number;
}

const PROJECTS: PrjSeed[] = [
  { name: "Maple Lane lobby refresh", description: "New paint, lighting, intercom panel.", status: "active", kind: "capex", pIdx: 0, targetDays: 28, createdDays: -22 },
  { name: "Oak St #4 turn", description: "Full turn: paint, clean, replace fridge, refinish hardwood.", status: "punch_list", kind: "unit_turn", pIdx: 1, targetDays: 5, createdDays: -25 },
  { name: "CO detector replacement run", description: "Renovation: replace all detectors > 7yr old, building-wide.", status: "planning", kind: "renovation", pIdx: 2, targetDays: 45, createdDays: -4 },
  { name: "Pine Ridge make-ready", description: "Make-ready turn for new tenant move-in.", status: "active", kind: "make_ready", pIdx: 3, targetDays: 12, createdDays: -8 },
];

/* -------------------- task templates (recurring) -------------------- */

interface TemplateSeed {
  name: string;
  description: string;
  cron: string;
  defaultTitle: string;
  defaultPriority: "low" | "normal" | "high";
  pIdx: number;
  uIdx: number;
  lastFiredDays: number;
  nextFireDays: number;
  timesFired: number;
}

const TEMPLATES: TemplateSeed[] = [
  // Crons match the cadence presets in /admin/templates so the list renders
  // friendly labels ("Weekly · Mondays 9am"), not raw cron.
  { name: "Weekly property walk", description: "Walk the property: grounds, common areas, mechanical rooms. Photo anything off.", cron: "0 9 * * 1", defaultTitle: "Weekly property walk", defaultPriority: "normal", pIdx: 0, uIdx: 0, lastFiredDays: -2, nextFireDays: 5, timesFired: 31 },
  { name: "Quarterly HVAC filter swap", description: "Replace HVAC filters every 90 days.", cron: "0 9 1 1,4,7,10 *", defaultTitle: "Quarterly HVAC filter swap", defaultPriority: "low", pIdx: 3, uIdx: 1, lastFiredDays: -7, nextFireDays: 83, timesFired: 6 },
  { name: "Monthly smoke detector test", description: "Code-required monthly smoke detector battery test.", cron: "0 9 1 * *", defaultTitle: "Monthly smoke detector test", defaultPriority: "normal", pIdx: 0, uIdx: 0, lastFiredDays: -2, nextFireDays: 28, timesFired: 14 },
  { name: "Weekly common area cleaning", description: "Mop lobby, wipe surfaces, take out trash.", cron: "0 9 * * 5", defaultTitle: "Common area cleaning", defaultPriority: "low", pIdx: 0, uIdx: 0, lastFiredDays: -1, nextFireDays: 6, timesFired: 52 },
  { name: "Annual fire extinguisher inspection", description: "Yearly tag check + recharge if needed.", cron: "0 9 1 1 *", defaultTitle: "Annual fire extinguisher inspection", defaultPriority: "normal", pIdx: 4, uIdx: 0, lastFiredDays: -120, nextFireDays: 205, timesFired: 3 },
];

/* -------------------- invoices -------------------- */

interface InvoiceSeed {
  vendorIdx: number;
  woIdx: number;
  invoiceNumber: string;
  totalCents: number;
  status: "draft" | "submitted" | "approved" | "paid" | "disputed" | "void";
  submittedHoursAgo: number;
  notes?: string;
}

const INVOICES: InvoiceSeed[] = [
  { vendorIdx: 0, woIdx: 0, invoiceNumber: "STK-3041", totalCents: 145_000, status: "submitted", submittedHoursAgo: 6, notes: "Plumbing labor + drywall access" },
  { vendorIdx: 0, woIdx: 1, invoiceNumber: "STK-3044", totalCents: 89_500, status: "submitted", submittedHoursAgo: 14 },
  { vendorIdx: 1, woIdx: 5, invoiceNumber: "VOLT-2238", totalCents: 24_000, status: "submitted", submittedHoursAgo: 22 },
  { vendorIdx: 4, woIdx: 14, invoiceNumber: "GLD-880", totalCents: 540_000, status: "disputed", submittedHoursAgo: 48, notes: "Above threshold — needs revised quote" },
  { vendorIdx: 8, woIdx: 38, invoiceNumber: "BAP-1140", totalCents: 18_750, status: "approved", submittedHoursAgo: 36 },
  { vendorIdx: 0, woIdx: 39, invoiceNumber: "STK-3022", totalCents: 8_500, status: "paid", submittedHoursAgo: 96 },
  { vendorIdx: 1, woIdx: 41, invoiceNumber: "VOLT-2192", totalCents: 14_200, status: "paid", submittedHoursAgo: 120 },
  { vendorIdx: 9, woIdx: 42, invoiceNumber: "NS-5810", totalCents: 36_400, status: "approved", submittedHoursAgo: 64 },
];

/* -------------------- approvals -------------------- */

interface ApSeed {
  reason: string;
  woIdx: number;
  amountCents: number;
  notes: string;
  hoursAgo: number;
}

const APPROVALS: ApSeed[] = [
  { reason: "estimate_over_threshold", woIdx: 0, amountCents: 145_000, notes: "Stark estimate includes drywall repair after access.", hoursAgo: 6 },
  { reason: "estimate_over_threshold", woIdx: 1, amountCents: 89_500, notes: "Replace water heater. Brand options attached.", hoursAgo: 18 },
  { reason: "vendor_change", woIdx: 5, amountCents: 32_000, notes: "Switching to Volt for after-hours response.", hoursAgo: 3 },
  { reason: "budget_exception", woIdx: 11, amountCents: 27_500, notes: "Vacant turn going over due to flooring damage.", hoursAgo: 1 },
  { reason: "invoice_manager_review", woIdx: 0, amountCents: 145_000, notes: "Manager band invoice — STK-3041 awaiting approval.", hoursAgo: 36 },
];

/* -------------------- comments -------------------- */

interface CommentSeed {
  woIdx: number;
  body: string;
  actor: "AR" | "SY" | "DM" | "MP" | "vendor";
  visibility: "internal" | "external";
  minutesAgo: number;
}

const COMMENTS: CommentSeed[] = [
  { woIdx: 0, body: "Reached Stark — they can be on-site by 2pm. Tenant notified.", actor: "AR", visibility: "internal", minutesAgo: 38 },
  { woIdx: 0, body: "On-site. Confirmed source — supply line behind tub. Pulling parts list now.", actor: "vendor", visibility: "external", minutesAgo: 18 },
  { woIdx: 1, body: "Pulled the spec sheet — going with the 50gal high-efficiency. Need approval to release PO.", actor: "DM", visibility: "internal", minutesAgo: 22 },
  { woIdx: 2, body: "Quicklock confirmed they have the cylinder in stock. ETA 1hr.", actor: "SY", visibility: "internal", minutesAgo: 95 },
  { woIdx: 2, body: "On site. Replacing cylinder + strike plate.", actor: "vendor", visibility: "external", minutesAgo: 12 },
  { woIdx: 5, body: "Volt en route. Power killed at panel; tenant safe.", actor: "AR", visibility: "internal", minutesAgo: 8 },
  { woIdx: 6, body: "Sash freed; sticking on weatherstrip. Re-cutting strip.", actor: "vendor", visibility: "external", minutesAgo: 90 },
  { woIdx: 8, body: "Ant trail traced to gap under sink. Sealing + spot treatment today.", actor: "vendor", visibility: "external", minutesAgo: 60 },
  { woIdx: 10, body: "Held — Bright says new disposal unit + relocation. Need approval for $275 over base.", actor: "MP", visibility: "internal", minutesAgo: 480 },
  { woIdx: 11, body: "Flooring under fridge was rotted. Adding $1,200 to scope.", actor: "vendor", visibility: "external", minutesAgo: 30 },
  { woIdx: 11, body: "Approved verbally. Adding to budget exception request.", actor: "DM", visibility: "internal", minutesAgo: 22 },
  { woIdx: 18, body: "Air bleed scheduled before next cold snap.", actor: "SY", visibility: "internal", minutesAgo: 15 },
  { woIdx: 23, body: "Tenant says noise has continued. Going to walk this w/ unit 1A and 2A both.", actor: "AR", visibility: "internal", minutesAgo: 220 },
  { woIdx: 28, body: "Filed by tenant via portal — confirmed receipt.", actor: "SY", visibility: "internal", minutesAgo: 12 },
  { woIdx: 34, body: "Stove tested fine on all 4 burners. Closing.", actor: "vendor", visibility: "external", minutesAgo: 240 },
  { woIdx: 4, body: "Vendor confirmed for tomorrow 9am. Tenant requested noon — checking.", actor: "SY", visibility: "internal", minutesAgo: 140 },
];

/* -------------------- notifications -------------------- */

interface NotifSeed {
  kind: string;
  subject: string;
  body: string;
  targetWoIdx?: number;
  minutesAgo: number;
}

const NOTIFICATIONS: NotifSeed[] = [
  { kind: "wo_assigned", subject: "WO-1003 assigned to Quicklock", body: "Tony Bauer accepted the deadbolt repair.", targetWoIdx: 2, minutesAgo: 12 },
  { kind: "approval_requested", subject: "Approval: $1,450 estimate on WO-1001", body: "Stark Plumbing submitted estimate over your $1,000 threshold.", targetWoIdx: 0, minutesAgo: 38 },
  { kind: "wo_blocked", subject: "WO-1011 blocked — going over budget", body: "Vacant turn at Willow #1. Flooring discovered rotted.", targetWoIdx: 11, minutesAgo: 30 },
  { kind: "comment_external", subject: "Stark commented on WO-1001", body: "On-site. Confirmed source — supply line behind tub.", targetWoIdx: 0, minutesAgo: 18 },
  { kind: "wo_assigned", subject: "WO-1019 assigned to Apex HVAC", body: "Renata Ruiz picked up the radiator clanging.", targetWoIdx: 18, minutesAgo: 15 },
  { kind: "approval_requested", subject: "Approval: $275 over budget on WO-1011", body: "Maya flagged a budget exception.", targetWoIdx: 11, minutesAgo: 60 },
  { kind: "wo_resolved", subject: "WO-1021 resolved — needs verify walk", body: "Stove burner replacement complete.", targetWoIdx: 34, minutesAgo: 240 },
  { kind: "coi_expiring", subject: "COI expiring in 14d: Apex HVAC", body: "Automated reminder. No vendor action yet.", minutesAgo: 720 },
  { kind: "inspection_in_progress", subject: "Annual inspection started — 631 Willow #3", body: "Diego started the walk-through.", minutesAgo: 60 },
  { kind: "template_spawned", subject: "Weekly cleaning spawned — Maple lobby", body: "WO created from template; assigned to SparkleClean.", minutesAgo: 90 },
  { kind: "tenant_insurance_received", subject: "Tenant insurance uploaded — Elm 2B", body: "Policy valid through next March.", minutesAgo: 180 },
  { kind: "wo_overdue", subject: "WO-1003 overdue 1d — deadbolt", body: "Tony was on-site once; will return today.", targetWoIdx: 2, minutesAgo: 480 },
  { kind: "coi_expired", subject: "COI expired: Greenleaf Landscaping", body: "Vendor blocked from new assignments.", minutesAgo: 1440 },
  { kind: "vendor_accepted", subject: "Goldcoat accepted WO-1015 (hallway repaint)", body: "Scheduled for next week.", targetWoIdx: 14, minutesAgo: 1080 },
  { kind: "inspection_finding", subject: "Finding logged — 56 Birch #2", body: "Range hood filter coated; spawning WO.", minutesAgo: 1500 },
  { kind: "wo_assigned", subject: "WO-1010 assigned to SparkleClean", body: "Bathroom caulk routine.", targetWoIdx: 9, minutesAgo: 320 },
  { kind: "approval_decided", subject: "Approval rejected: $5,400 hallway repaint", body: "Awaiting revised quote.", targetWoIdx: 14, minutesAgo: 2160 },
  { kind: "comment_internal", subject: "Sara commented on WO-1023", body: "Going to walk this w/ unit 1A and 2A both.", targetWoIdx: 23, minutesAgo: 220 },
  { kind: "wo_created", subject: "New WO: Bedroom outlet not working", body: "Filed via tenant portal.", targetWoIdx: 28, minutesAgo: 8 },
  { kind: "wo_blocked", subject: "WO-1011 — escalated", body: "Project lead notified.", targetWoIdx: 11, minutesAgo: 25 },
];

/* -------------------- runner -------------------- */

async function main() {
  console.log(`[db:seed] org_id = ${ORG_ID}`);
  console.log(`[db:seed] anchored to ${NOW.toISOString()}`);

  if (WIPE_ORPHANS) {
    console.log(`[db:seed] wiping orphan org_ids (org_audit_walkthrough, '--')...`);
    const orphans = ["org_audit_walkthrough", "--"];
    for (const o of orphans) {
      await wipeOrg(o);
    }
  }

  console.log(`[db:seed] wiping target org rows...`);
  await wipeOrg(ORG_ID);

  /* ---- staff users (preserve any pre-existing, append phantoms) ---- */
  console.log(`[db:seed] ensuring phantom staff teammates...`);
  const staffMap = new Map<string, { id: string; name: string; initials: string }>();
  // Existing real users first
  const existingUsers = await sql<{ id: string; clerk_user_id: string; name: string | null; email: string }[]>`
    select id, clerk_user_id, name, email from users where org_id = ${ORG_ID}
  `;
  for (const u of existingUsers) {
    const display = u.name ?? u.email.split("@")[0] ?? "user";
    const initials =
      display
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("") || "??";
    staffMap.set(initials, { id: u.id, name: display, initials });
    staffMap.set(u.clerk_user_id, { id: u.id, name: display, initials });
  }
  if (existingUsers.length > 0) {
    console.log(`[db:seed]   ${existingUsers.length} existing real user(s): ${existingUsers.map((u) => u.email).join(", ")}`);
  }

  for (const s of PHANTOM_STAFF) {
    const [row] = await sql<{ id: string }[]>`
      insert into users (org_id, clerk_user_id, email, name, role, phone)
      values (${ORG_ID}, ${s.clerkUserId}, ${s.email}, ${s.name}, ${s.role}, ${s.phone ?? null})
      on conflict (clerk_user_id, org_id) do update set
        name = excluded.name, email = excluded.email, role = excluded.role,
        phone = excluded.phone
      returning id
    `;
    staffMap.set(s.initials, { id: row!.id, name: s.name, initials: s.initials });
  }

  // The notifications recipient: prefer the first real user, fall back to a phantom.
  const recipient =
    existingUsers[0] ??
    (() => {
      const fb = staffMap.get(PHANTOM_STAFF[0]!.initials)!;
      return { id: fb.id, name: fb.name, email: "" };
    })();
  console.log(`[db:seed]   notifications will attach to ${recipient.name ?? recipient.email}`);

  // For the audit log, who's "AR"? If a real user exists, they're AR-equivalent.
  // Otherwise use the first phantom.
  const principalUserId = existingUsers[0]?.id ?? staffMap.get("SY")!.id;
  staffMap.set("AR", {
    id: principalUserId,
    name: existingUsers[0]?.name ?? "Adam Rencher",
    initials: "AR",
  });

  /* ---- properties + units ---- */
  console.log(`[db:seed] inserting ${PROPERTIES.length} properties + units...`);
  // Coverage: Sojo → Oscar, everything else → Fernando. Sets the property's
  // default_assignee_user_id so new WOs auto-route, and lets us assign the
  // existing seeded WOs to the right tech.
  const fernandoId = staffMap.get("FR")!.id;
  const oscarId = staffMap.get("OD")!.id;
  const propertyIds: string[] = [];
  const propertyTechIds: string[] = [];
  const unitIdsByProperty: string[][] = [];
  for (const p of PROPERTIES) {
    const coveringTechId = p.name.startsWith("Sojo") ? oscarId : fernandoId;
    const [row] = await sql<{ id: string }[]>`
      insert into properties (
        org_id, name, address_line1, city, state, postal_code, country,
        timezone, default_assignee_user_id
      )
      values (
        ${ORG_ID}, ${p.name}, ${p.addressLine1}, ${p.city}, ${p.state},
        ${p.postalCode}, 'US', 'America/Denver', ${coveringTechId}
      )
      returning id
    `;
    propertyIds.push(row!.id);
    propertyTechIds.push(coveringTechId);
    const unitIds: string[] = [];
    for (const label of p.units) {
      const [u] = await sql<{ id: string }[]>`
        insert into units (org_id, property_id, label)
        values (${ORG_ID}, ${row!.id}, ${label})
        returning id
      `;
      unitIds.push(u!.id);
    }
    unitIdsByProperty.push(unitIds);
  }
  const totalUnits = unitIdsByProperty.flat().length;
  console.log(`[db:seed]   ${totalUnits} units across ${PROPERTIES.length} properties`);

  /* ---- vendors + COIs + vendor_users ---- */
  console.log(`[db:seed] inserting ${VENDORS.length} vendors + COIs + vendor_users...`);
  const vendorIds: string[] = [];
  const vendorUserIdsByVendor: string[][] = [];
  for (let i = 0; i < VENDORS.length; i++) {
    const v = VENDORS[i]!;
    const [row] = await sql<{ id: string }[]>`
      insert into vendors (
        org_id, name, primary_contact_name, primary_email, primary_phone,
        trade, status, notes
      )
      values (
        ${ORG_ID}, ${v.name}, ${v.primaryContact}, ${v.primaryEmail}, ${v.primaryPhone},
        ${v.trade}, 'active', ${"Trade: " + v.trade}
      )
      returning id
    `;
    vendorIds.push(row!.id);

    if (v.coiState !== "none") {
      const expiresAt =
        v.coiState === "active"
          ? dFuture(180)
          : v.coiState === "expiring"
            ? dFuture(15)
            : d(10);
      const status =
        v.coiState === "active"
          ? "active"
          : v.coiState === "expiring"
            ? "expiring"
            : "expired";
      await sql`
        insert into vendor_cois (
          org_id, vendor_id, policy_number, carrier, coverage_amount_cents,
          effective_at, expires_at, status, uploaded_by_user_id
        )
        values (
          ${ORG_ID}, ${row!.id}, ${`POL-${10000 + i}`}, 'Hartford Liability', '100000000',
          ${d(180)}, ${expiresAt}, ${status}, ${principalUserId}
        )
      `;
    }

    const userIds: string[] = [];
    for (const vu of v.vendorUsers) {
      const [vur] = await sql<{ id: string }[]>`
        insert into vendor_users (org_id, vendor_id, email, name, status, last_signed_in_at)
        values (${ORG_ID}, ${row!.id}, ${vu.email}, ${vu.name}, ${vu.status ?? "active"}, ${vu.status === "invited" ? null : h(Math.random() * 48)})
        returning id
      `;
      userIds.push(vur!.id);
    }
    vendorUserIdsByVendor.push(userIds);
  }

  /* ---- tenant_users + tenant_insurance ---- */
  console.log(`[db:seed] inserting ${TENANTS.length} tenants + insurance policies...`);
  // Captured for the tenant-app demo block below (resident-reported WOs).
  let demoTenant: { id: string; unitId: string } | null = null;
  for (const t of TENANTS) {
    const propertyUnits = unitIdsByProperty[t.pIdx];
    if (!propertyUnits) continue;
    const unitId = propertyUnits[t.uIdx];
    if (!unitId) continue;
    const [tu] = await sql<{ id: string }[]>`
      insert into tenant_users (org_id, unit_id, email, name, status, last_signed_in_at)
      values (${ORG_ID}, ${unitId}, ${t.email}, ${t.name}, 'active', ${h(Math.random() * 168)})
      returning id
    `;
    if (t.email === "marcus.webb@tenant.test") demoTenant = { id: tu!.id, unitId };
    if (t.insurance !== "none") {
      const expiresAt =
        t.insurance === "active"
          ? dFuture(200 + Math.floor(Math.random() * 60))
          : t.insurance === "expiring"
            ? dFuture(14)
            : d(5);
      const status = t.insurance === "active" ? "active" : t.insurance === "expiring" ? "expiring" : "expired";
      await sql`
        insert into tenant_insurance_policies (
          org_id, tenant_user_id, unit_id, policy_number, carrier,
          coverage_amount_cents, effective_at, expires_at, status, uploaded_by_tenant_user_id
        )
        values (
          ${ORG_ID}, ${tu!.id}, ${unitId}, ${`REN-${20000 + Math.floor(Math.random() * 9999)}`},
          'Lemonade Renters', '30000000', ${d(180)}, ${expiresAt}, ${status}, ${tu!.id}
        )
      `;
    }
  }

  /* ---- work orders + assignments + costs + audit ---- */
  console.log(`[db:seed] inserting ${WORK_ORDERS.length} work orders...`);
  const woIds: string[] = [];
  for (let i = 0; i < WORK_ORDERS.length; i++) {
    const w = WORK_ORDERS[i]!;
    const number = 1001 + i;
    const propertyId = propertyIds[w.pIdx]!;
    const unitId = unitIdsByProperty[w.pIdx]![w.uIdx]!;
    const dueAt = dFuture(w.dueDays);
    const createdAt = d(Math.max(1, -w.createdDays));
    const updatedAt = m(w.updatedMinutes);
    const completedAt =
      w.status === "closed" || w.status === "resolved" || w.status === "verified"
        ? m(Math.min(w.updatedMinutes, 2880))
        : null;
    const startedAt =
      w.status === "in_progress" ||
      w.status === "resolved" ||
      w.status === "verified" ||
      w.status === "closed"
        ? h(Math.max(2, Math.random() * 24))
        : null;

    // Operator-model signals. "Seen" = the assigned tech opened it: implied
    // for in_progress and beyond, opt-in earlier via w.seen. "Tenant updated"
    // = a tenant-visible note went out: implied for blocked (waiting → told
    // the tenant), opt-in via w.tenantNote. Both only on open WOs.
    const isOpen = ["new", "triaged", "assigned", "scheduled", "in_progress", "blocked"].includes(w.status);
    const seen = w.seen || ["in_progress", "resolved", "verified", "closed"].includes(w.status);
    const tenantUpdated = isOpen && (w.tenantNote || w.status === "blocked");
    const coveringTechId = propertyTechIds[w.pIdx]!;
    const acknowledgedAt = isOpen && seen ? (startedAt ?? updatedAt) : null;
    const tenantUpdatedAt = tenantUpdated ? m(Math.max(5, w.updatedMinutes - 20)) : null;

    const [row] = await sql<{ id: string }[]>`
      insert into work_orders (
        org_id, number, title, description, kind, status, priority,
        property_id, unit_id, due_at, started_at, completed_at,
        created_at, updated_at, created_by_user_id,
        acknowledged_at, acknowledged_by_user_id, tenant_updated_at
      )
      values (
        ${ORG_ID}, ${number}, ${w.title}, ${w.description},
        'work_order', ${w.status}, ${w.priority},
        ${propertyId}, ${unitId}, ${dueAt}, ${startedAt}, ${completedAt},
        ${createdAt}, ${updatedAt}, ${principalUserId},
        ${acknowledgedAt}, ${acknowledgedAt ? coveringTechId : null}, ${tenantUpdatedAt}
      )
      returning id
    `;
    woIds.push(row!.id);

    /* Assignments. The covering tech owns the WO (most-recent active assignee
     * → shown as the row owner). A dispatched vendor, if any, is an earlier
     * assignment visible in the drawer but not the row owner. */
    if (w.vendorIdx >= 0) {
      await sql`
        insert into assignments (
          org_id, target_type, target_id, assignee_type, assignee_id,
          assigned_by_user_id, assigned_at
        )
        values (
          ${ORG_ID}, 'work_order', ${row!.id}, 'vendor', ${vendorIds[w.vendorIdx]!},
          ${principalUserId}, ${createdAt}
        )
      `;
    }
    await sql`
      insert into assignments (
        org_id, target_type, target_id, assignee_type, assignee_id,
        assigned_by_user_id, assigned_at
      )
      values (
        ${ORG_ID}, 'work_order', ${row!.id}, 'user', ${coveringTechId},
        ${principalUserId}, ${updatedAt}
      )
    `;

    /* Tenant-visible note backing the tenant_updated_at stamp. */
    if (tenantUpdatedAt) {
      await sql`
        insert into comments (
          org_id, target_type, target_id, body, actor_type, actor_user_id,
          visibility, created_at, updated_at
        )
        values (
          ${ORG_ID}, 'work_order', ${row!.id},
          ${"Update for the tenant: we're on it — will follow up with next steps."},
          'user', ${coveringTechId}, 'external', ${tenantUpdatedAt}, ${tenantUpdatedAt}
        )
      `;
    }

    /* costs — completed/in_progress WOs get a labor cost. */
    if (w.status === "resolved" || w.status === "verified" || w.status === "closed") {
      const amt = 5000 + Math.floor(Math.random() * 45000);
      await sql`
        insert into task_costs (org_id, work_order_id, kind, description, amount_cents)
        values (${ORG_ID}, ${row!.id}, 'labor', 'Vendor labor', ${String(amt)})
      `;
    }
    if (w.status === "in_progress" && Math.random() > 0.5) {
      const amt = 3000 + Math.floor(Math.random() * 8000);
      await sql`
        insert into task_costs (org_id, work_order_id, kind, description, amount_cents, created_at)
        values (${ORG_ID}, ${row!.id}, 'materials', 'Parts en route', ${String(amt)}, ${m(w.updatedMinutes + 5)})
      `;
    }

    /* audit — created at createdAt, status_changed at updatedAt for non-new. */
    const createdActorInitials = pick(["AR", "SY", "DM", "MP"]);
    const createdActor = staffMap.get(createdActorInitials);
    await sql`
      insert into audit_log (
        org_id, target_type, target_id, action, actor_type,
        actor_user_id, diff, created_at, updated_at
      )
      values (
        ${ORG_ID}, 'work_order', ${row!.id}, 'created', 'user',
        ${createdActor?.id ?? null},
        ${sql.json({ to: { status: "new", title: w.title } })},
        ${createdAt}, ${createdAt}
      )
    `;
    if (w.status !== "new") {
      const changeActor = staffMap.get(pick(["AR", "SY", "DM", "MP"]));
      await sql`
        insert into audit_log (
          org_id, target_type, target_id, action, actor_type,
          actor_user_id, diff, created_at, updated_at
        )
        values (
          ${ORG_ID}, 'work_order', ${row!.id}, 'status_changed', 'user',
          ${changeActor?.id ?? null},
          ${sql.json({ from: "new", to: w.status })},
          ${updatedAt}, ${updatedAt}
        )
      `;
    }
    if (w.vendorIdx >= 0) {
      await sql`
        insert into audit_log (
          org_id, target_type, target_id, action, actor_type,
          actor_user_id, diff, created_at, updated_at
        )
        values (
          ${ORG_ID}, 'work_order', ${row!.id}, 'assigned', 'user',
          ${principalUserId},
          ${sql.json({ vendor_id: vendorIds[w.vendorIdx]! })},
          ${updatedAt}, ${updatedAt}
        )
      `;
    }
  }

  /* ---- tenant-app demo: resident-reported WOs in varied states ---- */
  if (demoTenant) {
    console.log(`[db:seed] inserting tenant-app demo work orders...`);
    const tProp = propertyIds[0]!;
    const tTech = propertyTechIds[0]!;
    let tNum = 1001 + WORK_ORDERS.length;

    // (1) Resolved — awaiting the resident's confirmation (drives ResolutionBar).
    const [r1] = await sql<{ id: string }[]>`
      insert into work_orders (org_id, number, title, description, kind, status, priority,
        property_id, unit_id, category, created_at, updated_at, started_at, completed_at,
        created_by_actor_type, created_by_tenant_user_id, acknowledged_at, acknowledged_by_user_id, tenant_updated_at)
      values (${ORG_ID}, ${tNum}, ${"Kitchen faucet won't stop dripping"},
        ${"Started a few days ago, getting worse."}, 'work_order', 'resolved', 'normal',
        ${tProp}, ${demoTenant.unitId}, 'plumbing', ${d(6)}, ${h(3)}, ${d(5)}, ${h(3)},
        'tenant', ${demoTenant.id}, ${d(5)}, ${tTech}, ${h(4)})
      returning id`;
    woIds.push(r1!.id);
    await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, diff, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${r1!.id}, 'tenant_submitted', 'tenant', ${sql.json({ to: { status: "new", category: "plumbing" } })}, ${d(6)}, ${d(6)})`;
    await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${r1!.id}, 'status_changed', 'user', ${tTech}, ${sql.json({ from: "in_progress", to: "resolved" })}, ${h(3)}, ${h(3)})`;
    await sql`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id, assigned_by_user_id, assigned_at)
      values (${ORG_ID}, 'work_order', ${r1!.id}, 'user', ${tTech}, ${principalUserId}, ${d(5)})`;
    await sql`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${r1!.id}, ${"Came by Tuesday and replaced the cartridge — let us know if it's still dripping."}, 'user', ${tTech}, 'external', ${h(4)}, ${h(4)})`;

    // (2) Blocked, waiting on the resident (drives "Waiting on you").
    tNum += 1;
    const [r2] = await sql<{ id: string }[]>`
      insert into work_orders (org_id, number, title, description, kind, status, priority,
        property_id, unit_id, category, blocked_reason, created_at, updated_at, started_at,
        created_by_actor_type, created_by_tenant_user_id, acknowledged_at, acknowledged_by_user_id, tenant_updated_at)
      values (${ORG_ID}, ${tNum}, ${"Dishwasher not draining"},
        ${"Water pools at the bottom after every cycle."}, 'work_order', 'blocked', 'normal',
        ${tProp}, ${demoTenant.unitId}, 'appliance', 'waiting_tenant', ${d(3)}, ${h(20)}, ${h(40)},
        'tenant', ${demoTenant.id}, ${h(40)}, ${tTech}, ${h(20)})
      returning id`;
    woIds.push(r2!.id);
    await sql`insert into audit_log (org_id, target_type, target_id, action, actor_type, diff, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${r2!.id}, 'tenant_submitted', 'tenant', ${sql.json({ to: { status: "new", category: "appliance" } })}, ${d(3)}, ${d(3)})`;
    await sql`insert into assignments (org_id, target_type, target_id, assignee_type, assignee_id, assigned_by_user_id, assigned_at)
      values (${ORG_ID}, 'work_order', ${r2!.id}, 'user', ${tTech}, ${principalUserId}, ${h(40)})`;
    await sql`insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${r2!.id}, ${"Could you send a photo of the model number inside the door? Need it to order the part."}, 'user', ${tTech}, 'external', ${h(20)}, ${h(20)})`;
  }

  /* ---- comments ---- */
  console.log(`[db:seed] inserting ${COMMENTS.length} comments...`);
  for (const c of COMMENTS) {
    const woId = woIds[c.woIdx];
    if (!woId) continue;
    const at = m(c.minutesAgo);
    if (c.actor === "vendor") {
      const vendor = vendorIds[Math.floor(Math.random() * vendorIds.length)]!;
      await sql`
        insert into comments (org_id, target_type, target_id, body, actor_type, visibility, created_at, updated_at)
        values (${ORG_ID}, 'work_order', ${woId}, ${c.body}, 'vendor', ${c.visibility}, ${at}, ${at})
      `;
      // light audit entry too
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, diff, created_at, updated_at)
        values (${ORG_ID}, 'work_order', ${woId}, 'comment_added', 'vendor', ${sql.json({ visibility: c.visibility })}, ${at}, ${at})
      `;
    } else {
      const staff = staffMap.get(c.actor);
      if (!staff) continue;
      await sql`
        insert into comments (org_id, target_type, target_id, body, actor_type, actor_user_id, visibility, created_at, updated_at)
        values (${ORG_ID}, 'work_order', ${woId}, ${c.body}, 'user', ${staff.id}, ${c.visibility}, ${at}, ${at})
      `;
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG_ID}, 'work_order', ${woId}, 'comment_added', 'user', ${staff.id}, ${sql.json({ visibility: c.visibility })}, ${at}, ${at})
      `;
    }
  }

  /* ---- inspections + findings ---- */
  console.log(`[db:seed] inserting ${INSPECTIONS.length} inspections...`);
  const inspectionIds: string[] = [];
  for (const ins of INSPECTIONS) {
    const propertyId = propertyIds[ins.pIdx]!;
    const unitId = unitIdsByProperty[ins.pIdx]![ins.uIdx]!;
    const inspectorInitials = pick(["DM", "MP", "SY"]);
    const inspector = staffMap.get(inspectorInitials);
    const [row] = await sql<{ id: string }[]>`
      insert into inspections (
        org_id, kind, status, property_id, unit_id, inspector_user_id,
        scheduled_for, started_at, completed_at, reviewed_at,
        notes, created_at, updated_at
      )
      values (
        ${ORG_ID}, ${ins.kind}, ${ins.status}, ${propertyId}, ${unitId}, ${inspector?.id ?? null},
        ${dFuture(ins.scheduledDays)},
        ${ins.status === "in_progress" || ins.status === "completed" || ins.status === "reviewed" ? h(6) : null},
        ${ins.status === "completed" || ins.status === "reviewed" ? h(3) : null},
        ${ins.status === "reviewed" ? h(1) : null},
        ${`Routine ${ins.kind.replace(/_/g, " ")} inspection`},
        ${d(Math.max(1, -ins.createdDays))},
        ${m(Math.floor(Math.random() * 240) + 10)}
      )
      returning id
    `;
    inspectionIds.push(row!.id);

    if (ins.findings) {
      for (const f of ins.findings) {
        await sql`
          insert into inspection_findings (
            org_id, inspection_id, area, description, severity, pass
          )
          values (
            ${ORG_ID}, ${row!.id}, ${f.area}, ${f.description}, ${f.severity}, ${f.pass}
          )
        `;
      }
      // audit entry for findings
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG_ID}, 'inspection', ${row!.id}, 'finding_added', 'user', ${inspector?.id ?? null}, ${sql.json({ count: ins.findings.length })}, ${m(Math.floor(Math.random() * 90) + 5)}, ${m(Math.floor(Math.random() * 90) + 5)})
      `;
    }

    await sql`
      insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG_ID}, 'inspection', ${row!.id}, 'created', 'user', ${inspector?.id ?? null}, ${sql.json({ kind: ins.kind })}, ${d(Math.max(1, -ins.createdDays))}, ${d(Math.max(1, -ins.createdDays))})
    `;
  }

  /* ---- checklist template + live inspection items ---- */
  const WALK_STEPS = [
    "Exterior walk — roof, gutters, siding",
    "Common areas — lobby, stairs, hallways",
    "Lighting — replace any out bulbs",
    "Landscaping / parking lot",
    "Trash + recycling enclosure",
    "Fire extinguishers tagged + charged",
    "Vacant units — flush, check HVAC",
    "Mechanical / boiler room",
  ];
  console.log(`[db:seed] inserting "Weekly property walk" checklist template...`);
  const [tmpl] = await sql<{ id: string }[]>`
    insert into checklist_templates (org_id, name)
    values (${ORG_ID}, 'Weekly property walk')
    returning id
  `;
  for (let i = 0; i < WALK_STEPS.length; i++) {
    await sql`
      insert into checklist_template_items (org_id, template_id, title, ordering)
      values (${ORG_ID}, ${tmpl!.id}, ${WALK_STEPS[i]}, ${i})
    `;
  }
  // Pre-fill the live in_progress ad-hoc inspection so the demo shows a
  // half-checked Trello-style list (3/8 done).
  const liveInspectionId = inspectionIds[4];
  if (liveInspectionId) {
    const inspector = staffMap.get(pick(["DM", "MP", "SY"]));
    for (let i = 0; i < WALK_STEPS.length; i++) {
      const done = i < 3;
      await sql`
        insert into inspection_items (
          org_id, inspection_id, title, ordering, completed_at, completed_by_user_id
        )
        values (
          ${ORG_ID}, ${liveInspectionId}, ${WALK_STEPS[i]}, ${i},
          ${done ? h(2) : null}, ${done ? (inspector?.id ?? null) : null}
        )
      `;
    }
  }

  /* ---- projects ---- */
  console.log(`[db:seed] inserting ${PROJECTS.length} projects...`);
  for (const p of PROJECTS) {
    const propertyId = propertyIds[p.pIdx]!;
    const [row] = await sql<{ id: string }[]>`
      insert into projects (
        org_id, name, description, kind, status,
        property_id, target_completion, created_at, updated_at
      )
      values (
        ${ORG_ID}, ${p.name}, ${p.description}, ${p.kind}, ${p.status},
        ${propertyId}, ${dFuture(p.targetDays)},
        ${d(Math.max(1, -p.createdDays))}, ${m(Math.floor(Math.random() * 720) + 30)}
      )
      returning id
    `;
    const lead = staffMap.get(pick(["AR", "DM"]));
    if (lead) {
      await sql`
        insert into assignments (
          org_id, target_type, target_id, assignee_type, assignee_id,
          assigned_by_user_id, assigned_at
        )
        values (
          ${ORG_ID}, 'project', ${row!.id}, 'user', ${lead.id},
          ${principalUserId}, ${d(Math.max(1, -p.createdDays))}
        )
      `;
    }
  }

  /* ---- task templates + recent fires ---- */
  console.log(`[db:seed] inserting ${TEMPLATES.length} task templates...`);
  for (const t of TEMPLATES) {
    const [row] = await sql<{ id: string }[]>`
      insert into task_templates (
        org_id, name, description, cron, timezone, is_active,
        default_title, default_description, default_kind, default_priority,
        default_property_id, default_unit_id, lead_time_hours,
        last_fired_at, next_fire_at, times_fired, created_by_user_id
      )
      values (
        ${ORG_ID}, ${t.name}, ${t.description}, ${t.cron}, 'America/Denver', true,
        ${t.defaultTitle}, ${t.description}, 'work_order', ${t.defaultPriority},
        ${propertyIds[t.pIdx]!}, ${unitIdsByProperty[t.pIdx]![t.uIdx]!}, 24,
        ${d(Math.max(1, -t.lastFiredDays))}, ${dFuture(t.nextFireDays)}, ${t.timesFired}, ${principalUserId}
      )
      returning id
    `;
    // recent fire history (last 3)
    for (let f = 0; f < 3; f++) {
      const fireAt = d(Math.max(1, -t.lastFiredDays) + f * 30);
      await sql`
        insert into task_template_fires (org_id, template_id, fire_at, spawned_work_order_id, spawned_at)
        values (${ORG_ID}, ${row!.id}, ${fireAt}, null, ${fireAt})
      `;
    }
  }

  /* ---- approvals ---- */
  console.log(`[db:seed] inserting ${APPROVALS.length} approvals...`);
  for (const ap of APPROVALS) {
    const woId = woIds[ap.woIdx];
    if (!woId) continue;
    const at = h(ap.hoursAgo);
    await sql`
      insert into approvals (
        org_id, target_type, target_id, reason, amount_cents,
        status, notes, requested_by_user_id,
        created_at, updated_at
      )
      values (
        ${ORG_ID}, 'work_order', ${woId}, ${ap.reason}, ${String(ap.amountCents)},
        'pending', ${ap.notes}, ${principalUserId},
        ${at}, ${at}
      )
    `;
    const requester = staffMap.get(pick(["AR", "DM", "MP"]));
    await sql`
      insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG_ID}, 'work_order', ${woId}, 'approval_requested', 'user', ${requester?.id ?? null}, ${sql.json({ reason: ap.reason, amount: ap.amountCents })}, ${at}, ${at})
    `;
  }

  /* ---- invoices ---- */
  console.log(`[db:seed] inserting ${INVOICES.length} invoices...`);
  for (const inv of INVOICES) {
    const woId = woIds[inv.woIdx] ?? null;
    const vendorId = vendorIds[inv.vendorIdx]!;
    const submittedAt = h(inv.submittedHoursAgo);
    const approvedAt = inv.status === "approved" || inv.status === "paid" ? h(inv.submittedHoursAgo - 6) : null;
    const paidAt = inv.status === "paid" ? h(Math.max(1, inv.submittedHoursAgo - 24)) : null;
    await sql`
      insert into invoices (
        org_id, vendor_id, work_order_id, invoice_number, total_cents,
        status, submitted_at, approved_at, paid_at, notes,
        approved_by_user_id, paid_by_user_id, created_at, updated_at
      )
      values (
        ${ORG_ID}, ${vendorId}, ${woId}, ${inv.invoiceNumber}, ${String(inv.totalCents)},
        ${inv.status}, ${submittedAt}, ${approvedAt}, ${paidAt}, ${inv.notes ?? null},
        ${approvedAt ? principalUserId : null}, ${paidAt ? principalUserId : null},
        ${submittedAt}, ${approvedAt ?? submittedAt}
      )
    `;
    if (woId) {
      await sql`
        insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
        values (${ORG_ID}, 'work_order', ${woId}, 'invoice_submitted', 'vendor', null, ${sql.json({ invoice_number: inv.invoiceNumber, total: inv.totalCents })}, ${submittedAt}, ${submittedAt})
      `;
    }
  }

  /* ---- a few "recent activity" audit events with no WO change attached ---- */
  console.log(`[db:seed] sprinkling system events into audit_log...`);
  const sweepEvents = [
    { action: "coi_expiry_sweep", minutesAgo: 45, target: "vendor" as const },
    { action: "tenant_insurance_sweep", minutesAgo: 80, target: "tenant_insurance_policy" as const },
    { action: "template_spawned", minutesAgo: 90, target: "work_order" as const, useWo: true },
    { action: "approval_decided", minutesAgo: 130, target: "work_order" as const, useWo: true, diff: { to: "rejected", reason: "estimate_over_threshold" } },
  ];
  for (const ev of sweepEvents) {
    const targetId = ev.useWo ? woIds[Math.floor(Math.random() * Math.min(10, woIds.length))]! : woIds[0]!;
    const tt: string = ev.useWo ? "work_order" : ev.target;
    await sql`
      insert into audit_log (org_id, target_type, target_id, action, actor_type, actor_user_id, diff, created_at, updated_at)
      values (${ORG_ID}, ${tt}, ${targetId}, ${ev.action}, ${ev.action.includes("sweep") ? "system" : "user"}, ${ev.action.includes("sweep") ? null : principalUserId}, ${sql.json(ev.diff ?? {})}, ${m(ev.minutesAgo)}, ${m(ev.minutesAgo)})
    `;
  }

  /* ---- notifications ---- */
  console.log(`[db:seed] inserting ${NOTIFICATIONS.length} notifications -> ${recipient.email || recipient.name}...`);
  for (const n of NOTIFICATIONS) {
    const targetType = n.targetWoIdx !== undefined ? "work_order" : null;
    const targetId = n.targetWoIdx !== undefined ? woIds[n.targetWoIdx] ?? null : null;
    const at = m(n.minutesAgo);
    await sql`
      insert into notifications (
        org_id, recipient_user_id, channel, kind, subject, body,
        target_type, target_id, status, sent_at, created_at, updated_at
      )
      values (
        ${ORG_ID}, ${recipient.id}, 'in_app', ${n.kind}, ${n.subject}, ${n.body},
        ${targetType as never}, ${targetId}, 'sent', ${at}, ${at}, ${at}
      )
    `;
  }

  /* ---- summary ---- */
  console.log(`\n[db:seed] done.\nSummary for ${ORG_ID}:`);
  const counts = await sql<{ k: string; n: string }[]>`
    select 'properties' as k, count(*)::text as n from properties where org_id = ${ORG_ID}
    union all select 'units', count(*)::text from units where org_id = ${ORG_ID}
    union all select 'vendors', count(*)::text from vendors where org_id = ${ORG_ID}
    union all select 'vendor_users', count(*)::text from vendor_users where org_id = ${ORG_ID}
    union all select 'tenants', count(*)::text from tenant_users where org_id = ${ORG_ID}
    union all select 'tenant_insurance', count(*)::text from tenant_insurance_policies where org_id = ${ORG_ID}
    union all select 'work_orders', count(*)::text from work_orders where org_id = ${ORG_ID}
    union all select 'wo_open', count(*)::text from work_orders where org_id = ${ORG_ID} and status not in ('closed','cancelled')
    union all select 'wo_overdue', count(*)::text from work_orders where org_id = ${ORG_ID} and due_at < now() and status not in ('closed','cancelled','resolved','verified')
    union all select 'wo_blocked', count(*)::text from work_orders where org_id = ${ORG_ID} and status = 'blocked'
    union all select 'wo_in_progress', count(*)::text from work_orders where org_id = ${ORG_ID} and status = 'in_progress'
    union all select 'assignments', count(*)::text from assignments where org_id = ${ORG_ID} and unassigned_at is null
    union all select 'inspections', count(*)::text from inspections where org_id = ${ORG_ID}
    union all select 'inspection_findings', count(*)::text from inspection_findings where org_id = ${ORG_ID}
    union all select 'projects', count(*)::text from projects where org_id = ${ORG_ID}
    union all select 'templates', count(*)::text from task_templates where org_id = ${ORG_ID}
    union all select 'approvals_pending', count(*)::text from approvals where org_id = ${ORG_ID} and status = 'pending'
    union all select 'invoices', count(*)::text from invoices where org_id = ${ORG_ID}
    union all select 'invoices_submitted', count(*)::text from invoices where org_id = ${ORG_ID} and status = 'submitted'
    union all select 'comments', count(*)::text from comments where org_id = ${ORG_ID}
    union all select 'audit_log', count(*)::text from audit_log where org_id = ${ORG_ID}
    union all select 'audit_last_hour', count(*)::text from audit_log where org_id = ${ORG_ID} and created_at > now() - interval '1 hour'
    union all select 'notifications', count(*)::text from notifications where org_id = ${ORG_ID}
    union all select 'cois', count(*)::text from vendor_cois where org_id = ${ORG_ID}
    union all select 'cois_expiring', count(*)::text from vendor_cois where org_id = ${ORG_ID} and status = 'expiring'
    union all select 'cois_expired', count(*)::text from vendor_cois where org_id = ${ORG_ID} and status = 'expired'
  `;
  for (const c of counts) {
    console.log(`  ${c.k.padEnd(22, " ")} ${c.n}`);
  }
}

/**
 * Wipe org-scoped rows in FK-safe order. Used both for re-running and for
 * --orphans cleanup against the stale `org_audit_walkthrough` / `--` data.
 */
async function wipeOrg(orgId: string) {
  await sql`delete from audit_log where org_id = ${orgId}`;
  await sql`delete from notifications where org_id = ${orgId}`;
  await sql`delete from approvals where org_id = ${orgId}`;
  await sql`delete from task_costs where org_id = ${orgId}`;
  await sql`delete from task_time_entries where org_id = ${orgId}`;
  await sql`delete from invoices where org_id = ${orgId}`;
  await sql`delete from attachments where org_id = ${orgId}`;
  await sql`delete from comments where org_id = ${orgId}`;
  await sql`delete from inspection_items where org_id = ${orgId}`;
  await sql`delete from inspection_findings where org_id = ${orgId}`;
  await sql`delete from inspections where org_id = ${orgId}`;
  await sql`delete from checklist_template_items where org_id = ${orgId}`;
  await sql`delete from checklist_templates where org_id = ${orgId}`;
  await sql`delete from assignments where org_id = ${orgId}`;
  await sql`delete from work_orders where org_id = ${orgId}`;
  await sql`delete from task_template_fires where org_id = ${orgId}`;
  await sql`delete from task_templates where org_id = ${orgId}`;
  await sql`delete from projects where org_id = ${orgId}`;
  await sql`delete from task_scopes where org_id = ${orgId}`;
  await sql`delete from vendor_cois where org_id = ${orgId}`;
  await sql`delete from tenant_insurance_policies where org_id = ${orgId}`;
  await sql`delete from tenant_users where org_id = ${orgId}`;
  await sql`delete from vendor_users where org_id = ${orgId}`;
  await sql`delete from vendors where org_id = ${orgId}`;
  await sql`delete from units where org_id = ${orgId}`;
  await sql`delete from properties where org_id = ${orgId}`;
  // Phantom users only — preserve real Clerk-backed users.
  await sql`delete from users where org_id = ${orgId} and clerk_user_id like 'seed_phantom_%'`;
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error(err);
    await sql.end().catch(() => {});
    process.exit(1);
  });
