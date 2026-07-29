"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignTenantUnitAction } from "../_actions";

/** Correct a resident's unit association from a dropdown. */
export function ReassignUnit({
  tenantId,
  unitId,
  units,
}: {
  tenantId: string;
  unitId: string | null;
  units: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      defaultValue={unitId ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await reassignTenantUnitAction({ tenantId, unitId: e.target.value || null });
          router.refresh();
        })
      }
      className="h-8 rounded-md border border-border bg-card px-2 text-label text-foreground disabled:opacity-60"
    >
      <option value="">— no unit —</option>
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </select>
  );
}
