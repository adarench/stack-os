"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  allowedNext,
  type WorkOrderStatus,
  type WorkOrderPriority,
} from "@contracts/state-machines/work-order";
import {
  assignVendorAction,
  transitionStatusAction,
} from "@/app/(app)/work-orders/_actions";
import { StatusPill } from "@/components/status-pill";
import { relativeTime } from "@/lib/format";

const PRIORITY_DOT: Record<WorkOrderPriority, string> = {
  low: "bg-neutral-300",
  normal: "bg-sky-400",
  high: "bg-amber-500",
  urgent: "bg-rose-600",
};

interface VendorUserOption {
  id: string;
  label: string;
}

export function DispatcherRow({
  wo,
  propertyName,
  unitLabel,
  vendorUserOptions,
}: {
  wo: {
    id: string;
    number: number;
    title: string;
    status: WorkOrderStatus;
    priority: WorkOrderPriority;
    createdAt: Date | string;
  };
  propertyName: string | null;
  unitLabel: string | null;
  vendorUserOptions: VendorUserOption[];
}) {
  const [vendorUserId, setVendorUserId] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const next = allowedNext(wo.status);

  function transitionTo(to: WorkOrderStatus) {
    setErr(null);
    const fd = new FormData();
    fd.set("id", wo.id);
    fd.set("to", to);
    start(async () => {
      try {
        await transitionStatusAction(fd);
      } catch (e) {
        setErr(String((e as Error).message));
      }
    });
  }

  function assign() {
    if (!vendorUserId) return;
    setErr(null);
    const fd = new FormData();
    fd.set("workOrderId", wo.id);
    fd.set("vendorUserId", vendorUserId);
    start(async () => {
      try {
        await assignVendorAction(fd);
      } catch (e) {
        setErr(String((e as Error).message));
      }
    });
  }

  return (
    <li className="rounded border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[wo.priority]}`}
          aria-label={`priority ${wo.priority}`}
        />
        <span className="text-xs text-neutral-500">WO-{wo.number}</span>
        <span className="text-xs text-neutral-400">· {relativeTime(wo.createdAt)}</span>
        <span className="ml-auto">
          <StatusPill status={wo.status} />
        </span>
      </div>
      <Link
        href={`/work-orders/${wo.id}`}
        className="mt-1 block text-sm font-medium leading-snug text-neutral-900 hover:underline"
      >
        {wo.title}
      </Link>
      {(propertyName || unitLabel) && (
        <div className="mt-0.5 text-xs text-neutral-500">
          {propertyName}
          {propertyName && unitLabel ? " · " : ""}
          {unitLabel}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={vendorUserId}
          onChange={(e) => setVendorUserId(e.target.value)}
          className="flex-1 min-w-[12ch] rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs"
        >
          <option value="">— assign vendor —</option>
          {vendorUserOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assign}
          disabled={!vendorUserId || pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Assign
        </button>
        {next.includes("triaged") && (
          <button
            type="button"
            onClick={() => transitionTo("triaged")}
            disabled={pending}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-neutral-700 disabled:opacity-50"
          >
            Triage
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-rose-700">Error: {err}</p>}
    </li>
  );
}
