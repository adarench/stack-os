import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { tenantUsers } from "@db/schema/compliance";
import { withStaffScope } from "@/lib/server/db";
import { listVendors, listVendorUsersForVendor } from "@/lib/server/vendors";
import { listCois } from "@/lib/server/coi";
import { listUnits } from "@/lib/server/properties";
import { getAttachmentReadUrls } from "@/lib/server/attachments";
import {
  loadComplianceView,
  selectComplianceBlockers,
} from "@/lib/server/compliance-view";
import { createVendorAction, inviteVendorUserAction } from "../admin/_actions";
import {
  inviteTenantUserAction,
  recordTenantInsuranceAction,
} from "../admin/compliance/_actions";
import { ComplianceLane } from "@/components/operator/compliance-lane";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CoiRecordForm } from "@/components/compliance/coi-record-form";
import { cn } from "@/lib/utils";
import type { ComplianceStatus } from "@contracts/compliance";

export const dynamic = "force-dynamic";

type Tab = "directory" | "compliance";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "directory", label: "Directory" },
  { value: "compliance", label: "Compliance" },
];

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const sp = await searchParams;
  const tab: Tab = strOrNull(sp.tab) === "compliance" ? "compliance" : "directory";

  return (
    <div className="mx-auto max-w-[1080px] px-3 py-3 md:px-4">
      <nav
        className="flex items-center gap-1 border-b border-border"
        aria-label="Vendors tabs"
      >
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={`/vendors?tab=${t.value}`}
              scroll={false}
              className={cn(
                "relative inline-flex h-9 items-center px-3 text-[12px] font-medium uppercase tracking-wider transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-t",
                active ? "after:bg-foreground" : "after:bg-transparent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "directory" ? <DirectoryTab /> : <ComplianceTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Directory — vendor roster + vendor-users + co-located COIs.        */
/* ------------------------------------------------------------------ */

async function DirectoryTab() {
  const [vendors, cois] = await Promise.all([listVendors(), listCois()]);
  const usersByVendor = new Map<
    string,
    Awaited<ReturnType<typeof listVendorUsersForVendor>>
  >();
  for (const v of vendors) {
    usersByVendor.set(v.id, await listVendorUsersForVendor(v.id));
  }
  const docs = await getAttachmentReadUrls(cois.map((c) => c.attachmentId));

  const coisByVendor = new Map<string, Awaited<ReturnType<typeof listCois>>>();
  for (const c of cois) {
    const list = coisByVendor.get(c.vendorId);
    if (list) list.push(c);
    else coisByVendor.set(c.vendorId, [c]);
  }

  const vendorOptions = vendors.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="mt-4 space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <SectionHeading>Add vendor</SectionHeading>
          <form action={createVendorAction} className="grid grid-cols-2 gap-2">
            <Input required name="name" placeholder="Name" className="col-span-2" />
            <Input
              name="trade"
              placeholder="Trade (plumbing, etc.)"
              className="col-span-2"
            />
            <Input name="primaryContactName" placeholder="Contact" />
            <Input name="primaryEmail" type="email" placeholder="Email" />
            <Input name="primaryPhone" placeholder="Phone" className="col-span-2" />
            <Button type="submit" className="col-span-2 mt-1">
              Add vendor
            </Button>
          </form>
        </Panel>

        <Panel>
          <SectionHeading>Record a COI</SectionHeading>
          <CoiRecordForm vendors={vendorOptions} />
        </Panel>
      </div>

      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet." />
      ) : (
        <ul className="divide-y divide-border/50">
          {vendors.map((v) => {
            const vendorCois = coisByVendor.get(v.id) ?? [];
            return (
              <li key={v.id} className="px-2 py-2.5 text-body">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium text-foreground">{v.name}</h3>
                  <span className="text-label text-muted-foreground">
                    {v.trade ?? ""}
                  </span>
                </div>

                <ul className="mt-2 space-y-1">
                  {(usersByVendor.get(v.id) ?? []).map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-2 text-foreground"
                    >
                      <span>· {u.name ?? u.email}</span>
                      <Badge tone={toneForStatus(u.status)}>{u.status}</Badge>
                    </li>
                  ))}
                </ul>

                {vendorCois.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {vendorCois.map((c) => {
                      const doc = c.attachmentId
                        ? docs.get(c.attachmentId)
                        : undefined;
                      return (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 text-label"
                        >
                          <span className="font-mono text-meta uppercase tracking-wider text-muted-foreground">
                            COI
                          </span>
                          <span className="text-foreground">
                            {c.carrier ?? "—"}
                            {c.policyNumber && (
                              <span className="ml-1.5 font-mono text-meta text-muted-foreground">
                                #{c.policyNumber}
                              </span>
                            )}
                          </span>
                          {doc && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-label text-urgency-inflow hover:underline"
                            >
                              PDF
                            </a>
                          )}
                          <span className="text-meta text-muted-foreground">
                            {c.expiresAt
                              ? `expires ${new Date(c.expiresAt).toLocaleDateString()}`
                              : "no expiry"}
                          </span>
                          <Badge
                            tone={toneForStatus(c.status)}
                            className="ml-auto"
                          >
                            {(c.status as ComplianceStatus).replace(/_/g, " ")}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer text-label text-muted-foreground">
                    + invite vendor user
                  </summary>
                  <form
                    action={inviteVendorUserAction}
                    className="mt-2 grid grid-cols-2 gap-2"
                  >
                    <input type="hidden" name="vendorId" value={v.id} />
                    <Input
                      required
                      name="email"
                      type="email"
                      placeholder="Email"
                      className="col-span-2"
                    />
                    <Input name="name" placeholder="Name" />
                    <Input name="phone" placeholder="Phone" />
                    <Button type="submit" size="sm" className="col-span-2">
                      Send magic link
                    </Button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compliance — dispatch blockers + COI/tenant monitoring + forms.    */
/* ------------------------------------------------------------------ */

async function ComplianceTab() {
  const [view, units] = await Promise.all([loadComplianceView(), listUnits()]);
  const tenants = await withStaffScope(async (tx, ctx) =>
    tx.select().from(tenantUsers).where(eq(tenantUsers.orgId, ctx.orgId)),
  );
  const unitById = new Map(units.map((u) => [u.id, u]));
  const blockers = selectComplianceBlockers(view, new Date());

  return (
    <div className="mt-4 space-y-6">
      <ComplianceLane blockers={blockers} />

      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <SectionHeading>Invite tenant</SectionHeading>
          <form
            action={inviteTenantUserAction}
            className="grid grid-cols-2 gap-2"
          >
            <Select required name="unitId" className="col-span-2">
              <option value="">— select unit —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Input
              required
              name="email"
              type="email"
              placeholder="Tenant email"
              className="col-span-2"
            />
            <Input name="name" placeholder="Name" />
            <Input name="phone" placeholder="Phone" />
            <Button type="submit" size="sm" className="col-span-2">
              Send magic link
            </Button>
          </form>
          <p className="mt-2 text-meta text-muted-foreground">
            Invite URL is logged in dev console + sent via Resend.
          </p>
        </Panel>

        <Panel>
          <SectionHeading>Record policy (admin entry)</SectionHeading>
          <form
            action={recordTenantInsuranceAction}
            className="grid grid-cols-2 gap-2"
          >
            <Select required name="tenantUserId" className="col-span-2">
              <option value="">— select tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name ?? t.email}{" "}
                  {t.unitId && `(${unitById.get(t.unitId)?.label ?? "?"})`}
                </option>
              ))}
            </Select>
            <Input name="policyNumber" placeholder="Policy number" />
            <Input name="carrier" placeholder="Carrier" />
            <Input name="effectiveAt" type="date" />
            <Input name="expiresAt" type="date" />
            <Button type="submit" size="sm" className="col-span-2">
              Record policy
            </Button>
          </form>
        </Panel>
      </div>

      <section>
        <div className="flex items-baseline gap-2 px-2 pb-1">
          <SectionHeading className="mb-0">Vendor COIs</SectionHeading>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {view.summary.coiActive +
              view.summary.coiExpiring +
              view.summary.coiExpired}
          </span>
        </div>
        <CoiList rows={view.cois} />
      </section>

      <section>
        <div className="flex items-baseline gap-2 px-2 pb-1">
          <SectionHeading className="mb-0">Tenant insurance</SectionHeading>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {view.summary.tenantActive +
              view.summary.tenantExpiring +
              view.summary.tenantExpired}
          </span>
        </div>
        <TenantList rows={view.tenantIns} />
      </section>
    </div>
  );
}

function CoiList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadComplianceView>>["cois"];
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 px-2 text-sm text-muted-foreground">
        No COIs on file. The next insurance upload from a vendor lands here.
      </p>
    );
  }
  return (
    <ul className="space-y-0">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted/40"
        >
          <UrgencyDot urgency={statusUrgency(r.status)} />
          <span className="flex-1 truncate">
            {r.vendorName}
            {r.carrier && (
              <span className="ml-2 text-muted-foreground">· {r.carrier}</span>
            )}
            {r.policyNumber && (
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                #{r.policyNumber}
              </span>
            )}
          </span>
          {r.affectedOpenWoCount > 0 &&
            (r.status === "expired" || r.status === "expiring") && (
              <Link
                href={`/work?status=open&q=${encodeURIComponent(r.vendorName)}`}
                className={cn(
                  "shrink-0 font-mono text-[10px] tabular-nums uppercase tracking-wider hover:underline",
                  r.status === "expired"
                    ? "text-urgency-overdue"
                    : "text-urgency-blocked",
                )}
              >
                blocks {r.affectedOpenWoCount} WO
                {r.affectedOpenWoCount === 1 ? "" : "s"}
              </Link>
            )}
          <ExpiryChip expiresAt={r.expiresAt} status={r.status} />
        </li>
      ))}
    </ul>
  );
}

