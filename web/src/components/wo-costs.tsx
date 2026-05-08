import { listCosts, totalForWorkOrder } from "@/lib/server/costs";
import type { CostKind } from "@contracts/financials";
import { addCostAction } from "@/app/(app)/work-orders/_actions";
import { COST_KINDS } from "@contracts/financials";

const KIND_BADGE: Record<CostKind, string> = {
  labor: "bg-sky-100 text-sky-800",
  materials: "bg-amber-100 text-amber-800",
  fee: "bg-neutral-200 text-neutral-700",
  other: "bg-neutral-100 text-neutral-700",
};

export async function WoCosts({ workOrderId }: { workOrderId: string }) {
  const [costs, total] = await Promise.all([
    listCosts(workOrderId),
    totalForWorkOrder(workOrderId),
  ]);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Costs
        </h2>
        <span className="font-mono text-sm">${(total / 100).toFixed(2)}</span>
      </div>
      {costs.length === 0 ? (
        <p className="text-xs text-neutral-500">No costs entered yet.</p>
      ) : (
        <ul className="space-y-1">
          {costs.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm"
            >
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  KIND_BADGE[c.kind as CostKind]
                }`}
              >
                {c.kind}
              </span>
              {c.description && (
                <span className="text-xs text-neutral-700">{c.description}</span>
              )}
              <span className="ml-auto font-mono">
                ${(Number(c.amountCents) / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        action={addCostAction}
        className="mt-2 grid grid-cols-3 gap-1 rounded border border-dashed border-neutral-300 bg-white p-2 text-xs"
      >
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <select
          name="kind"
          defaultValue="other"
          className="rounded border border-neutral-300 px-2 py-1.5"
        >
          {COST_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          name="description"
          placeholder="Description"
          className="rounded border border-neutral-300 px-2 py-1.5"
        />
        <input
          required
          name="amountCents"
          type="number"
          min={0}
          placeholder="¢"
          className="rounded border border-neutral-300 px-2 py-1.5"
        />
        <button
          type="submit"
          className="col-span-3 rounded bg-neutral-900 px-2 py-1.5 text-white"
        >
          Add cost
        </button>
      </form>
    </section>
  );
}
