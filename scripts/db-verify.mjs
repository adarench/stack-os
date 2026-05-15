/**
 * Surface verification: query the DB the same way each surface loader does,
 * print sample output. Goal — confirm "the UI would render this" before we
 * tell the user to refresh.
 */
import { config } from "dotenv";
import postgres from "postgres";
config({ path: "web/.env.local" });

const ORG = process.argv[2] ?? "org_3DK8ysf4DrE4m0LkQNbPoIL0GP0";
const sql = postgres(process.env.DATABASE_URL_UNPOOLED, { ssl: "require", max: 1 });

const hr = (label) => console.log(`\n━━━ ${label} ━━━`);

hr("STATUS LINE / PULSE  (queue summary)");
const pulse = await sql`
  SELECT
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND status NOT IN ('closed','cancelled')) AS open_wos,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND due_at < now() AND status NOT IN ('closed','cancelled','resolved','verified')) AS overdue,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND status='blocked') AS blocked,
    (SELECT COUNT(*) FROM approvals WHERE org_id=${ORG} AND status='pending') AS pending_approvals,
    (SELECT COUNT(*) FROM vendor_cois WHERE org_id=${ORG} AND expires_at <= now() + interval '30 days') AS cois_30d
`;
console.log(pulse[0]);

hr("ACTIVITY STRIP  (org-wide audit_log, last 12, with actor + ref)");
const events = await sql`
  SELECT
    a.created_at,
    a.action,
    a.actor_type,
    u.name AS actor_name,
    a.target_type,
    CASE
      WHEN a.target_type='work_order' THEN 'WO-' || (SELECT number::text FROM work_orders WHERE id=a.target_id)
      WHEN a.target_type='inspection' THEN 'INS-' || UPPER(LEFT(a.target_id::text, 6))
      WHEN a.target_type='project' THEN 'PRJ-' || UPPER(LEFT(a.target_id::text, 6))
      ELSE NULL
    END AS target_ref
  FROM audit_log a
  LEFT JOIN users u ON u.id = a.actor_user_id
  WHERE a.org_id=${ORG}
  ORDER BY a.created_at DESC
  LIMIT 12
`;
for (const e of events) {
  const age = ((Date.now() - e.created_at) / 60000).toFixed(0);
  console.log(`  -${age}m  ${(e.actor_name ?? e.actor_type).padEnd(14)}  ${e.action.padEnd(18)}  ${e.target_ref ?? e.target_type}`);
}

hr("NOW LANES  (counts by lane)");
const lanes = await sql`
  SELECT
    (SELECT COUNT(*) FROM approvals WHERE org_id=${ORG} AND status='pending') AS needs,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND due_at < now() AND status NOT IN ('closed','cancelled','resolved','verified')) AS overdue,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND status='blocked') AS blocked,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND due_at >= date_trunc('day', now()) AND due_at < date_trunc('day', now()) + interval '1 day' AND status NOT IN ('closed','cancelled')) AS today,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND status='in_progress') AS inflight,
    (SELECT COUNT(*) FROM work_orders WHERE org_id=${ORG} AND updated_at > now() - interval '24 hours') AS changed
`;
console.log(lanes[0]);

hr("OVERDUE LANE  (sample rows w/ owner)");
const overdue = await sql`
  SELECT
    'WO-' || wo.number AS ref,
    wo.title,
    wo.priority,
    p.name AS property,
    EXTRACT(EPOCH FROM (now() - wo.updated_at))/60 AS minutes_ago,
    COALESCE(u.name, v.name, vu.name) AS owner
  FROM work_orders wo
  LEFT JOIN properties p ON p.id = wo.property_id
  LEFT JOIN LATERAL (
    SELECT a.assignee_type, a.assignee_id
    FROM assignments a
    WHERE a.target_type='work_order' AND a.target_id=wo.id AND a.unassigned_at IS NULL
    ORDER BY a.assigned_at DESC LIMIT 1
  ) latest ON true
  LEFT JOIN users u ON u.id = latest.assignee_id AND latest.assignee_type='user'
  LEFT JOIN vendors v ON v.id = latest.assignee_id AND latest.assignee_type='vendor'
  LEFT JOIN vendor_users vu ON vu.id = latest.assignee_id AND latest.assignee_type='vendor_user'
  WHERE wo.org_id=${ORG} AND wo.due_at < now() AND wo.status NOT IN ('closed','cancelled','resolved','verified')
  ORDER BY wo.priority DESC, wo.due_at LIMIT 5
`;
for (const r of overdue) {
  console.log(`  ${r.ref}  ${r.priority.padEnd(7)}  ${r.title.slice(0,38).padEnd(38)}  owner=${r.owner ?? '—'}  -${Math.round(r.minutes_ago)}m`);
}

