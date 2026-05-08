import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkOrder } from "@/lib/server/work-orders";
import { listComments } from "@/lib/server/comments";
import { listAttachments } from "@/lib/server/attachments";
import { listVendors, listVendorUsersForVendor } from "@/lib/server/vendors";
import { signReadUrl, storageConfigured } from "@/lib/server/storage";
import { StatusPill } from "@/components/status-pill";
import { StatusActions } from "@/components/status-actions";
import { CommentForm } from "@/components/comment-form";
import { PhotoCapture } from "@/components/photo-capture";
import { WoCosts } from "@/components/wo-costs";
import { assignVendorAction } from "../_actions";
import type { WorkOrderStatus } from "@contracts/state-machines/work-order";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wo = await getWorkOrder(id);
  if (!wo) notFound();

  const [comments, atts, vendors] = await Promise.all([
    listComments("work_order", id),
    listAttachments("work_order", id),
    listVendors(),
  ]);

  // Resolve all vendor_users in this org so the assign dropdown has them.
  const vendorUserOptions = (
    await Promise.all(vendors.map((v) => listVendorUsersForVendor(v.id)))
  ).flat();

  // Fan out signed read URLs for photos.
  const photos = atts.filter((a) => a.contentType.startsWith("image/"));
  const signedPhotos = storageConfigured()
    ? await Promise.all(
        photos.map(async (a) => ({ ...a, url: await signReadUrl(a.storageKey) })),
      )
    : photos.map((a) => ({ ...a, url: null }));

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work-orders" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <span className="text-xs text-neutral-500">WO-{wo.number}</span>
        <span className="ml-auto">
          <StatusPill status={wo.status as WorkOrderStatus} />
        </span>
      </header>

      <h1 className="text-lg font-semibold">{wo.title}</h1>
      {wo.description && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
          {wo.description}
        </p>
      )}

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Move forward
        </h2>
        <StatusActions workOrderId={wo.id} status={wo.status as WorkOrderStatus} />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Assign vendor
        </h2>
        <form action={assignVendorAction} className="flex gap-2">
          <input type="hidden" name="workOrderId" value={wo.id} />
          <select
            name="vendorUserId"
            className="flex-1 rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">— select vendor user —</option>
            {vendorUserOptions.map((vu) => (
              <option key={vu.id} value={vu.id}>
                {vu.name ?? vu.email}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Assign
          </button>
        </form>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Photos
        </h2>
        {signedPhotos.length === 0 ? (
          <p className="text-xs text-neutral-500">No photos yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {signedPhotos.map((p) => (
              <li key={p.id} className="aspect-square overflow-hidden rounded bg-neutral-100">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    no preview
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <PhotoCapture workOrderId={wo.id} kind="before_photo" label="Before" />
          <PhotoCapture workOrderId={wo.id} kind="after_photo" label="After" />
        </div>
      </section>

      <section className="mt-5">
        <WoCosts workOrderId={wo.id} />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Comments
        </h2>
        {comments.length === 0 ? (
          <p className="text-xs text-neutral-500">No comments.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded border border-neutral-200 bg-white p-2 text-sm">
                <div className="text-xs text-neutral-500">
                  {new Date(c.createdAt).toLocaleString()} · {c.visibility}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
              </li>
            ))}
          </ul>
        )}
        <CommentForm targetId={wo.id} />
      </section>
    </main>
  );
}
