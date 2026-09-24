/**
 * Pure display helpers for WO messaging (ops #21).
 * Keep free of DB / server-only so unit tests stay light.
 */

export type ActorRef = {
  actorType: string;
  /** users.id or vendor_users.id depending on actorType */
  actorUserId: string | null;
};

export type NamedPerson = {
  id: string;
  name: string | null;
  email: string | null;
};

/** Prefer name, then email, then a typed fallback — never invent a person. */
export function personLabel(
  person: NamedPerson | null | undefined,
  fallback: string,
): string {
  if (!person) return fallback;
  const name = person.name?.trim();
  if (name) return name;
  const email = person.email?.trim();
  if (email) return email;
  return fallback;
}

export function commentAuthorLabel(
  actor: ActorRef,
  staffById: Map<string, NamedPerson>,
  vendorById: Map<string, NamedPerson>,
): string {
  if (!actor.actorUserId) {
    if (actor.actorType === "system" || actor.actorType === "inngest") return "System";
    return "Unknown sender";
  }
  if (actor.actorType === "vendor") {
    return personLabel(vendorById.get(actor.actorUserId), "Vendor");
  }
  // staff / user / default
  return personLabel(staffById.get(actor.actorUserId), "Staff");
}

/** Join tenant names for the unit banner; empty → null (caller shows UNKNOWN). */
export function formatTenantNames(
  tenants: ReadonlyArray<{ name: string | null; email: string | null }>,
): string | null {
  const labels = tenants
    .map((t) => {
      const n = t.name?.trim();
      if (n) return n;
      const e = t.email?.trim();
      return e || null;
    })
    .filter((x): x is string => Boolean(x));
  if (labels.length === 0) return null;
  return labels.join(", ");
}
