"use client";

import * as React from "react";
import { createWorkOrderAction } from "@/lib/actions/work-orders";
import { CategoryGrid } from "@/components/tenant/category-grid";
import type { WorkOrderCategory } from "@contracts/work-order-category";
import { WORK_ORDER_PRIORITIES } from "@contracts/state-machines/work-order";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

interface PropertyOpt {
  id: string;
  name: string;
}
interface UnitOpt {
  id: string;
  label: string;
  propertyId: string;
}
interface TenantOpt {
  id: string;
  name: string | null;
  email: string;
  unitId: string | null;
}

/**
 * Admin-side "log a service request" form — for a resident request that came
 * in by phone or email. Mirrors the tenant submit fields (category + title +
 * description + priority) and adds building/unit/on-behalf-of-tenant selectors,
 * since ops isn't scoped to a single unit. Routing stays operator-side:
 * createWorkOrder attributes the tenant but keeps createdByActorType "user"
 * and auto-assigns to the covering tech.
 */
export function ServiceRequestForm({
  properties,
  units,
  tenants,
}: {
  properties: PropertyOpt[];
  units: UnitOpt[];
  tenants: TenantOpt[];
}) {
  const [category, setCategory] = React.useState<WorkOrderCategory | null>(null);
  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [tenantUserId, setTenantUserId] = React.useState("");
  const [priority, setPriority] = React.useState("normal");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const unitsForProperty = React.useMemo(
    () => (propertyId ? units.filter((u) => u.propertyId === propertyId) : []),
    [propertyId, units],
  );
  const tenantsForUnit = React.useMemo(
    () => (unitId ? tenants.filter((t) => t.unitId === unitId) : []),
    [unitId, tenants],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) {
      setError("Title is required.");
      return;
    }
    if (!category) {
      setError("Pick an issue category.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Redirects to /work?d=WO-N on success; only genuine errors reach catch.
      await createWorkOrderAction({
        title,
        description: String(fd.get("description") ?? "") || undefined,
        priority: priority as (typeof WORK_ORDER_PRIORITIES)[number],
        category,
        propertyId: propertyId || undefined,
        unitId: unitId || undefined,
        createdByTenantUserId: tenantUserId || undefined,
        kind: "work_order",
      });
    } catch (err) {
      setSubmitting(false);
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Issue category">
        <CategoryGrid value={category} onChange={setCategory} />
      </Field>
      <Field label="Title" htmlFor="title">
        <Input required id="title" name="title" maxLength={200} placeholder="Short summary" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={4} />
      </Field>
      <Field label="Priority" htmlFor="priority">
        <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {WORK_ORDER_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Building" htmlFor="propertyId">
        <Select
          id="propertyId"
          value={propertyId}
          onChange={(e) => {
            setPropertyId(e.target.value);
            setUnitId("");
            setTenantUserId("");
          }}
        >
          <option value="">— none —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unit" htmlFor="unitId">
        <Select
          id="unitId"
          value={unitId}
          disabled={!propertyId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setTenantUserId("");
          }}
        >
          <option value="">{propertyId ? "— none —" : "select a building first"}</option>
          {unitsForProperty.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="On behalf of (tenant)"
        htmlFor="tenantUserId"
        hint="Attributes the request to the resident who reported it."
      >
        <Select
          id="tenantUserId"
          value={tenantUserId}
          disabled={!unitId}
          onChange={(e) => setTenantUserId(e.target.value)}
        >
          <option value="">{unitId ? "— none —" : "select a unit first"}</option>
          {tenantsForUnit.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? t.email}
            </option>
          ))}
        </Select>
      </Field>

      {error && (
        <p className="text-label text-urgency-overdue" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating…" : "Create service request"}
      </Button>
    </form>
  );
}
