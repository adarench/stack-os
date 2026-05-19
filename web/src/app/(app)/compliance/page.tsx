import { auth } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { loadComplianceView } from "@/lib/server/compliance-view";
import { TimeSinceTicker } from "@/components/operator/time-since";
import { UrgencyDot } from "@/components/operator/urgency-dot";
import { LaneHeader } from "@/components/operator/lane-header";
import { cn } from "@/lib/utils";
import { COMPLIANCE_COPY } from "@/lib/labels";
import type { ComplianceStatus } from "@contracts/compliance";

export const dynamic = "force-dynamic";

type Tab = "cois" | "tenants";

const TAB_LABELS: Record<Tab, string> = {
  cois: "Vendor COIs",
  tenants: "Tenant insurance",
};

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/select-org");

  const sp = await searchParams;
  const tab: Tab = strOrNull(sp.tab) === "tenants" ? "tenants" : "cois";

  const view = await loadComplianceView();

  return (
    <TimeSinceTicker>
      <div className="mx-auto max-w-[1080px] px-3 py-3 md:px-4">
        {/* Assign-gate violations lane */}
        {view.violations.length > 0 && (
          <section className="mb-4 rounded-md border border-urgency-overdue/30 bg-urgency-overdue/5 p-3">
            <LaneHeader
              title={COMPLIANCE_COPY.violationsTitle}
              count={view.violations.length}
              tone="red"
              aside={
                <span className="flex items-center gap-1 text-[11px] text-urgency-overdue">
                  <AlertTriangle className="size-3" />
                  {COMPLIANCE_COPY.violationsAside}
                </span>
              }
            />
            <ul className="space-y-1">
              {view.violations.map((v) => (
                <li
                  key={v.vendorId}
                  className="flex items-center gap-2 px-2 py-1 text-sm"
                >
                  <UrgencyDot urgency="overdue" />
                  <span>{v.vendorName}</span>
                  {v.blockedOpenWoCount > 0 && (
                    <Link
                      href={`/work?status=open&q=${encodeURIComponent(v.vendorName)}`}
                      className="font-mono text-[10px] tabular-nums uppercase tracking-wider text-urgency-overdue hover:underline"
                    >
                      blocks {v.blockedOpenWoCount} WO
                      {v.blockedOpenWoCount === 1 ? "" : "s"}
                    </Link>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {COMPLIANCE_COPY.noActiveCoi}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tab strip */}
        <nav
          className="flex items-center gap-1 border-b border-border"
          aria-label="Compliance tabs"
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
            const active = t === tab;
            const counts =
              t === "cois"
                ? { active: view.summary.coiActive, expiring: view.summary.coiExpiring, expired: view.summary.coiExpired }
                : { active: view.summary.tenantActive, expiring: view.summary.tenantExpiring, expired: view.summary.tenantExpired };
            return (
              <Link
                key={t}
                href={`/compliance?tab=${t}`}
                scroll={false}
                className={cn(
                  "relative inline-flex h-9 items-center gap-2 px-3 text-[12px] font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-t",
                  active ? "after:bg-foreground" : "after:bg-transparent",
                )}
              >
                <ShieldCheck className="size-3.5" />
                {TAB_LABELS[t]}
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {counts.active + counts.expiring + counts.expired}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* List — the consequence chips on each row carry the urgency
            signal. We don't need a separate KPI strip. */}
        <div className="mt-3">
          {tab === "cois" ? <CoiList rows={view.cois} /> : <TenantList rows={view.tenantIns} />}
        </div>
      </div>
    </TimeSinceTicker>
  );
}

function CoiList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadComplianceView>>["cois"];
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
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
      <p className="mt-6 text-sm text-muted-foreground">
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

function statusUrgency(status: ComplianceStatus): Parameters<typeof UrgencyDot>[0]["urgency"] {
  if (status === "expired") return "overdue";
  if (status === "expiring") return "blocked";
  if (status === "active") return "done";
  return "muted";
}

/**
 * Compliance row's temporal chip. Reads "in 12d" / "5d ago" / "expires today"
 * — same width as a TimeSince chip but the wording carries the operational
 * truth. Tone tracks delta-to-expiry, not status, so expired-but-not-yet-
 * flagged rows still read red.
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
      className={cn(
        "shrink-0 font-mono text-[11px] tabular-nums",
        tone,
      )}
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