hr("/WORK LIST  (default view: type=wo, status=open, top 10)");
const work = await sql`
  SELECT
    'WO-' || wo.number AS ref,
    wo.status,
    wo.priority,
    COALESCE(u.name, v.name, vu.name) AS owner
  FROM work_orders wo
  LEFT JOIN LATERAL (
    SELECT a.assignee_type, a.assignee_id
    FROM assignments a
    WHERE a.target_type='work_order' AND a.target_id=wo.id AND a.unassigned_at IS NULL
    ORDER BY a.assigned_at DESC LIMIT 1
  ) latest ON true
  LEFT JOIN users u ON u.id = latest.assignee_id AND latest.assignee_type='user'
  LEFT JOIN vendors v ON v.id = latest.assignee_id AND latest.assignee_type='vendor'
  LEFT JOIN vendor_users vu ON vu.id = latest.assignee_id AND latest.assignee_type='vendor_user'
  WHERE wo.org_id=${ORG} AND wo.status NOT IN ('closed','cancelled')
  ORDER BY wo.updated_at DESC LIMIT 10
`;
for (const r of work) {
  console.log(`  ${r.ref}  ${r.status.padEnd(11)}  ${r.priority.padEnd(7)}  owner=${r.owner ?? '—'}`);
}
const woWithOwner = work.filter((r) => r.owner).length;
console.log(`  → ${woWithOwner}/${work.length} top rows have an owner`);

hr("/COMPLIANCE  (assign-gate violations + COI status)");
const violations = await sql`
  SELECT v.name, COUNT(DISTINCT a.target_id) FILTER (WHERE w.status NOT IN ('closed','cancelled','resolved','verified')) AS blocked_wos
  FROM vendors v
  LEFT JOIN vendor_cois c ON c.vendor_id=v.id AND c.org_id=${ORG} AND c.status IN ('active','expiring')
  LEFT JOIN assignments a ON a.org_id=${ORG} AND a.target_type='work_order' AND a.assignee_type='vendor' AND a.assignee_id=v.id AND a.unassigned_at IS NULL
  LEFT JOIN work_orders w ON w.id=a.target_id
  WHERE v.org_id=${ORG} AND v.status='active'
  GROUP BY v.id, v.name HAVING COUNT(c.id) = 0
`;
for (const v of violations) {
  console.log(`  VIOLATION  ${v.name.padEnd(24)}  no COI  blocks ${v.blocked_wos} WO(s)`);
}
const expiringCois = await sql`
  SELECT vendors.name, vendor_cois.status, vendor_cois.expires_at
  FROM vendor_cois
  LEFT JOIN vendors ON vendors.id=vendor_cois.vendor_id
  WHERE vendor_cois.org_id=${ORG} AND vendor_cois.status IN ('expiring','expired')
  ORDER BY vendor_cois.expires_at
`;
for (const c of expiringCois) {
  const days = Math.round((c.expires_at - Date.now()) / 86400000);
  console.log(`  COI       ${c.name.padEnd(24)}  ${c.status.padEnd(9)}  ${days >= 0 ? `in ${days}d` : `${-days}d ago`}`);
}

hr("/MONEY APPROVALS  (pending, with WO context)");
const approvals = await sql`
  SELECT a.reason, a.amount_cents,
    EXTRACT(EPOCH FROM (now() - a.created_at))/3600 AS hours_ago,
    'WO-' || w.number AS wo_ref, w.status AS wo_status, w.due_at
  FROM approvals a
  LEFT JOIN work_orders w ON w.id=a.target_id
  WHERE a.org_id=${ORG} AND a.status='pending'
  ORDER BY a.created_at LIMIT 10
`;
for (const a of approvals) {
  const overdueLabel = a.due_at && a.due_at < Date.now() ? ` · overdue ${Math.round((Date.now() - a.due_at) / 86400000)}d` : "";
  console.log(`  ${a.reason.padEnd(28)}  $${(Number(a.amount_cents) / 100).toFixed(0).padStart(6)}  pending ${Math.round(a.hours_ago)}h  ${a.wo_ref} (${a.wo_status})${overdueLabel}`);
}

hr("/INBOX NOTIFICATIONS  (top 8 for Adam)");
const notifs = await sql`
  SELECT n.kind, n.subject,
    EXTRACT(EPOCH FROM (now() - n.created_at))/60 AS minutes_ago,
    n.target_type, n.target_id,
    CASE WHEN n.target_type='work_order' THEN 'WO-' || (SELECT number FROM work_orders WHERE id=n.target_id) ELSE NULL END AS target_ref
  FROM notifications n
  WHERE n.org_id=${ORG}
  ORDER BY n.created_at DESC LIMIT 8
`;
for (const n of notifs) {
  const m = Math.round(n.minutes_ago);
  const age = m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
  console.log(`  -${age.padStart(4)}  ${n.kind.padEnd(22)}  ${n.subject.slice(0, 42).padEnd(42)}  ${n.target_ref ?? "—"}`);
}

await sql.end();
