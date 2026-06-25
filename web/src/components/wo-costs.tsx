import { listCosts, totalForWorkOrder } from "@/lib/server/costs";
import type { CostKind } from "@contracts/financials";
import { addCostAction } from "@/lib/actions/work-orders";
import { COST_KINDS } from "@contracts/financials";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/panel";

const KIND_TONE: Record<CostKind, BadgeTone> = {
  labor: "inflow",
  materials: "blocked",
  fee: "outline",
  other: "muted",
};

export async function WoCosts({ workOrderId }: { workOrderId: string }) {
  const [costs, total] = await Promise.all([
    listCosts(workOrderId),
    totalForWorkOrder(workOrderId),
  ]);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <SectionHeading className="mb-0">Costs</SectionHeading>
        <span className="font-mono text-body tabular-nums text-foreground">
          ${(total / 100).toFixed(2)}
        </span>
      </div>
      {costs.length === 0 ? (
        <p className="text-label text-muted-foreground">No costs entered yet.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {costs.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-1 py-1.5 text-body">
              <Badge tone={KIND_TONE[c.kind as CostKind]}>{c.kind}</Badge>
              {c.description && (
                <span className="truncate text-muted-foreground">{c.description}</span>
              )}
              <span className="ml-auto font-mono tabular-nums text-foreground">
                ${(Number(c.amountCents) / 100).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action={addCostAction} className="mt-3 grid grid-cols-3 gap-1.5">
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <Select name="kind" defaultValue="other">
          {COST_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
        <Input name="description" placeholder="Description" />
        <Input
          required
          name="amountCents"
          type="number"
          min={0}
          placeholder="Amount (¢)"
        />
        <Button type="submit" size="sm" className="col-span-3">
          Add cost
        </Button>
      </form>
    </section>
  );
}
