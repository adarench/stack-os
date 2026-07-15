import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readTenantSession } from "@/lib/server/tenant-auth";
import { loadTenantRequest } from "@/lib/server/tenant-requests";
import { loadTenantMessages } from "@/lib/server/tenant-work-orders";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/panel";
import { Timeline } from "@/components/tenant/timeline";
import { MessageThread } from "@/components/tenant/message-thread";
import { MessageComposer } from "@/components/tenant/message-composer";
import { ResolutionBar } from "@/components/tenant/resolution-bar";
import { toneForTenantStatus } from "@/components/tenant/request-card";

export const dynamic = "force-dynamic";

export default async function TenantRequestDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const session = await readTenantSession();
  if (!session) redirect("/tenant/sign-in");

  const req = await loadTenantRequest(session, ref);
  if (!req) notFound();
  const messages = await loadTenantMessages(session, ref);

  return (
    <div className="space-y-6">
      <Link
        href="/tenant"
        className="inline-flex items-center gap-1 text-label text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All requests
      </Link>

      <div>
        <div className="flex items-center gap-2">
          {req.category && (
            <span className="text-label text-muted-foreground">{req.category}</span>
          )}
          <Badge tone={toneForTenantStatus(req.status, req.blockedReason)} className="ml-auto">
            {req.tenantStatus}
          </Badge>
        </div>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          {req.title}
        </h1>
        <p className="mt-1 font-mono text-meta tabular-nums text-muted-foreground">
          {req.ref} · Submitted {new Date(req.createdAt).toLocaleDateString()}
        </p>
      </div>

      {req.status === "resolved" && (
        <ResolutionBar refId={req.ref} workOrderId={req.id} />
      )}

      {req.description && (
        <div>
          <SectionHeading>Details</SectionHeading>
          <p className="whitespace-pre-wrap text-body text-foreground">{req.description}</p>
        </div>
      )}

      {req.photos.length > 0 && (
        <div>
          <SectionHeading>Photos</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            {req.photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                {p.isVideo ? (
                  <video src={p.url} className="size-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="size-full object-cover" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionHeading>Messages</SectionHeading>
        <MessageThread messages={messages} />
        {req.isOpen && <MessageComposer workOrderId={req.id} refId={req.ref} />}
      </div>

      <div>
        <SectionHeading>Activity</SectionHeading>
        <Timeline events={req.timeline} />
      </div>
    </div>
  );
}
