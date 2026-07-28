import { listStaffUsers, listUnits } from "@/lib/server/properties";
import { smsConfigured } from "@/lib/server/sms";
import { Page, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setUserPhoneAction } from "../_actions";
import { AddPerson } from "./_add-person";

export const dynamic = "force-dynamic";

/**
 * Team — staff users + their mobile numbers for SMS dispatch. A tech only gets
 * a text on a new assignment if a number is on file here (and Twilio is
 * configured, which needs A2P 10DLC registration).
 */
export default async function AdminTeamPage() {
  const [staff, smsOn, units] = await Promise.all([
    listStaffUsers(),
    Promise.resolve(smsConfigured()),
    listUnits(),
  ]);

  return (
    <Page width="default">
      <PageHeader title="Team" backHref="/work" />

      <AddPerson units={units.map((u) => ({ id: u.id, label: u.label }))} />

      <div
        className={`mb-4 rounded-md border px-3 py-2 text-label ${
          smsOn
            ? "border-urgency-done/30 bg-urgency-done/5 text-foreground"
            : "border-urgency-blocked/30 bg-urgency-blocked/5 text-foreground"
        }`}
      >
        {smsOn ? (
          <>SMS is live. Techs with a number below get a text on each new assignment.</>
        ) : (
          <>
            SMS is <strong>not yet sending</strong> — Twilio isn&rsquo;t configured
            (needs A2P&nbsp;10DLC registration). Numbers entered here are stored and
            will start texting the moment Twilio env vars are set. Email + push
            already work.
          </>
        )}
      </div>

      {staff.length === 0 ? (
        <EmptyState
          title="No staff yet."
          description="They appear here after their first sign-in."
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {staff.map((u) => (
            <li key={u.id} className="px-2 py-2.5 text-body">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-foreground">
                  {u.name ?? u.email}
                </span>
                <span className="text-label text-muted-foreground">{u.email}</span>
              </div>
              <form
                action={setUserPhoneAction}
                className="mt-2 flex items-center gap-2"
              >
                <input type="hidden" name="userId" value={u.id} />
                <label className="text-label text-muted-foreground">Mobile</label>
                <Input
                  name="phone"
                  type="tel"
                  defaultValue={u.phone ?? ""}
                  placeholder="+1 555 555 0123"
                  className="flex-1 font-mono"
                />
                <Button type="submit" variant="outline" size="sm">
                  Save
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
