"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPersonActiveAction, adminResetPasswordAction, adminSendInviteAction } from "./_actions";

/** Deactivate/reactivate + admin password reset for a staff or resident account. */
export function AccountActions({
  type,
  id,
  active,
}: {
  type: "staff" | "tenant";
  id: string;
  active: boolean;
}) {
  const [pending, start] = useTransition();
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const invite = () =>
    start(async () => {
      setErr(null);
      setSent(false);
      const r = await adminSendInviteAction({ type, id });
      if (r.ok) setSent(true);
      else setErr(r.error ?? "Failed");
    });

  const toggle = () =>
    start(async () => {
      setErr(null);
      const r = await setPersonActiveAction({ type, id, active: !active });
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Failed");
    });

  const reset = () =>
    start(async () => {
      setErr(null);
      setTempPw(null);
      const r = await adminResetPasswordAction({ type, id });
      if (r.ok && r.password) setTempPw(r.password);
      else setErr(r.error ?? "Failed");
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={invite}
          disabled={pending}
          className="rounded-md border border-border px-2.5 py-1 text-label text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          Send invite
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md border border-border px-2.5 py-1 text-label text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          Reset password
        </button>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`rounded-md border px-2.5 py-1 text-label transition-colors disabled:opacity-60 ${
            active
              ? "border-urgency-blocked/40 text-urgency-blocked hover:bg-urgency-blocked/5"
              : "border-urgency-done/40 text-urgency-done hover:bg-urgency-done/5"
          }`}
        >
          {active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
      {sent && <p className="text-meta text-urgency-done">Invite email sent.</p>}
      {tempPw && (
        <p className="font-mono text-meta text-foreground">
          Temp password (share once): <span className="font-semibold">{tempPw}</span>
        </p>
      )}
      {err && <p className="text-meta text-urgency-overdue">{err}</p>}
    </div>
  );
}
