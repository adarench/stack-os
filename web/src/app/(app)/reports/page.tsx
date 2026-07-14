import { Download } from "lucide-react";
import { loadReportingSummary } from "@/lib/server/reporting-summary";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { BarList } from "@/components/reporting/bar-list";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COI_TONE: Record<string, BadgeTone> = {
  active: "done",
  expiring: "blocked",
  expired: "overdue",
  missing: "muted",
};

const humanize = (s: string) => s.replace(/_/g, " ");

export default async function ReportsPage() {
  const { throughput, byBuilding, byVendor, coi } = await loadReportingSummary();

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Operational health across work, buildings, vendors, and compliance."
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Open work" value={throughput.open} />
        <StatTile label="Completed · 30d" value={throughput.completed30d} />
        <StatTile
          label="Avg resolve"
          value={throughput.avgResolveDays != null ? `${throughput.avgResolveDays}d` : "—"}
        />
        <StatTile
          label="COIs expiring · 30d"
          value={coi.upcoming30d}
          tone={coi.upcoming30d > 0 ? "text-urgency-overdue" : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionHeading>Open by status</SectionHeading>
          <BarList
            items={throughput.openByStatus.map((s) => ({ label: humanize(s.status), value: s.n }))}
          />
        </Panel>
        <Panel>
          <SectionHeading>Aging (open)</SectionHeading>
          <BarList
            tone="bg-urgency-overdue"
            items={throughput.aging.map((a) => ({ label: a.bucket, value: a.n }))}
          />
        </Panel>
        <Panel>
          <SectionHeading>Open by priority</SectionHeading>
          <BarList
            items={throughput.openByPriority.map((p) => ({ label: humanize(p.priority), value: p.n }))}
          />
        </Panel>
        <Panel>
          <SectionHeading>COI compliance</SectionHeading>
          <ul className="space-y-1.5 text-label">
            <CoiRow label="Active" value={coi.active} tone="done" />
            <CoiRow label="Expiring" value={coi.expiring} tone="blocked" />
            <CoiRow label="Expired" value={coi.expired} tone="overdue" />
            <CoiRow label="Expiring within 30 days" value={coi.upcoming30d} tone="muted" />
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4">
        <div className="flex items-center justify-between">
          <SectionHeading>By building</SectionHeading>
          <ExportLink href="/api/export/buildings.csv" />
        </div>
        {byBuilding.length === 0 ? (
          <p className="text-label text-muted-foreground">No buildings.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            <li className="flex items-center gap-2 px-1 py-1.5 text-meta uppercase tracking-wider text-muted-foreground">
              <span className="flex-1">Building</span>
              <span className="w-16 text-right">Open</span>
              <span className="w-16 text-right">Aging</span>
            </li>
            {byBuilding.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-1 py-2 text-body">
                <span className="min-w-0 flex-1 truncate text-foreground">{b.name}</span>
                <span className="w-16 text-right tabular-nums text-foreground">{b.open}</span>
                <span
                  className={cn(
                    "w-16 text-right tabular-nums text-muted-foreground",
                    b.aging > 0 && "text-urgency-overdue",
                  )}
                >
                  {b.aging}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mt-4">
        <div className="flex items-center justify-between">
          <SectionHeading>By vendor</SectionHeading>
          <ExportLink href="/api/export/vendors.csv" />
        </div>
        {byVendor.length === 0 ? (
          <p className="text-label text-muted-foreground">No vendor assignments yet.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            <li className="flex items-center gap-2 px-1 py-1.5 text-meta uppercase tracking-wider text-muted-foreground">
              <span className="flex-1">Vendor</span>
              <span className="w-16 text-right">Assigned</span>
              <span className="w-16 text-right">Done</span>
              <span className="w-20 text-right">COI</span>
            </li>
            {byVendor.map((v) => (
              <li key={v.id} className="flex items-center gap-2 px-1 py-2 text-body">
                <span className="min-w-0 flex-1 truncate text-foreground">{v.name}</span>
                <span className="w-16 text-right tabular-nums text-foreground">{v.assigned}</span>
                <span className="w-16 text-right tabular-nums text-muted-foreground">
                  {v.completed}
                </span>
                <span className="flex w-20 justify-end">
                  <Badge tone={COI_TONE[v.coiState]}>{v.coiState}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className={cn("text-lg font-semibold tabular-nums text-foreground", tone)}>{value}</div>
      <div className="mt-0.5 text-meta uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function CoiRow({ label, value, tone }: { label: string; value: number; tone: BadgeTone }) {
  return (
    <li className="flex items-center gap-2">
      <Badge tone={tone}>{value}</Badge>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}

function ExportLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1 text-label text-muted-foreground transition-colors hover:text-foreground"
    >
      <Download className="size-3.5" /> CSV
    </a>
  );
}