function TenantList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadComplianceView>>["tenantIns"];
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 px-2 text-sm text-muted-foreground">
        No tenant policies on file. Move-ins surface here once a renter
        uploads their declaration page.
      </p>
    );
  }
  return (
    <ul className="space-y-0">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] hover:bg-muted/40"
        >
          <UrgencyDot urgency={statusUrgency(r.status)} />
          <span className="flex-1 truncate">
            {r.tenantName ?? r.tenantEmail}
            {r.unitLabel && (
              <span className="ml-2 text-muted-foreground">· {r.unitLabel}</span>
            )}
            {r.carrier && (
              <span className="ml-2 text-muted-foreground">· {r.carrier}</span>
            )}
          </span>
          <ExpiryChip expiresAt={r.expiresAt} status={r.status} />
        </li>
      ))}
    </ul>
  );
}

function statusUrgency(
  status: ComplianceStatus,
): Parameters<typeof UrgencyDot>[0]["urgency"] {
  if (status === "expired") return "overdue";
  if (status === "expiring") return "blocked";
  if (status === "active") return "done";
  return "muted";
}

/**
 * Compliance row's temporal chip. Reads "in 12d" / "5d ago" / "expires today"
 * — tone tracks delta-to-expiry so expired-but-not-yet-flagged rows read red.
 */
