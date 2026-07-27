import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readVendorSession } from "@/lib/server/vendor-auth";
import { loadVendorWorkOrder } from "@/lib/server/vendor-work-orders";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/panel";
import { postVendorMessage } from "./_actions";

export const dynamic = "force-dynamic";

export default async function VendorWorkOrderPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const session = await readVendorSession();
  if (!session) redirect("/vendor/invalid");

  const wo = await loadVendorWorkOrder(session, ref);
  if (!wo) notFound();

  const submit = postVendorMessage.bind(null, ref);

  return (
    <Page as="main" width="narrow">
      <Link
        href="/vendor"
        className="inline-flex items-center gap-1 text-label text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All assigned work
      </Link>

      <PageHeader
        title={wo.title}
        description={`${wo.ref} · ${wo.priority} priority${wo.category ? ` · ${wo.category}` : ""}`}
      />
      <div className="flex items-center gap-2">
        <Badge tone={toneForStatus(wo.status)}>{wo.status.replace(/_/g, " ")}</Badge>
        {wo.dueAt && (
          <span className="text-meta text-muted-foreground">
            Due {new Date(wo.dueAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {wo.description && (
        <div className="mt-4">
          <SectionHeading>Details</SectionHeading>
          <p className="whitespace-pre-wrap text-body text-foreground">{wo.description}</p>
        </div>
      )}

      <div className="mt-4">
        <SectionHeading>Messages</SectionHeading>
        {wo.messages.length === 0 ? (
          <p className="text-meta text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {wo.messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-body text-foreground"
              >
                <div className="mb-0.5 text-meta text-muted-foreground">
                  {m.fromVendor ? "You" : "Stack"} · {new Date(m.at).toLocaleString()}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        )}

        <form action={submit} className="mt-3 flex flex-col gap-2">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Message the Stack team about this work order…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="self-end rounded-lg bg-primary px-4 py-2 text-label font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Send
          </button>
        </form>
      </div>
    </Page>
  );
}
