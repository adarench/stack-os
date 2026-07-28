"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { addPersonAction } from "../_actions";

/**
 * Add a technician or a Lucid resident and get back a one-time username/password
 * to hand them ("add a tech" / "everybody at Lucid gets their own login").
 * Residents pick a unit; technicians don't.
 */
export function AddPerson({ units }: { units: { id: string; label: string }[] }) {
  const [type, setType] = useState<"technician" | "resident">("technician");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await addPersonAction({
      type,
      email,
      name,
      unitId: type === "resident" ? unitId : undefined,
    });
    setBusy(false);
    if (r.ok && r.email && r.password) {
      setResult({ email: r.email, password: r.password });
      setEmail("");
      setName("");
      setUnitId("");
      router.refresh();
    } else {
      setError(r.error ?? "Couldn't add that person.");
    }
  }

  const tab = (t: "technician" | "resident", label: string) => (
    <button
      type="button"
      onClick={() => setType(t)}
      aria-pressed={type === t}
      className={`rounded-md px-3 py-1.5 text-label font-medium transition-colors ${
        type === t
          ? "bg-foreground text-background"
          : "border border-border bg-card text-foreground hover:bg-muted/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <h2 className="text-body font-semibold text-foreground">Add a person</h2>
      <p className="mt-0.5 text-label text-muted-foreground">
        Creates a login and shows you a password to share once.
      </p>

      <div className="mt-3 flex gap-2">
        {tab("technician", "Technician")}
        {tab("resident", "Lucid resident")}
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <Input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {type === "resident" && (
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-body text-foreground"
          >
            <option value="">Unit / suite (optional)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Adding…" : "Add & create login"}
        </Button>
      </form>

      {error && <p className="mt-2 text-label text-urgency-overdue">{error}</p>}

      {result && (
        <div className="mt-3 rounded-md border border-urgency-done/30 bg-urgency-done/5 p-3">
          <p className="text-label font-medium text-foreground">
            Login created — copy this now, it won&rsquo;t show again:
          </p>
          <p className="mt-1 font-mono text-body text-foreground">Email: {result.email}</p>
          <p className="font-mono text-body text-foreground">Password: {result.password}</p>
        </div>
      )}
    </div>
  );
}