function ExpiryChip({
  expiresAt,
  status,
}: {
  expiresAt: string | null;
  status: ComplianceStatus;
}) {
  if (!expiresAt) {
    return (
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/70">
        no expiry
      </span>
    );
  }
  const target = new Date(expiresAt).getTime();
  const deltaMs = target - Date.now();
  const past = deltaMs <= 0;
  const abs = Math.abs(deltaMs);
  const human = humanizeMs(abs);

  let label: string;
  if (Math.abs(deltaMs) < 12 * 60 * 60 * 1000) {
    label = past ? "expired today" : "expires today";
  } else {
    label = past ? `${human} ago` : `in ${human}`;
  }

  const tone =
    past || status === "expired"
      ? "text-urgency-overdue"
      : status === "expiring" || deltaMs < 30 * 24 * 60 * 60 * 1000
        ? "text-urgency-blocked"
        : "text-muted-foreground";

  return (
    <span
      title={new Date(target).toLocaleDateString()}
      className={cn("shrink-0 font-mono text-[11px] tabular-nums", tone)}
    >
      {label}
    </span>
  );
}

function humanizeMs(absMs: number): string {
  const m = Math.round(absMs / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d}d`;
  const w = Math.round(d / 7);
  if (w < 8) return `${w}w`;
  const mo = Math.round(d / 30);
  return `${mo}mo`;
}

function strOrNull(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
